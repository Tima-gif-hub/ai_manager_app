"""Models for storing AI assistant interactions."""
from django.conf import settings
from django.db import models


class AIHistory(models.Model):
    """A single AI assistant interaction entry."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="ai_history",
    )
    title = models.CharField(max_length=255)
    query = models.TextField()
    response = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"AI history for {self.user.email}: {self.title}"
