"""URL configuration for the core project."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from django.contrib import admin

from core.views import health_check
from tasks.views import TaskViewSet
from ai.views import AIHistoryViewSet
from users.views import MeView, LoginView, LogoutView, RegisterView, UserProfileView, UserSettingsView
from rest_framework_simplejwt.views import TokenRefreshView

router = DefaultRouter()
router.register("tasks", TaskViewSet, basename="task")
router.register("ai/history", AIHistoryViewSet, basename="ai-history")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health_check, name="health-check"),
    path("api/auth/register/", RegisterView.as_view(), name="auth-register"),
    path("api/auth/login/", LoginView.as_view(), name="auth-login"),
    path("api/auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path("api/auth/me/", MeView.as_view(), name="auth-me"),
    path("api/auth/refresh/", TokenRefreshView.as_view(), name="auth-refresh"),
    path("api/profile/", UserProfileView.as_view(), name="profile"),
    path("api/settings/", UserSettingsView.as_view(), name="settings"),
    path("api/", include(router.urls)),
]
