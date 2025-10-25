"""End-to-end tests for the task management API."""
from datetime import date, timedelta

import pytest


@pytest.mark.django_db
def test_task_crud_and_filters(auth_client):
    client, _user = auth_client

    today = date.today()
    future_date = today + timedelta(days=7)

    create_response = client.post(
        "/api/tasks/",
        data={
            "title": "Write docs",
            "description": "Prepare release notes",
            "dueDate": today.isoformat(),
            "priority": "medium",
            "status": "todo",
        },
        format="json",
    )
    assert create_response.status_code == 201, create_response.content
    task_a = create_response.json()
    assert task_a["title"] == "Write docs"
    assert task_a["status"] == "todo"

    create_response_b = client.post(
        "/api/tasks/",
        data={
            "title": "Ship feature",
            "description": "",
            "dueDate": future_date.isoformat(),
            "priority": "high",
            "status": "in-progress",
        },
        format="json",
    )
    assert create_response_b.status_code == 201, create_response_b.content
    task_b = create_response_b.json()
    assert task_b["priority"] == "high"

    update_response = client.patch(
        f"/api/tasks/{task_b['id']}/",
        data={"status": "completed"},
        format="json",
    )
    assert update_response.status_code == 200, update_response.content
    assert update_response.json()["status"] == "completed"

    list_response = client.get("/api/tasks/")
    assert list_response.status_code == 200
    tasks = list_response.json()
    assert len(tasks) == 2

    completed_response = client.get("/api/tasks/", {"status": "completed"})
    assert completed_response.status_code == 200
    completed_tasks = completed_response.json()
    assert [task["id"] for task in completed_tasks] == [task_b["id"]]

    due_filter_response = client.get(
        "/api/tasks/",
        {"dueDate__lte": today.isoformat()},
    )
    assert due_filter_response.status_code == 200
    due_tasks = due_filter_response.json()
    assert [task["id"] for task in due_tasks] == [task_a["id"]]

    delete_response = client.delete(f"/api/tasks/{task_a['id']}/")
    assert delete_response.status_code == 204

    final_list = client.get("/api/tasks/")
    assert final_list.status_code == 200
    assert len(final_list.json()) == 1
