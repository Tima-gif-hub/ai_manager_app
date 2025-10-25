"""Shared pytest fixtures for Django REST API tests."""
import uuid

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken


@pytest.fixture
def api_client() -> APIClient:
    """Return an unauthenticated API client."""
    return APIClient()


@pytest.fixture
def user_password() -> str:
    """Provide a reusable strong password for test users."""
    return "StrongPass123!"


@pytest.fixture
def user_factory(user_password: str):
    """Create users with unique emails for each test case."""

    def _create_user(**overrides):
        email = overrides.pop("email", f"user-{uuid.uuid4().hex}@example.com")
        password = overrides.pop("password", user_password)
        username = overrides.pop("username", email)
        user_model = get_user_model()
        return user_model.objects.create_user(
            email=email,
            username=username,
            password=password,
            **overrides,
        )

    return _create_user


@pytest.fixture
def auth_client(user_factory):
    """Return an authenticated API client along with the related user."""
    user = user_factory()
    client = APIClient()
    refresh = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
    return client, user
