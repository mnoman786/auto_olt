import csv
import io
from django.db.models import Q
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from .models import Customer
from .serializers import CustomerSerializer


def _is_admin(user):
    return user.is_staff or user.is_superuser


def _customer_qs(user):
    if _is_admin(user):
        return Customer.objects.select_related('onu', 'onu__olt').all()
    return Customer.objects.select_related('onu', 'onu__olt').filter(user=user)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def customer_list(request):
    if request.method == 'GET':
        qs = _customer_qs(request.user)

        q = request.query_params.get('search', '').strip()
        if q:
            qs = qs.filter(
                Q(name__icontains=q) |
                Q(phone__icontains=q) |
                Q(cnic__icontains=q) |
                Q(onu__serial_number__icontains=q)
            )

        unassigned = request.query_params.get('unassigned', '')
        if unassigned.lower() in ('1', 'true'):
            qs = qs.filter(onu__isnull=True)

        paginator = PageNumberPagination()
        paginator.page_size = 20
        page = paginator.paginate_queryset(qs, request)
        serializer = CustomerSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    # POST — create
    serializer = CustomerSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    onu = serializer.validated_data.get('onu')
    if onu is not None:
        # Verify ONU belongs to this user's OLT
        if not _is_admin(request.user) and onu.olt.user != request.user:
            return Response({'onu': 'ONU does not belong to your OLTs.'}, status=status.HTTP_400_BAD_REQUEST)
        if hasattr(onu, 'customer'):
            return Response({'onu': 'This ONU already has a customer assigned.'}, status=status.HTTP_400_BAD_REQUEST)

    serializer.save(user=request.user)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def customer_detail(request, pk):
    try:
        customer = _customer_qs(request.user).get(pk=pk)
    except Customer.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(CustomerSerializer(customer).data)

    if request.method == 'DELETE':
        customer.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # PATCH
    serializer = CustomerSerializer(customer, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)

    new_onu = serializer.validated_data.get('onu', customer.onu)
    if new_onu is not None and new_onu != customer.onu:
        if not _is_admin(request.user) and new_onu.olt.user != request.user:
            return Response({'onu': 'ONU does not belong to your OLTs.'}, status=status.HTTP_400_BAD_REQUEST)
        if hasattr(new_onu, 'customer') and new_onu.customer.pk != customer.pk:
            return Response({'onu': 'This ONU already has a customer assigned.'}, status=status.HTTP_400_BAD_REQUEST)

    serializer.save()
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def customer_import_csv(request):
    """
    Import customers from CSV.
    Expected columns: name, phone, address, cnic, plan_name, notes, onu_serial
    """
    file = request.FILES.get('file')
    if not file:
        return Response({'detail': 'No file provided.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        text = file.read().decode('utf-8-sig')
    except UnicodeDecodeError:
        return Response({'detail': 'File must be UTF-8 encoded.'}, status=status.HTTP_400_BAD_REQUEST)

    reader = csv.DictReader(io.StringIO(text))
    required = {'name'}
    if not required.issubset({f.strip().lower() for f in (reader.fieldnames or [])}):
        return Response({'detail': 'CSV must have at least a "name" column.'}, status=status.HTTP_400_BAD_REQUEST)

    from apps.onus.models import ONU

    created, skipped, errors = 0, 0, []
    for i, row in enumerate(reader, start=2):
        name = row.get('name', '').strip()
        if not name:
            skipped += 1
            continue

        onu = None
        serial = row.get('onu_serial', '').strip()
        if serial:
            if _is_admin(request.user):
                onu_qs = ONU.objects.filter(serial_number__iexact=serial)
            else:
                onu_qs = ONU.objects.filter(serial_number__iexact=serial, olt__user=request.user)
            onu = onu_qs.first()
            if onu and hasattr(onu, 'customer'):
                errors.append(f'Row {i}: ONU {serial} already assigned — skipped.')
                skipped += 1
                continue

        Customer.objects.create(
            user=request.user,
            onu=onu,
            name=name,
            phone=row.get('phone', '').strip(),
            address=row.get('address', '').strip(),
            cnic=row.get('cnic', '').strip(),
            plan_name=row.get('plan_name', '').strip(),
            notes=row.get('notes', '').strip(),
        )
        created += 1

    return Response({'created': created, 'skipped': skipped, 'errors': errors})
