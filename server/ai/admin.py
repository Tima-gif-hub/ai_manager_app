"""Admin registrations for AI interaction history."""
from django.contrib import admin

from .models import AIHistory


@admin.register(AIHistory)
class AIHistoryAdmin(admin.ModelAdmin):
    list_display = ("title", "user", "created_at")
    search_fields = ("title", "query", "response", "user__email", "user__username")
    ordering = ("-created_at",)
