"""Core application views."""
from django.http import JsonResponse


def health_check(_request):
    """Return a simple health payload for monitoring."""
    return JsonResponse({"status": "ok"})
