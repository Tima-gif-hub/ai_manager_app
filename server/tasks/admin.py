"""Admin registrations for the tasks app."""
from django.contrib import admin

from .models import Task


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "user",
        "status",
        "priority",
        "due_date",
        "created_at",
    )
    search_fields = ("title", "description", "user__email", "user__username")
    list_filter = ("status", "priority")
    ordering = ("-created_at",)
