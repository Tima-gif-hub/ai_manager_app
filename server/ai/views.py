"""Viewsets and endpoints for AI assistant interactions."""
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AIHistory
from .serializers import AIHistorySerializer, AskAssistantSerializer
from .services import ask_assistant


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


class AskAssistantView(APIView):
    """Handle interactive assistant requests."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = AskAssistantSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        message: str = serializer.validated_data["message"]
        tasks = serializer.validated_data.get("tasks") or []

        assistant_response = ask_assistant(message=message, tasks=tasks)

        history = AIHistory.objects.create(
            user=request.user,
            title=_build_history_title(message),
            query=message,
            response=assistant_response,
        )

        return Response(
            {"response": assistant_response, "historyId": history.id},
            status=status.HTTP_200_OK,
        )


def _build_history_title(message: str) -> str:
    """Derive a compact history title from the original message."""

    normalized = " ".join(message.strip().split())
    return normalized[:80] or "AI Assistant Conversation"
