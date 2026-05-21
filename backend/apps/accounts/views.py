from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken
from .serializers import RegisterSerializer, LoginSerializer, UserSerializer


class LoginRateThrottle(AnonRateThrottle):
    scope = 'auth_login'


class RegisterRateThrottle(AnonRateThrottle):
    scope = 'auth_register'


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([RegisterRateThrottle])
def register_view(request):
    if not getattr(settings, 'REGISTRATION_OPEN', False):
        return Response(
            {'detail': 'Registration is currently closed. Contact an administrator.'},
            status=status.HTTP_403_FORBIDDEN,
        )
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    refresh = RefreshToken.for_user(user)
    return Response({
        'user': UserSerializer(user).data,
        'access': str(refresh.access_token),
        'refresh': str(refresh),
    }, status=status.HTTP_201_CREATED)


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
