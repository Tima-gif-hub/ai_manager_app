"""Viewsets for the tasks API."""
from django.utils.dateparse import parse_date
from rest_framework import permissions, viewsets
from rest_framework.exceptions import PermissionDenied

from .models import Task
from .serializers import TaskSerializer


class TaskViewSet(viewsets.ModelViewSet):
    """CRUD operations for the authenticated user's tasks."""

    serializer_class = TaskSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Task.objects.filter(user=self.request.user)

        status_param = self.request.query_params.get("status")
        if status_param:
            queryset = queryset.filter(status=status_param)

        due_after = self._get_query_param("due_date__gte", "dueDate__gte")
        if due_after:
            parsed = parse_date(due_after)
            if parsed:
                queryset = queryset.filter(due_date__gte=parsed)

        due_before = self._get_query_param("due_date__lte", "dueDate__lte")
        if due_before:
            parsed = parse_date(due_before)
            if parsed:
                queryset = queryset.filter(due_date__lte=parsed)

        return queryset.order_by("-updated_at", "-created_at")

    def _get_query_param(self, *keys: str):
        for key in keys:
            value = self.request.query_params.get(key)
            if value:
                return value
        return None

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        if serializer.instance.user_id != self.request.user.id:
            raise PermissionDenied("Cannot modify another user's task.")
        serializer.save()

    def perform_destroy(self, instance):
        if instance.user_id != self.request.user.id:
            raise PermissionDenied("Cannot delete another user's task.")
        instance.delete()
