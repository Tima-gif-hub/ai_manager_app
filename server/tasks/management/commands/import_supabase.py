"""Import data exported from Supabase CSV dumps into the local database.

The command focuses on four datasets:
    * tasks
    * ai_history
    * profiles
    * user_settings

Each dataset is optional – pass only the CSV paths you need. The command
preserves primary keys when possible, matches Supabase users to Django users
via an email (default) or another field, and can run in dry-run mode.
"""
from __future__ import annotations

import csv
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Iterable, Mapping, MutableMapping, Optional, Sequence

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Model
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime

from ai.models import AIHistory
from tasks.models import Task
from users.models import Profile

User = get_user_model()


class DryRunRollback(Exception):
    """Internal exception used to abort the transaction in dry-run mode."""


@dataclass
class ImportSummary:
    """Keep track of per-dataset statistics."""

    dataset: str
    path: Path
    processed: int = 0
    created: int = 0
    updated: int = 0
    skipped: int = 0
    missing_users: int = 0
    errors: int = 0
    expected_total: int = 0
    final_total: Optional[int] = None

    def as_message(self) -> str:
        """Return a human-readable summary line."""
        final_count = (
            "n/a" if self.final_total is None else str(self.final_total)
        )
        return (
            f"[{self.dataset}] {self.processed}/{self.expected_total} processed, "
            f"{self.created} created, {self.updated} updated, {self.skipped} skipped, "
            f"{self.missing_users} missing-user, {self.errors} errors. "
            f"DB total: {final_count}"
        )


class Command(BaseCommand):
    """Management command entry-point."""

    help = (
        "Import Supabase CSV exports (tasks, ai_history, profiles, user_settings) "
        "into the Django models while preserving legacy identifiers where possible."
    )

    DEFAULT_TASK_COLUMNS = {
        "id": "id",
        "title": "title",
        "description": "description",
        "due_date": "due_date",
        "priority": "priority",
        "status": "status",
        "created_at": "created_at",
        "updated_at": "updated_at",
    }
    DEFAULT_HISTORY_COLUMNS = {
        "id": "id",
        "title": "title",
        "query": "query",
        "prompt": "query",
        "request": "query",
        "response": "response",
        "created_at": "created_at",
    }
    DEFAULT_PROFILE_COLUMNS = {
        "name": "name",
        "full_name": "name",
        "display_name": "name",
        "avatar_url": "avatar_url",
        "avatar": "avatar_url",
        "theme": "theme",
        "language": "language",
        "ai_response_style": "ai_response_style",
        "ai_style": "ai_response_style",
    }
    DEFAULT_SETTINGS_COLUMNS = {
        "theme": "theme",
        "language": "language",
        "ai_response_style": "ai_response_style",
        "ai_style": "ai_response_style",
    }

    USER_COLUMN_FALLBACKS: Sequence[str] = (
        "user_email",
        "email",
        "user_id",
        "user_uuid",
        "user",
        "owner",
    )

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "--tasks-csv",
            dest="tasks_csv",
            help="Path to the Supabase tasks CSV export.",
        )
        parser.add_argument(
            "--ai-history-csv",
            dest="ai_history_csv",
            help="Path to the Supabase AI history CSV export.",
        )
        parser.add_argument(
            "--profiles-csv",
            dest="profiles_csv",
            help="Path to the Supabase profiles CSV export.",
        )
        parser.add_argument(
            "--user-settings-csv",
            dest="user_settings_csv",
            help="Path to the Supabase user_settings CSV export.",
        )
        parser.add_argument(
            "--user-column",
            dest="user_column",
            default=None,
            help=(
                "CSV column used for user matching. Defaults to an auto-detected "
                "column among user_email, email, user_id, user_uuid."
            ),
        )
        parser.add_argument(
            "--user-field",
            dest="user_field",
            default="email",
            help=(
                "Django user field used for lookups (e.g. email, username, id, "
                "profile__external_id). Defaults to 'email'."
            ),
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            dest="dry_run",
            help="Parse CSV files and report actions without writing to the database.",
        )
        parser.add_argument(
            "--encoding",
            dest="encoding",
            default="utf-8",
            help="File encoding for the CSV exports (default: utf-8).",
        )

    def handle(self, *args, **options) -> None:
        csv_paths = {
            "tasks": options.get("tasks_csv"),
            "ai_history": options.get("ai_history_csv"),
            "profiles": options.get("profiles_csv"),
            "user_settings": options.get("user_settings_csv"),
        }
        encoding = options["encoding"]
        dry_run = options["dry_run"]
        user_field = options["user_field"]
        user_column_option = options.get("user_column")

        path_objects: dict[str, Path] = {}
        for key, value in csv_paths.items():
            if value:
                path = Path(value).expanduser()
                if not path.exists():
                    raise CommandError(f"{key} CSV not found: {path}")
                path_objects[key] = path

        if not path_objects:
            raise CommandError(
                "Provide at least one CSV path (tasks, ai-history, profiles, user-settings)."
            )

        self._user_cache: dict[tuple[str, str], Optional[User]] = {}

        self.stdout.write(
            self.style.WARNING("Dry run enabled – no changes will be committed.")
            if dry_run
            else self.style.SUCCESS("Starting Supabase import.")
        )

        summaries: list[ImportSummary] = []
        try:
            with transaction.atomic():
                if "tasks" in path_objects:
                    summaries.append(
                        self._import_tasks(
                            path_objects["tasks"],
                            encoding=encoding,
                            user_field=user_field,
                            user_column=user_column_option,
                        )
                    )
                if "ai_history" in path_objects:
                    summaries.append(
                        self._import_ai_history(
                            path_objects["ai_history"],
                            encoding=encoding,
                            user_field=user_field,
                            user_column=user_column_option,
                        )
                    )
                profile_data_cache: dict[int, MutableMapping[str, object]] = {}
                if "profiles" in path_objects:
                    summaries.append(
                        self._import_profiles(
                            path_objects["profiles"],
                            encoding=encoding,
                            user_field=user_field,
                            user_column=user_column_option,
                            pending_profile_updates=profile_data_cache,
                        )
                    )
                if "user_settings" in path_objects:
                    summaries.append(
                        self._import_user_settings(
                            path_objects["user_settings"],
                            encoding=encoding,
                            user_field=user_field,
                            user_column=user_column_option,
                            pending_profile_updates=profile_data_cache,
                        )
                    )
                if profile_data_cache:
                    summaries.append(
                        self._flush_profile_updates(profile_data_cache)
                    )

                if dry_run:
                    self.stdout.write(
                        self.style.WARNING(
                            "Dry run complete. Rolling back any staged changes."
                        )
                    )
                    raise DryRunRollback()
        except DryRunRollback:
            pass

        self.stdout.write("")
        self.stdout.write(self.style.MIGRATE_HEADING("Import summary"))
        for summary in summaries:
            self.stdout.write(f" - {summary.as_message()}")

    # ------------------------------------------------------------------
    # Readers & helpers
    # ------------------------------------------------------------------
    def _read_csv(self, path: Path, *, encoding: str) -> list[dict[str, str]]:
        with path.open("r", encoding=encoding, newline="") as handle:
            reader = csv.DictReader(handle)
            rows = [row for row in reader if any(value.strip() for value in row.values() if value)]
        return rows

    def _resolve_user(
        self,
        row: Mapping[str, str],
        *,
        user_field: str,
        user_column_option: Optional[str],
        summary: ImportSummary,
    ) -> Optional[User]:
        column_candidates: Sequence[str]
        if user_column_option:
            column_candidates = (user_column_option, *self.USER_COLUMN_FALLBACKS)
        else:
            column_candidates = self.USER_COLUMN_FALLBACKS

        user_key: Optional[str] = None
        value: Optional[str] = None
        for key in column_candidates:
            if key in row and row[key]:
                user_key = key
                value = row[key].strip()
                break
        if not value:
            summary.skipped += 1
            summary.missing_users += 1
            return None

        lookup_value = value

        cache_key = (user_field, lookup_value)
        if cache_key in self._user_cache:
            cached = self._user_cache[cache_key]
            if cached is None:
                summary.skipped += 1
                summary.missing_users += 1
            return cached

        lookup_field = user_field
        lookup_kwargs: Mapping[str, object]

        if "__" in lookup_field:
            lookup_kwargs = {lookup_field: lookup_value}
        elif lookup_field.endswith("email"):
            lookup_kwargs = {f"{lookup_field}__iexact": lookup_value}
        elif lookup_field.endswith("id"):
            try:
                lookup_kwargs = {lookup_field: int(lookup_value)}
            except ValueError:
                summary.errors += 1
                summary.skipped += 1
                self.stderr.write(
                    self.style.ERROR(
                        f"Cannot convert value {lookup_value!r} to integer for field {lookup_field!r}."
                    )
                )
                self._user_cache[cache_key] = None
                return None
        else:
            lookup_kwargs = {lookup_field: lookup_value}

        try:
            user = User.objects.get(**lookup_kwargs)
        except User.DoesNotExist:
            summary.missing_users += 1
            summary.skipped += 1
            self.stderr.write(
                self.style.WARNING(
                    f"User not found ({lookup_field}={lookup_value!r}); skipping."
                )
            )
            self._user_cache[cache_key] = None
            return None
        except User.MultipleObjectsReturned:
            summary.errors += 1
            summary.skipped += 1
            self.stderr.write(
                self.style.ERROR(
                    f"Multiple users match ({lookup_field}={lookup_value!r}); skipping row."
                )
            )
            self._user_cache[cache_key] = None
            return None

        self._user_cache[cache_key] = user
        return user

    def _parse_int(self, value: Optional[str]) -> Optional[int]:
        if not value:
            return None
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    def _parse_date(self, value: Optional[str]) -> Optional[date]:
        if not value:
            return None
        parsed = parse_date(value)
        if parsed:
            return parsed
        try:
            return datetime.fromisoformat(value).date()
        except ValueError:
            return None

    def _parse_datetime(self, value: Optional[str]) -> Optional[datetime]:
        if not value:
            return None
        parsed = parse_datetime(value)
        if parsed:
            return timezone.make_aware(parsed, timezone.utc) if timezone.is_naive(parsed) else parsed
        try:
            parsed = datetime.fromisoformat(value)
        except ValueError:
            return None
        return timezone.make_aware(parsed, timezone.utc) if timezone.is_naive(parsed) else parsed

    def _valid_choice(self, value: Optional[str], choices: Iterable[str]) -> Optional[str]:
        if not value:
            return None
        value = value.strip().lower()
        return value if value in choices else None

    # ------------------------------------------------------------------
    # Dataset importers
    # ------------------------------------------------------------------
    def _import_tasks(
        self,
        path: Path,
        *,
        encoding: str,
        user_field: str,
        user_column: Optional[str],
    ) -> ImportSummary:
        rows = self._read_csv(path, encoding=encoding)
        summary = ImportSummary(dataset="tasks", path=path, expected_total=len(rows))
        priorities = {choice for choice, _ in Task.Priority.choices}
        statuses = {choice for choice, _ in Task.Status.choices}

        for row in rows:
            summary.processed += 1
            user = self._resolve_user(
                row,
                user_field=user_field,
                user_column_option=user_column,
                summary=summary,
            )
            if not user:
                continue

            task_id = self._parse_int(row.get("id"))
            task_data: dict[str, object] = {"user": user}

            for source, target in self.DEFAULT_TASK_COLUMNS.items():
                if source not in row or row[source] in (None, ""):
                    continue
                value = row[source]
                if target == "due_date":
                    parsed_date = self._parse_date(value)
                    if parsed_date:
                        task_data[target] = parsed_date
                elif target in {"created_at", "updated_at"}:
                    parsed_dt = self._parse_datetime(value)
                    if parsed_dt:
                        task_data[target] = parsed_dt
                elif target == "priority":
                    normalized = self._valid_choice(value, priorities)
                    if normalized:
                        task_data[target] = normalized
                elif target == "status":
                    normalized = self._valid_choice(value, statuses)
                    if normalized:
                        task_data[target] = normalized
                else:
                    task_data[target] = value

            if "title" not in task_data:
                self.stderr.write(
                    self.style.WARNING(
                        f"Skipping task row without title (id={task_id!r})."
                    )
                )
                summary.skipped += 1
                continue

            try:
                if task_id:
                    obj, created = Task.objects.update_or_create(
                        pk=task_id,
                        defaults=task_data,
                    )
                else:
                    obj = Task.objects.create(**task_data)
                    created = True
                if created:
                    summary.created += 1
                else:
                    summary.updated += 1
                if "created_at" in task_data or "updated_at" in task_data:
                    update_fields = {
                        key: value
                        for key, value in task_data.items()
                        if key in {"created_at", "updated_at"}
                    }
                    if update_fields:
                        Task.objects.filter(pk=obj.pk).update(**update_fields)
            except Exception as exc:  # pragma: no cover - defensive logging
                summary.errors += 1
                self.stderr.write(
                    self.style.ERROR(
                        f"Failed to import task row (id={task_id!r}): {exc}"
                    )
                )

        summary.final_total = Task.objects.count()
        return summary

    def _import_ai_history(
        self,
        path: Path,
        *,
        encoding: str,
        user_field: str,
        user_column: Optional[str],
    ) -> ImportSummary:
        rows = self._read_csv(path, encoding=encoding)
        summary = ImportSummary(
            dataset="ai_history",
            path=path,
            expected_total=len(rows),
        )
        for row in rows:
            summary.processed += 1
            user = self._resolve_user(
                row,
                user_field=user_field,
                user_column_option=user_column,
                summary=summary,
            )
            if not user:
                continue

            history_id = self._parse_int(row.get("id"))
            history_data: dict[str, object] = {"user": user}

            query = (
                row.get("query")
                or row.get("prompt")
                or row.get("request")
                or ""
            )
            response = row.get("response") or ""
            title = row.get("title") or query[:60] or "Conversation"

            history_data.update(
                {
                    "title": title,
                    "query": query,
                    "response": response,
                }
            )

            created_at = self._parse_datetime(row.get("created_at"))
            if created_at:
                history_data["created_at"] = created_at

            try:
                if history_id:
                    obj, created = AIHistory.objects.update_or_create(
                        pk=history_id,
                        defaults=history_data,
                    )
                else:
                    obj = AIHistory.objects.create(**history_data)
                    created = True
                if created:
                    summary.created += 1
                else:
                    summary.updated += 1
                if created_at:
                    AIHistory.objects.filter(pk=obj.pk).update(created_at=created_at)
            except Exception as exc:  # pragma: no cover - defensive logging
                summary.errors += 1
                self.stderr.write(
                    self.style.ERROR(
                        f"Failed to import AI history row (id={history_id!r}): {exc}"
                    )
                )

        summary.final_total = AIHistory.objects.count()
        return summary

    def _import_profiles(
        self,
        path: Path,
        *,
        encoding: str,
        user_field: str,
        user_column: Optional[str],
        pending_profile_updates: MutableMapping[int, MutableMapping[str, object]],
    ) -> ImportSummary:
        rows = self._read_csv(path, encoding=encoding)
        summary = ImportSummary(
            dataset="profiles",
            path=path,
            expected_total=len(rows),
        )

        for row in rows:
            summary.processed += 1
            user = self._resolve_user(
                row,
                user_field=user_field,
                user_column_option=user_column,
                summary=summary,
            )
            if not user:
                continue

            profile_data: dict[str, object] = {}
            for source, target in self.DEFAULT_PROFILE_COLUMNS.items():
                value = row.get(source)
                if value in (None, ""):
                    continue
                profile_data[target] = value

            profile_id = self._parse_int(row.get("id"))
            if profile_id:
                profile_data["id"] = profile_id

            pending = pending_profile_updates.setdefault(user.pk, {})
            pending.update(profile_data)

        summary.final_total = Profile.objects.count()
        return summary

    def _import_user_settings(
        self,
        path: Path,
        *,
        encoding: str,
        user_field: str,
        user_column: Optional[str],
        pending_profile_updates: MutableMapping[int, MutableMapping[str, object]],
    ) -> ImportSummary:
        rows = self._read_csv(path, encoding=encoding)
        summary = ImportSummary(
            dataset="user_settings",
            path=path,
            expected_total=len(rows),
        )

        for row in rows:
            summary.processed += 1
            user = self._resolve_user(
                row,
                user_field=user_field,
                user_column_option=user_column,
                summary=summary,
            )
            if not user:
                continue

            settings_data: dict[str, object] = {}
            for source, target in self.DEFAULT_SETTINGS_COLUMNS.items():
                value = row.get(source)
                if value in (None, ""):
                    continue
                settings_data[target] = value

            pending = pending_profile_updates.setdefault(user.pk, {})
            pending.update(settings_data)

        summary.final_total = Profile.objects.count()
        return summary

    def _flush_profile_updates(
        self,
        pending_profile_updates: Mapping[int, Mapping[str, object]],
    ) -> ImportSummary:
        summary = ImportSummary(
            dataset="profiles/save",
            path=Path("<aggregated>"),
            expected_total=len(pending_profile_updates),
        )
        for user_pk, data in pending_profile_updates.items():
            summary.processed += 1
            try:
                profile, created = Profile.objects.get_or_create(user_id=user_pk)
                if "id" in data and data["id"]:
                    desired_id = self._parse_int(str(data["id"]))
                    if desired_id and profile.pk != desired_id:
                        # Reassigning PK requires direct update.
                        Profile.objects.filter(pk=profile.pk).update(id=desired_id)
                        profile = Profile.objects.get(pk=desired_id)
                update_fields: list[str] = []
                for field in ("name", "avatar_url", "theme", "language", "ai_response_style"):
                    if field in data:
                        value = data[field]
                        if getattr(profile, field) != value:
                            setattr(profile, field, value)
                            update_fields.append(field)
                if update_fields:
                    profile.save(update_fields=update_fields)
                    summary.updated += 1 if not created else 0
                    summary.created += 1 if created else 0
                else:
                    if created:
                        summary.created += 1
                    else:
                        summary.skipped += 1
            except Exception as exc:  # pragma: no cover - defensive logging
                summary.errors += 1
                self.stderr.write(
                    self.style.ERROR(
                        f"Failed to update profile for user_id={user_pk}: {exc}"
                    )
                )
        summary.final_total = Profile.objects.count()
        return summary
