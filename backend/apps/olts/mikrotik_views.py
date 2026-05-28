import logging
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.serializers import ModelSerializer, SerializerMethodField, ListField, IntegerField

logger = logging.getLogger(__name__)
from .models import MikroTikRouter, OLT


class MikroTikRouterSerializer(ModelSerializer):
    linked_olts = SerializerMethodField()
    olt_ids = ListField(child=IntegerField(), write_only=True, required=False, default=list)
    owner_username = SerializerMethodField()

    def get_linked_olts(self, obj):
        return [{'id': o.id, 'name': o.name, 'ip_address': o.ip_address} for o in obj.olts.all()]

    def get_owner_username(self, obj):
        return obj.user.username

    class Meta:
        model = MikroTikRouter
        fields = ('id', 'name', 'host', 'port', 'username', 'owner_username', 'linked_olts', 'olt_ids', 'created_at', 'updated_at')
        read_only_fields = ('id', 'owner_username', 'created_at', 'updated_at')


class MikroTikRouterCreateSerializer(ModelSerializer):
    olt_ids = ListField(child=IntegerField(), write_only=True, required=False, default=list)

    class Meta:
        model = MikroTikRouter
        fields = ('id', 'name', 'host', 'port', 'username', 'password', 'olt_ids')
        extra_kwargs = {'password': {'write_only': True, 'required': False, 'allow_blank': True}}


def _owned_qs(user):
    if user.is_staff or user.is_superuser:
        return MikroTikRouter.objects.select_related('user').prefetch_related('olts').all()
    return MikroTikRouter.objects.select_related('user').prefetch_related('olts').filter(user=user)


def _link_olts(router, olt_ids, user):
    """Set mikrotik FK on the given OLTs; clear it from previously linked OLTs not in the list."""
    is_admin = user.is_staff or user.is_superuser
    olt_qs = OLT.objects.filter(user=user) if not is_admin else OLT.objects.all()
    # Unlink OLTs that were previously linked to this router but are no longer selected
    olt_qs.filter(mikrotik=router).exclude(id__in=olt_ids).update(mikrotik=None)
    # Link selected OLTs
    if olt_ids:
        olt_qs.filter(id__in=olt_ids).update(mikrotik=router)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def mikrotik_list(request):
    if request.method == 'GET':
        routers = _owned_qs(request.user)
        return Response(MikroTikRouterSerializer(routers, many=True).data)

    # POST — create
    serializer = MikroTikRouterCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    olt_ids = serializer.validated_data.pop('olt_ids', [])
    try:
        router = serializer.save(user=request.user)
        _link_olts(router, olt_ids, request.user)
        router.refresh_from_db()
        return Response(MikroTikRouterSerializer(router).data, status=status.HTTP_201_CREATED)
    except Exception as exc:
        logger.error('MikroTik create failed: %s', exc, exc_info=True)
        raise


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def mikrotik_detail(request, pk):
    try:
        router = _owned_qs(request.user).get(pk=pk)
    except MikroTikRouter.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(MikroTikRouterSerializer(router).data)

    if request.method == 'DELETE':
        router.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # PATCH
    serializer = MikroTikRouterCreateSerializer(router, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    olt_ids = serializer.validated_data.pop('olt_ids', None)
    # Don't overwrite password if blank/omitted
    if serializer.validated_data.get('password', None) == '':
        serializer.validated_data.pop('password', None)
    router = serializer.save()
    if olt_ids is not None:
        _link_olts(router, olt_ids, request.user)
    return Response(MikroTikRouterSerializer(router).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mikrotik_test(request, pk):
    try:
        router = _owned_qs(request.user).get(pk=pk)
    except MikroTikRouter.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

    from services import mikrotik_service
    # Allow overriding with values from request body (for testing before save)
    host = request.data.get('host') or router.host
    port = request.data.get('port') or router.port
    username = request.data.get('username') or router.username
    password = request.data.get('password') or router.password

    result = mikrotik_service.test_connection(host, port, username, password)
    return Response(result)
