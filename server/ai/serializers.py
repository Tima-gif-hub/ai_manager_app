"""Serializers for AI interaction history."""
from rest_framework import serializers

from tasks.models import Task

from .models import AIHistory


class AssistantTaskInputSerializer(serializers.Serializer):
    """Validate the structure of tasks forwarded to the assistant."""

    id = serializers.IntegerField(min_value=1)
    title = serializers.CharField(max_length=255)
    status = serializers.ChoiceField(choices=Task.Status.choices)


class AskAssistantSerializer(serializers.Serializer):
    """Validate the assistant request payload."""

    message = serializers.CharField()
    tasks = AssistantTaskInputSerializer(many=True, required=False)


class AIHistorySerializer(serializers.ModelSerializer):
    """Expose AI history entries to the frontend."""

    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    userId = serializers.PrimaryKeyRelatedField(source="user", read_only=True)

    class Meta:
        model = AIHistory
        fields = ["id", "title", "query", "response", "createdAt", "userId"]
