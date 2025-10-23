"""Service layer for interacting with the AI assistant provider."""
from __future__ import annotations

import os
from typing import Iterable, Mapping, Sequence


def ask_assistant(message: str, tasks: Sequence[Mapping[str, object]] | None = None) -> str:
    """Return the assistant reply for the given prompt.

    The provider integration will be implemented later. For now we return a
    deterministic stub response so the rest of the stack (validation,
    persistence, frontend wiring) can be exercised.
    """

    api_key = os.getenv("OPENAI_API_KEY")
    # Placeholder for the future real provider integration.
    return _build_stub_response(message=message, tasks=tasks, api_key_exists=bool(api_key))


def _build_stub_response(
    *,
    message: str,
    tasks: Iterable[Mapping[str, object]] | None,
    api_key_exists: bool,
) -> str:
    """Compose a lightweight stub response summarising the request."""

    intro = (
        "Assistant (stub with OPENAI_API_KEY configured): "
        if api_key_exists
        else "Assistant (stub): "
    )
    tasks_summary = ""
    if tasks:
        titles = [str(task.get("title", "")).strip() or f"Task #{task.get('id', '?')}" for task in tasks]
        tasks_summary = f" Relevant tasks: {', '.join(titles)}."
    return f"{intro}{message.strip()}{tasks_summary}"

