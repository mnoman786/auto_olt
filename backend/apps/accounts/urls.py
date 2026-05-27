from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.register_view, name='auth-register'),
    path('login/', views.login_view, name='auth-login'),
    path('logout/', views.logout_view, name='auth-logout'),
    path('me/', views.me_view, name='auth-me'),
    path('me/update/', views.update_profile_view, name='auth-update-profile'),
    path('me/change-password/', views.change_password_view, name='auth-change-password'),
    path('verify-email/', views.verify_email_view, name='auth-verify-email'),
    path('resend-verification/', views.resend_verification_view, name='auth-resend-verification'),
    path('forgot-password/', views.forgot_password_view, name='auth-forgot-password'),
    path('reset-password/', views.reset_password_view, name='auth-reset-password'),
    path('token/refresh/', views.CookieTokenRefreshView.as_view(), name='token-refresh'),
    # Admin: user management
    path('admin/users/', views.admin_user_list, name='admin-user-list'),
    path('admin/users/<int:pk>/', views.admin_user_detail, name='admin-user-detail'),
]
