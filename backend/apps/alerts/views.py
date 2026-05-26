from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from .models import AlertRule, AlertEvent
from .serializers import AlertRuleSerializer, AlertEventSerializer


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def alert_rules(request):
    if request.method == 'GET':
        rules = AlertRule.objects.filter(user=request.user).select_related('olt')
        return Response(AlertRuleSerializer(rules, many=True).data)

    serializer = AlertRuleSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    # Ensure OLT belongs to the user if specified
    olt = serializer.validated_data.get('olt')
    if olt and olt.user != request.user:
        return Response({'detail': 'OLT not found.'}, status=status.HTTP_404_NOT_FOUND)
    serializer.save(user=request.user)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def alert_rule_detail(request, pk):
    try:
        rule = AlertRule.objects.get(pk=pk, user=request.user)
    except AlertRule.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)

    if request.method == 'DELETE':
        rule.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    serializer = AlertRuleSerializer(rule, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def alert_events(request):
    """Recent alert events for the current user (last 100)."""
    events = (
        AlertEvent.objects
        .filter(olt__user=request.user)
        .select_related('rule', 'olt', 'onu')
        .order_by('-triggered_at')[:100]
    )
    return Response(AlertEventSerializer(events, many=True).data)
