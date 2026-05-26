from django.db import models
from django.conf import settings
from django.utils import timezone


class Announcement(models.Model):
    TYPE_INFO     = 'info'
    TYPE_SUCCESS  = 'success'
    TYPE_WARNING  = 'warning'
    TYPE_CRITICAL = 'critical'
    TYPE_CHOICES  = [
        (TYPE_INFO,     'Info'),
        (TYPE_SUCCESS,  'Success'),
        (TYPE_WARNING,  'Warning'),
        (TYPE_CRITICAL, 'Critical'),
    ]

    title      = models.CharField(max_length=200)
    message    = models.TextField()
    type       = models.CharField(max_length=20, choices=TYPE_CHOICES, default=TYPE_INFO)
    is_active      = models.BooleanField(default=True)
    is_dismissible = models.BooleanField(default=True)
    expires_at     = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='announcements',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title

    @property
    def is_visible(self):
        if not self.is_active:
            return False
        if self.expires_at and self.expires_at < timezone.now():
            return False
        return True
