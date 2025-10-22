"""Serializers for the tasks application."""
from rest_framework import serializers

from .models import Task


class TaskSerializer(serializers.ModelSerializer):
    """Expose task data using the frontend's camelCase convention."""

    dueDate = serializers.DateField(
        source="due_date",
        allow_null=True,
        required=False,
    )
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)
    userId = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = [
            "id",
            "title",
            "description",
            "dueDate",
            "priority",
            "status",
            "createdAt",
            "updatedAt",
            "userId",
        ]
        read_only_fields = ["id", "createdAt", "updatedAt", "userId"]

    def get_userId(self, obj: Task) -> str:
        return str(obj.user_id)
