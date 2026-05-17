from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import Ticket, TicketReply
from .serializers import TicketSerializer, TicketListSerializer, TicketReplySerializer


class TicketListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'GET':
            return TicketListSerializer
        return TicketSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Ticket.objects.select_related('user', 'olt').prefetch_related('replies')
        if user.is_staff or user.is_superuser:
            return qs
        return qs.filter(user=user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class TicketDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = TicketSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Ticket.objects.select_related('user', 'olt').prefetch_related('replies__author')
        if user.is_staff or user.is_superuser:
            return qs
        return qs.filter(user=user)

    def update(self, request, *args, **kwargs):
        # Only staff can update status
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({'detail': 'Not allowed.'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reply_ticket(request, pk):
    user = request.user
    qs = Ticket.objects.all() if (user.is_staff or user.is_superuser) else Ticket.objects.filter(user=user)
    ticket = get_object_or_404(qs, pk=pk)

    serializer = TicketReplySerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    reply = serializer.save(ticket=ticket, author=user)

    # Update ticket status: staff reply → answered; user reply → open
    if user.is_staff or user.is_superuser:
        ticket.status = 'answered'
    else:
        if ticket.status == 'answered':
            ticket.status = 'open'
    ticket.save(update_fields=['status', 'updated_at'])

    return Response(TicketReplySerializer(reply).data, status=status.HTTP_201_CREATED)
