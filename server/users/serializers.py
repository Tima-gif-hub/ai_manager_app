"""Serializers for user management."""
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import UserProfile, UserSettings

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """Expose the subset of user fields needed by the frontend."""

    name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "email", "name"]
        read_only_fields = ["id", "email", "name"]

    def get_name(self, obj: User) -> str:
        if obj.first_name and obj.last_name:
            return f"{obj.first_name} {obj.last_name}".strip()
        if obj.first_name:
            return obj.first_name
        return obj.email


class RegisterSerializer(serializers.Serializer):
    """Validate and create a new user."""

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    name = serializers.CharField(max_length=150)

    def validate_email(self, value: str) -> str:
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def validate_password(self, value: str) -> str:
        validate_password(value)
        return value

    def create(self, validated_data):
        name = validated_data["name"].strip()
        first_name = name
        last_name = ""
        if " " in name:
            first_name, last_name = name.split(" ", 1)

        user = User.objects.create_user(
            username=validated_data["email"],
            email=validated_data["email"],
            password=validated_data["password"],
            first_name=first_name,
            last_name=last_name,
        )
        # Ensure profile/settings exist for the new user
        UserProfile.objects.get_or_create(user=user)
        UserSettings.objects.get_or_create(user=user)
        return user


class UserProfileSerializer(serializers.ModelSerializer):
    """Read/write serializer for the extended profile."""

    name = serializers.CharField(source="display_name", allow_blank=True, required=False)

    class Meta:
        model = UserProfile
        fields = ["name", "avatar_url"]

    def update(self, instance, validated_data):
        display_name = validated_data.get("display_name", instance.display_name)
        avatar_url = validated_data.get("avatar_url", instance.avatar_url)

        instance.display_name = display_name
        instance.avatar_url = avatar_url
        instance.save()

        # Keep the base user record in sync with the chosen display name.
        if display_name is not None:
            parts = display_name.strip().split(" ", 1) if display_name else []
            first_name = parts[0] if parts else ""
            last_name = parts[1] if len(parts) > 1 else ""
            user = instance.user
            user.first_name = first_name
            user.last_name = last_name
            user.save(update_fields=["first_name", "last_name"])

        return instance


class UserSettingsSerializer(serializers.ModelSerializer):
    """Persisted UI and AI preferences."""

    class Meta:
        model = UserSettings
        fields = ["theme", "ai_response_style", "language"]
