from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from apps.olts.models import OLT
from .models import VLAN
from .serializers import VLANSerializer


def get_olt_for_user(pk, user):
    return get_object_or_404(OLT, pk=pk, user=user)


class VLANListCreateView(generics.ListCreateAPIView):
    serializer_class = VLANSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        olt = get_olt_for_user(self.kwargs['olt_pk'], self.request.user)
        return VLAN.objects.filter(olt=olt).prefetch_related('onus')

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['olt'] = get_olt_for_user(self.kwargs['olt_pk'], self.request.user)
        return ctx

    def perform_create(self, serializer):
        olt = get_olt_for_user(self.kwargs['olt_pk'], self.request.user)
        serializer.save(olt=olt)


class VLANDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = VLANSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        olt = get_olt_for_user(self.kwargs['olt_pk'], self.request.user)
        return VLAN.objects.filter(olt=olt)

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['olt'] = get_olt_for_user(self.kwargs['olt_pk'], self.request.user)
        return ctx

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.onus.exists():
            return Response(
                {'detail': f'Cannot delete VLAN {instance.vlan_id}: it has assigned ONUs.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)
