import hmac
import secrets
import string
from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken
from .models import PasswordResetOTP, EmailVerificationOTP
from .serializers import RegisterSerializer, LoginSerializer, UserSerializer, validate_password_strength


_OTP_ALPHABET = string.ascii_uppercase + string.digits
_OTP_LENGTH = 8


def _generate_otp() -> str:
    return ''.join(secrets.choice(_OTP_ALPHABET) for _ in range(_OTP_LENGTH))


def _otp_matches(record_otp: str, submitted_otp: str) -> bool:
    return hmac.compare_digest(record_otp.upper(), submitted_otp.upper())


class LoginRateThrottle(AnonRateThrottle):
    scope = 'auth_login'


class RegisterRateThrottle(AnonRateThrottle):
    scope = 'auth_register'


class ForgotPasswordThrottle(AnonRateThrottle):
    scope = 'forgot_password'


class OTPVerifyThrottle(AnonRateThrottle):
    scope = 'otp_verify'


class ResendOTPThrottle(AnonRateThrottle):
    scope = 'resend_otp'


def _send_verification_email(user, otp):
    """Send 6-digit email verification OTP."""
    expiry = getattr(settings, 'OTP_EXPIRY_MINUTES', 10)
    html_body = render_to_string('accounts/email_verification.html', {
        'username': user.username,
        'email': user.email,
        'otp': otp,
        'expiry_minutes': expiry,
    })
    send_mail(
        subject='Verify your Auto OLT account',
        message=f'Your verification code is: {otp}. It expires in {expiry} minutes.',
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        html_message=html_body,
        fail_silently=False,
    )


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([RegisterRateThrottle])
def register_view(request):
    if not getattr(settings, 'REGISTRATION_OPEN', False):
        return Response(
            {'detail': 'Registration is currently closed. Contact an administrator.'},
            status=status.HTTP_403_FORBIDDEN,
        )
    from .models import User as UserModel

    # Remove stale unverified accounts (older than 24 h) to allow re-registration.
    # Require a minimum age so an attacker cannot block someone's email by
    # continuously re-registering and deleting the pending account.
    stale_cutoff = timezone.now() - timezone.timedelta(hours=24)
    incoming_username = request.data.get('username', '').strip()
    incoming_email = request.data.get('email', '').strip()
    UserModel.objects.filter(
        is_active=False,
        username=incoming_username,
        date_joined__lt=stale_cutoff,
    ).delete()
    UserModel.objects.filter(
        is_active=False,
        email=incoming_email,
        date_joined__lt=stale_cutoff,
    ).delete()

    is_first_user = not UserModel.objects.exists()

    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()  # is_active=False set in serializer

    if is_first_user:
        # No users existed — activate immediately, no OTP needed
        user.is_active = True
        user.save(update_fields=['is_active'])
        refresh = RefreshToken.for_user(user)
        return Response({
            'user': UserSerializer(user).data,
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        }, status=status.HTTP_201_CREATED)

    otp = _generate_otp()
    EmailVerificationOTP.objects.create(user=user, otp=otp)

    try:
        _send_verification_email(user, otp)
    except Exception:
        user.delete()
        return Response(
            {'detail': 'Failed to send verification email. Please try again.'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    return Response({'email': user.email}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([OTPVerifyThrottle])
def verify_email_view(request):
    """Verify OTP and activate account, returning JWT tokens."""
    from .models import User as UserModel
    email = request.data.get('email', '').strip().lower()
    otp = request.data.get('otp', '').strip()

    if not email or not otp:
        return Response({'detail': 'Email and OTP are required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = UserModel.objects.get(email__iexact=email)
    except UserModel.DoesNotExist:
        return Response({'otp': 'Invalid or expired code.'}, status=status.HTTP_400_BAD_REQUEST)

    record = (
        EmailVerificationOTP.objects
        .filter(user=user, is_used=False)
        .order_by('-created_at')
        .first()
    )
    if not record:
        return Response({'otp': 'Invalid or expired code.'}, status=status.HTTP_400_BAD_REQUEST)
    if record.is_locked():
        return Response({'otp': 'Too many incorrect attempts. Please request a new code.'}, status=status.HTTP_400_BAD_REQUEST)
    if record.is_expired():
        record.is_used = True
        record.save(update_fields=['is_used'])
        return Response({'otp': 'This code has expired. Please request a new one.'}, status=status.HTTP_400_BAD_REQUEST)
    if not _otp_matches(record.otp, otp):
        record.attempts += 1
        record.save(update_fields=['attempts'])
        remaining = EmailVerificationOTP.MAX_ATTEMPTS - record.attempts
        return Response(
            {'otp': f'Invalid code. {remaining} attempt(s) remaining.' if remaining > 0 else 'Too many incorrect attempts. Please request a new code.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    record.is_used = True
    record.save(update_fields=['is_used'])

    user.is_active = True
    user.save(update_fields=['is_active'])

    refresh = RefreshToken.for_user(user)
    return Response({
        'user': UserSerializer(user).data,
        'access': str(refresh.access_token),
        'refresh': str(refresh),
    })


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([ResendOTPThrottle])
def resend_verification_view(request):
    """Resend email verification OTP."""
    from .models import User as UserModel
    email = request.data.get('email', '').strip().lower()
    if not email:
        return Response({'detail': 'Email is required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = UserModel.objects.get(email__iexact=email, is_active=False)
    except UserModel.DoesNotExist:
        return Response({'detail': 'If that email is pending verification, a new code has been sent.'})

    # Invalidate old unused OTPs
    EmailVerificationOTP.objects.filter(user=user, is_used=False).update(is_used=True)

    otp = _generate_otp()
    EmailVerificationOTP.objects.create(user=user, otp=otp)

    try:
        _send_verification_email(user, otp)
    except Exception:
        return Response(
            {'detail': 'Failed to send email. Please try again later.'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    return Response({'detail': 'If that email is pending verification, a new code has been sent.'})


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([LoginRateThrottle])
def login_view(request):
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.validated_data['user']
    refresh = RefreshToken.for_user(user)
    return Response({
        'user': UserSerializer(user).data,
        'access': str(refresh.access_token),
        'refresh': str(refresh),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    try:
        refresh_token = request.data.get('refresh')
        if refresh_token:
            token = RefreshToken(refresh_token)
            token.blacklist()
    except Exception:
        pass
    return Response({'detail': 'Logged out.'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me_view(request):
    return Response(UserSerializer(request.user).data)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_profile_view(request):
    user = request.user
    allowed = {k: v for k, v in request.data.items() if k in ('first_name', 'last_name', 'email')}
    if not allowed:
        return Response({'detail': 'No updatable fields provided.'}, status=status.HTTP_400_BAD_REQUEST)
    if 'email' in allowed:
        email = allowed['email'].strip()
        if not email:
            return Response({'email': 'Email cannot be blank.'}, status=status.HTTP_400_BAD_REQUEST)
        from .models import User as UserModel
        if UserModel.objects.filter(email=email).exclude(pk=user.pk).exists():
            return Response({'email': 'This email is already in use.'}, status=status.HTTP_400_BAD_REQUEST)
        user.email = email
    if 'first_name' in allowed:
        user.first_name = allowed['first_name']
    if 'last_name' in allowed:
        user.last_name = allowed['last_name']
    user.save(update_fields=[f for f in ('email', 'first_name', 'last_name') if f in allowed])
    return Response(UserSerializer(user).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password_view(request):
    user = request.user
    current = request.data.get('current_password', '')
    new_pw = request.data.get('new_password', '')
    confirm = request.data.get('confirm_password', '')

    if not user.check_password(current):
        return Response({'current_password': 'Incorrect current password.'}, status=status.HTTP_400_BAD_REQUEST)
    strength_errors = validate_password_strength(new_pw)
    if strength_errors:
        return Response({'new_password': strength_errors[0]}, status=status.HTTP_400_BAD_REQUEST)
    if new_pw != confirm:
        return Response({'confirm_password': 'Passwords do not match.'}, status=status.HTTP_400_BAD_REQUEST)

    user.set_password(new_pw)
    user.save(update_fields=['password'])
    return Response({'detail': 'Password changed successfully.'})


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([ForgotPasswordThrottle])
def forgot_password_view(request):
    """Generate a 6-digit OTP and send it to the user's email."""
    from .models import User as UserModel
    email = request.data.get('email', '').strip().lower()
    if not email:
        return Response({'email': 'Email is required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = UserModel.objects.get(email__iexact=email)
    except UserModel.DoesNotExist:
        # Generic response to prevent user enumeration
        return Response({'detail': 'If an account with that email exists, a reset code has been sent.'})

    # Invalidate any existing unused OTPs for this user
    PasswordResetOTP.objects.filter(user=user, is_used=False).update(is_used=True)

    otp = _generate_otp()
    PasswordResetOTP.objects.create(user=user, otp=otp)

    expiry = getattr(settings, 'OTP_EXPIRY_MINUTES', 10)
    html_body = render_to_string('accounts/reset_otp_email.html', {
        'username': user.username,
        'email': user.email,
        'otp': otp,
        'expiry_minutes': expiry,
    })

    try:
        send_mail(
            subject='Your Auto OLT Password Reset Code',
            message=f'Your OTP is: {otp}. It expires in {expiry} minutes.',
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            html_message=html_body,
            fail_silently=False,
        )
    except Exception as exc:
        return Response(
            {'detail': 'Failed to send email. Please try again later.'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    return Response({'detail': 'If an account with that email exists, a reset code has been sent.'})


def _is_admin(user):
    return user.is_authenticated and (user.is_staff or user.is_superuser)


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([OTPVerifyThrottle])
def reset_password_view(request):
    """Verify OTP and set new password."""
    from .models import User as UserModel
    email = request.data.get('email', '').strip().lower()
    otp = request.data.get('otp', '').strip()
    new_pw = request.data.get('new_password', '')
    confirm = request.data.get('confirm_password', '')

    errors = {}
    if not email:
        errors['email'] = 'Email is required.'
    if not otp:
        errors['otp'] = 'OTP is required.'
    if not new_pw:
        errors['new_password'] = 'New password is required.'
    if errors:
        return Response(errors, status=status.HTTP_400_BAD_REQUEST)

    strength_errors = validate_password_strength(new_pw)
    if strength_errors:
        return Response({'new_password': strength_errors[0]}, status=status.HTTP_400_BAD_REQUEST)
    if new_pw != confirm:
        return Response({'confirm_password': 'Passwords do not match.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = UserModel.objects.get(email__iexact=email)
    except UserModel.DoesNotExist:
        return Response({'otp': 'Invalid or expired code.'}, status=status.HTTP_400_BAD_REQUEST)

    record = (
        PasswordResetOTP.objects
        .filter(user=user, is_used=False)
        .order_by('-created_at')
        .first()
    )
    if not record:
        return Response({'otp': 'Invalid or expired code.'}, status=status.HTTP_400_BAD_REQUEST)
    if record.is_locked():
        return Response({'otp': 'Too many incorrect attempts. Please request a new code.'}, status=status.HTTP_400_BAD_REQUEST)
    if record.is_expired():
        record.is_used = True
        record.save(update_fields=['is_used'])
        return Response({'otp': 'This code has expired. Please request a new one.'}, status=status.HTTP_400_BAD_REQUEST)
    if not _otp_matches(record.otp, otp):
        record.attempts += 1
        record.save(update_fields=['attempts'])
        remaining = PasswordResetOTP.MAX_ATTEMPTS - record.attempts
        return Response(
            {'otp': f'Invalid code. {remaining} attempt(s) remaining.' if remaining > 0 else 'Too many incorrect attempts. Please request a new code.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    record.is_used = True
    record.save(update_fields=['is_used'])

    user.set_password(new_pw)
    user.save(update_fields=['password'])
    return Response({'detail': 'Password reset successfully. You can now log in.'})


# ---------------------------------------------------------------------------
# Admin: user management
# ---------------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_user_list(request):
    """List all users with OLT counts. Admin only."""
    if not _is_admin(request.user):
        return Response({'detail': 'Admin access required.'}, status=status.HTTP_403_FORBIDDEN)

    from .models import User as UserModel
    from django.db.models import Count

    users = (
        UserModel.objects
        .annotate(olt_count=Count('olts', distinct=True))
        .order_by('-date_joined')
    )

    data = [
        {
            'id': u.id,
            'username': u.username,
            'email': u.email,
            'first_name': u.first_name,
            'last_name': u.last_name,
            'is_active': u.is_active,
            'is_staff': u.is_staff,
            'is_superuser': u.is_superuser,
            'olt_count': u.olt_count,
            'date_joined': u.date_joined,
        }
        for u in users
    ]
    return Response(data)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def admin_user_detail(request, pk):
    """Get / update / delete a single user. Admin only."""
    if not _is_admin(request.user):
        return Response({'detail': 'Admin access required.'}, status=status.HTTP_403_FORBIDDEN)

    from .models import User as UserModel

    try:
        target = UserModel.objects.get(pk=pk)
    except UserModel.DoesNotExist:
        return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'DELETE':
        if target.pk == request.user.pk:
            return Response({'detail': 'You cannot delete your own account.'}, status=status.HTTP_400_BAD_REQUEST)
        target.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    if request.method == 'PATCH':
        if 'is_active' in request.data and target.pk == request.user.pk:
            return Response({'detail': 'You cannot change your own active status.'}, status=status.HTTP_400_BAD_REQUEST)
        if 'is_active' in request.data:
            target.is_active = bool(request.data['is_active'])
            target.save(update_fields=['is_active'])

    # GET or post-PATCH: return full user + their OLTs
    from apps.olts.models import OLT
    from apps.olts.serializers import OLTSerializer
    from django.db.models import Count, Q

    olts = OLT.objects.filter(user=target).annotate(
        _onu_count=Count('onus', distinct=True),
        _registered_onu_count=Count(
            'onus',
            filter=Q(onus__status__in=('registered', 'active')),
            distinct=True,
        ),
        _vlan_count=Count('vlans', distinct=True),
        _discovered_vlan_count=Count(
            'vlans',
            filter=Q(vlans__source='discovered'),
            distinct=True,
        ),
    )

    return Response({
        'id': target.id,
        'username': target.username,
        'email': target.email,
        'first_name': target.first_name,
        'last_name': target.last_name,
        'is_active': target.is_active,
        'is_staff': target.is_staff,
        'is_superuser': target.is_superuser,
        'date_joined': target.date_joined,
        'olts': OLTSerializer(olts, many=True).data,
    })
