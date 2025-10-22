"""Serializers for the tasks application."""
import datetime

from django.utils import timezone
from rest_framework import serializers

from .models import Task


class TaskSerializer(serializers.ModelSerializer):
    """Expose task data using the frontend's camelCase convention."""

    dueDate = serializers.DateTimeField(
        source="due_date",
        allow_null=True,
        required=False,
    )
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)
    userId = serializers.PrimaryKeyRelatedField(source="user", read_only=True)

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

    def to_representation(self, instance: Task):
        """Ensure dueDate renders as an ISO datetime even when stored as a date."""
        data = super().to_representation(instance)
        due_date = instance.due_date
        if due_date:
            if isinstance(due_date, datetime.date) and not isinstance(
                due_date,
                datetime.datetime,
            ):
                due_dt = datetime.datetime.combine(due_date, datetime.time())
            else:
                due_dt = due_date

            if timezone.is_naive(due_dt):
                due_dt = timezone.make_aware(
                    due_dt,
                    timezone.get_default_timezone(),
                )

            data["dueDate"] = self.fields["dueDate"].to_representation(due_dt)
        else:
            data["dueDate"] = None
        return data

    def validate(self, attrs):
        """Normalize due_date input into a date for the model field."""
        due_dt = attrs.get("due_date")
        if isinstance(due_dt, datetime.datetime):
            attrs["due_date"] = due_dt.date()
        return super().validate(attrs)
