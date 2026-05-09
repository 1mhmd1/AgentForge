from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path


def _build_clean_env() -> dict:
    # Strip PYTHONPATH so generated agents can't import host modules.
    # Keep PATH (needed to find `python`) and SYSTEMROOT (Windows DLL loader).
    env = {
        "PATH": os.environ.get("PATH", ""),
        "PYTHONPATH": "",
        "PYTHONIOENCODING": "utf-8",
    }
    if sys.platform == "win32":
        # Windows subprocesses crash without these system vars.
        for key in ("SYSTEMROOT", "SYSTEMDRIVE", "TEMP", "TMP", "USERPROFILE"):
            value = os.environ.get(key)
            if value:
                env[key] = value
    return env


SKIP_EXECUTION_EXTENSIONS = {
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".html",
    ".css",
    ".json",
    ".md",
    ".txt",
    ".env.example",
    ".yaml",
    ".yml",
    ".toml",
}


def _truncate_output(text: str, limit: int = 10000) -> tuple[str, bool]:
    if len(text) <= limit:
        return text, False
    return text[:limit] + "\n...[truncated]", True


def _normalize_path(path: str, workdir: str | None = None) -> Path:
    file_path = Path(path)
    if file_path.is_absolute() or workdir is None:
        return file_path.resolve()
    return (Path(workdir) / file_path).resolve()


def validate_execution(path: str, workdir: str | None = None) -> dict:
    started_at = time.perf_counter()
    resolved_path = _normalize_path(path, workdir)
    extension = resolved_path.name.lower()

    result = {
        "valid": False,
        "exit_code": -1,
        "stdout": "",
        "stderr": "",
        "execution_time": 0.0,
        "output_truncated": False,
        "skipped": False,
        "skip_reason": None,
        "error": None,
    }

    try:
        if not resolved_path.exists():
            result["error"] = "file_not_found"
            return result

        if not resolved_path.is_file():
            result["error"] = "path_is_not_a_file"
            return result

        if not extension.endswith(".py"):
            result["valid"] = True
            result["skipped"] = True
            result["skip_reason"] = "execution_only_applies_to_python"
            result["execution_time"] = round(time.perf_counter() - started_at, 4)
            return result

        with tempfile.TemporaryDirectory() as temp_dir:
            temp_dir_path = Path(temp_dir)
            copied_path = temp_dir_path / resolved_path.name
            shutil.copy2(resolved_path, copied_path)

            try:
                completed = subprocess.run(
                    ["python", str(copied_path)],
                    cwd=temp_dir,
                    capture_output=True,
                    text=True,
                    timeout=15,
                    env=_build_clean_env(),
                )
                stdout, stdout_truncated = _truncate_output(completed.stdout or "")
                stderr, stderr_truncated = _truncate_output(completed.stderr or "")
                result["stdout"] = stdout
                result["stderr"] = stderr
                result["output_truncated"] = stdout_truncated or stderr_truncated
                result["exit_code"] = completed.returncode
                result["valid"] = completed.returncode == 0
                if not result["valid"]:
                    result["error"] = (completed.stderr or completed.stdout or "execution_failed").strip()
            except subprocess.TimeoutExpired as exc:
                stdout, stdout_truncated = _truncate_output(str(getattr(exc, "stdout", "") or ""))
                stderr, stderr_truncated = _truncate_output(str(getattr(exc, "stderr", "") or ""))
                result["stdout"] = stdout
                result["stderr"] = stderr
                result["output_truncated"] = stdout_truncated or stderr_truncated
                result["error"] = "TimeoutExpired"
            except FileNotFoundError as exc:
                result["error"] = str(exc)
            except Exception as exc:
                result["error"] = str(exc)

        result["execution_time"] = round(time.perf_counter() - started_at, 4)
        return result
    except (TypeError, ValueError) as exc:
        result["error"] = str(exc)
        result["execution_time"] = round(time.perf_counter() - started_at, 4)
        return result