from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from .models import Announcement
from .serializers import AnnouncementSerializer


class IsAdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        return request.user and (request.user.is_staff or request.user.is_superuser)


class AnnouncementListCreateView(generics.ListCreateAPIView):
    serializer_class = AnnouncementSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        user = self.request.user
        # Admins see all; regular users see only visible ones
        if user.is_staff or user.is_superuser:
            return Announcement.objects.all()
        return Announcement.objects.filter(
            is_active=True,
        ).exclude(expires_at__lt=timezone.now())

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class AnnouncementDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AnnouncementSerializer
    permission_classes = [IsAdminOrReadOnly]
    queryset = Announcement.objects.all()
