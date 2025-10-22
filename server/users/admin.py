"""Admin registrations for user-related models."""
from django.contrib import admin

from .models import Profile


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "name", "theme", "language", "ai_response_style")
    search_fields = ("user__email", "user__username", "name")
    list_filter = ("theme", "ai_response_style")
