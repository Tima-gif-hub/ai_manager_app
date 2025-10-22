"""Serializers for AI interaction history."""
from rest_framework import serializers

from .models import AIHistory


class AIHistorySerializer(serializers.ModelSerializer):
    """Expose AI history entries to the frontend."""

    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    userId = serializers.PrimaryKeyRelatedField(source="user", read_only=True)

    class Meta:
        model = AIHistory
        fields = ["id", "title", "query", "response", "createdAt", "userId"]
