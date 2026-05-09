from __future__ import annotations

import os
from pathlib import Path


ALLOWED_EXTENSIONS = (
    ".py",
    ".json",
    ".md",
    ".txt",
    ".html",
    ".css",
    ".js",
    ".ts",
    ".tsx",
    ".jsx",
    ".env.example",
    ".yaml",
    ".yml",
    ".toml",
)


def _is_allowed_extension(path: Path) -> bool:
    name = path.name.lower()
    return any(name.endswith(extension) for extension in ALLOWED_EXTENSIONS)


def validate_file(path: str) -> dict:
    exists = False
    readable = False
    empty = False
    extension_allowed = False
    error: str | None = None

    try:
        file_path = Path(path)
        exists = file_path.exists()
        extension_allowed = _is_allowed_extension(file_path)

        if not exists:
            error = "file_not_found"
        elif not file_path.is_file():
            error = "path_is_not_a_file"
        else:
            readable = os.access(file_path, os.R_OK)
            if not readable:
                error = "file_not_readable"
            else:
                empty = file_path.stat().st_size == 0
                if empty:
                    error = "file_empty"
                elif not extension_allowed:
                    error = "extension_not_allowed"
    except (TypeError, ValueError, OSError) as exc:
        error = str(exc)

    valid = exists and readable and not empty and extension_allowed and error is None
    return {
        "valid": valid,
        "exists": exists,
        "readable": readable,
        "empty": empty,
        "extension_allowed": extension_allowed,
        "error": error,
    }