"""Profile model storing additional user data and preferences."""
from django.conf import settings
from django.db import models


class Profile(models.Model):
    """Extended profile information coupled to the default Django user."""

    class Theme(models.TextChoices):
        LIGHT = "light", "Light"
        DARK = "dark", "Dark"

    class AIResponseStyle(models.TextChoices):
        CONCISE = "concise", "Concise"
        DETAILED = "detailed", "Detailed"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    avatar_url = models.URLField(blank=True)
    name = models.CharField(max_length=150, blank=True)
    theme = models.CharField(
        max_length=10,
        choices=Theme.choices,
        default=Theme.LIGHT,
    )
    language = models.CharField(max_length=8, default="en")
    ai_response_style = models.CharField(
        max_length=10,
        choices=AIResponseStyle.choices,
        default=AIResponseStyle.CONCISE,
    )

    def __str__(self) -> str:
        return f"Profile for {self.user.get_username()}"
