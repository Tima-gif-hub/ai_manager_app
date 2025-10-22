"""Additional user-related models."""
from django.conf import settings
from django.db import models


class UserProfile(models.Model):
    """Extended profile information for a user."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    display_name = models.CharField(max_length=150, blank=True)
    avatar_url = models.URLField(blank=True)

    def __str__(self) -> str:
        return f"Profile for {self.user.email}"


class UserSettings(models.Model):
    """Persisted settings for the application's UI and AI preferences."""

    class Theme(models.TextChoices):
        LIGHT = "light", "Light"
        DARK = "dark", "Dark"

    class AIStyle(models.TextChoices):
        CONCISE = "concise", "Concise"
        DETAILED = "detailed", "Detailed"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="settings",
    )
    theme = models.CharField(
        max_length=10,
        choices=Theme.choices,
        default=Theme.LIGHT,
    )
    ai_response_style = models.CharField(
        max_length=10,
        choices=AIStyle.choices,
        default=AIStyle.CONCISE,
    )
    language = models.CharField(max_length=8, default="en")

    def __str__(self) -> str:
        return f"Settings for {self.user.email}"
