"""Tests for the AI assistant HTTP endpoints."""
import pytest

from ai.models import AIHistory


@pytest.mark.django_db
def test_ai_ask_creates_history_entry(auth_client):
    client, user = auth_client

    ask_response = client.post(
        "/api/ai/ask/",
        data={
            "message": "Help me prioritise my tasks.",
            "tasks": [
                {"id": 1, "title": "Write docs", "status": "todo"},
                {"id": 2, "title": "Ship feature", "status": "in-progress"},
            ],
        },
        format="json",
    )
    assert ask_response.status_code == 200, ask_response.content
    ask_data = ask_response.json()
    assert {"response", "historyId"} <= ask_data.keys()

    history_queryset = AIHistory.objects.filter(user=user)
    assert history_queryset.count() == 1
    history_id = ask_data["historyId"]

    history_list_response = client.get("/api/ai/history/")
    assert history_list_response.status_code == 200
    history_items = history_list_response.json()
    assert any(item["id"] == history_id for item in history_items)

    delete_response = client.delete(f"/api/ai/history/{history_id}/")
    assert delete_response.status_code == 204
    assert not AIHistory.objects.filter(user=user).exists()
