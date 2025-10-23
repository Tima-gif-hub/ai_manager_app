"""Viewsets for AI assistant history."""
from rest_framework import mixins, permissions, viewsets
from rest_framework.exceptions import PermissionDenied

from .models import AIHistory
from .serializers import AIHistorySerializer


class AIHistoryViewSet(
    mixins.CreateModelMixin,
    mixins.DestroyModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    """Manage AI history entries for the authenticated user."""

    serializer_class = AIHistorySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return AIHistory.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def perform_destroy(self, instance):
        if instance.user_id != self.request.user.id:
            raise PermissionDenied("Cannot delete another user's history entry.")
        instance.delete()
