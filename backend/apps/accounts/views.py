import random
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
from .serializers import RegisterSerializer, LoginSerializer, UserSerializer


class LoginRateThrottle(AnonRateThrottle):
    scope = 'auth_login'


class RegisterRateThrottle(AnonRateThrottle):
    scope = 'auth_register'


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

    otp = ''.join(random.choices(string.digits, k=6))
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
        .filter(user=user, otp=otp, is_used=False)
        .order_by('-created_at')
        .first()
    )
    if not record:
        return Response({'otp': 'Invalid or expired code.'}, status=status.HTTP_400_BAD_REQUEST)
    if record.is_expired():
        record.is_used = True
        record.save(update_fields=['is_used'])
        return Response({'otp': 'This code has expired. Please request a new one.'}, status=status.HTTP_400_BAD_REQUEST)

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

    otp = ''.join(random.choices(string.digits, k=6))
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
    if len(new_pw) < 6:
        return Response({'new_password': 'Password must be at least 6 characters.'}, status=status.HTTP_400_BAD_REQUEST)
    if new_pw != confirm:
        return Response({'confirm_password': 'Passwords do not match.'}, status=status.HTTP_400_BAD_REQUEST)

    user.set_password(new_pw)
    user.save(update_fields=['password'])
    return Response({'detail': 'Password changed successfully.'})


class ForgotPasswordThrottle(AnonRateThrottle):
    scope = 'forgot_password'


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
        return Response({'email': 'No account found with this email address.'}, status=status.HTTP_404_NOT_FOUND)

    # Invalidate any existing unused OTPs for this user
    PasswordResetOTP.objects.filter(user=user, is_used=False).update(is_used=True)

    # Generate 6-digit numeric OTP
    otp = ''.join(random.choices(string.digits, k=6))
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

    return Response({'detail': 'OTP sent successfully.'})


@api_view(['POST'])
@permission_classes([AllowAny])
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

    if len(new_pw) < 6:
        return Response({'new_password': 'Password must be at least 6 characters.'}, status=status.HTTP_400_BAD_REQUEST)
    if new_pw != confirm:
        return Response({'confirm_password': 'Passwords do not match.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = UserModel.objects.get(email__iexact=email)
    except UserModel.DoesNotExist:
        return Response({'otp': 'Invalid or expired code.'}, status=status.HTTP_400_BAD_REQUEST)

    record = (
        PasswordResetOTP.objects
        .filter(user=user, otp=otp, is_used=False)
        .order_by('-created_at')
        .first()
    )
    if not record:
        return Response({'otp': 'Invalid or expired code.'}, status=status.HTTP_400_BAD_REQUEST)
    if record.is_expired():
        record.is_used = True
        record.save(update_fields=['is_used'])
        return Response({'otp': 'This code has expired. Please request a new one.'}, status=status.HTTP_400_BAD_REQUEST)

    record.is_used = True
    record.save(update_fields=['is_used'])

    user.set_password(new_pw)
    user.save(update_fields=['password'])
    return Response({'detail': 'Password reset successfully. You can now log in.'})
