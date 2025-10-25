"""Integration tests covering the public authentication API."""
import pytest


@pytest.mark.django_db
def test_register_login_and_me_flow(api_client):
    register_payload = {
        "email": "new-user@example.com",
        "password": "Str0ngPass!234",
        "name": "New User",
    }

    register_response = api_client.post(
        "/api/auth/register/",
        data=register_payload,
        format="json",
    )
    assert register_response.status_code == 201, register_response.content
    register_data = register_response.json()
    assert "access" in register_data and "refresh" in register_data

    login_response = api_client.post(
        "/api/auth/login/",
        data={
            "email": register_payload["email"],
            "password": register_payload["password"],
        },
        format="json",
    )
    assert login_response.status_code == 200, login_response.content
    login_data = login_response.json()
    access_token = login_data["access"]
    assert "refresh" in login_data

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")
    me_response = api_client.get("/api/auth/me/")
    assert me_response.status_code == 200, me_response.content
    me_data = me_response.json()

    assert {"id", "email", "profile"} <= me_data.keys()
    assert me_data["email"] == register_payload["email"]
    profile = me_data["profile"]
    assert {"name", "avatarUrl", "theme", "language", "aiResponseStyle"} <= profile.keys()
    assert profile["name"] == register_payload["name"]
