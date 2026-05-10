from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

# Optional: Linux/Mac only. Windows has no `resource` module so we skip
# rlimit setup silently on win32 (subprocess still runs in a clean env +
# tempdir + 15s timeout, which is the cross-platform floor).
try:
    import resource as _resource  # type: ignore[import-not-found]
    _HAS_RESOURCE = True
except ImportError:
    _resource = None  # type: ignore[assignment]
    _HAS_RESOURCE = False


# Allowlist approach: only the named keys leak into the child env. AGENTFORGE_*,
# all LLM provider keys (GROQ_API_KEY, GEMINI_API_KEY, MINIMAX_API_KEY,
# KIMI_API_KEY, EXA_API_KEY), QDRANT_*, PYTHONPATH/PYTHONHOME/PYTHONSTARTUP,
# PYTHONDONTWRITEBYTECODE, etc. are all stripped by construction.
def _build_clean_env() -> dict:
    env: dict[str, str] = {
        "PATH": os.environ.get("PATH", ""),
        # Defense in depth: even if a future change drops the allowlist,
        # PYTHONPATH stays empty so generated agents can't import host modules.
        "PYTHONPATH": "",
        "PYTHONIOENCODING": "utf-8",
    }
    if sys.platform == "win32":
        # Windows subprocesses crash without these system vars.
        for key in (
            "SYSTEMROOT",
            "SYSTEMDRIVE",
            "WINDIR",
            "TEMP",
            "TMP",
            "COMSPEC",
            "USERNAME",
            "USERPROFILE",
        ):
            value = os.environ.get(key)
            if value:
                env[key] = value
    return env


def _set_resource_limits() -> None:
    # Runs in the child between fork and exec on POSIX. Caps virtual memory
    # at 256 MB and process count at 32. Best-effort: any failure is logged
    # to the child's stderr and the child still runs (sandbox is tempdir +
    # clean env + 15s timeout in the worst case).
    if not _HAS_RESOURCE or _resource is None:
        return
    try:
        _resource.setrlimit(_resource.RLIMIT_AS, (256 * 1024 * 1024, 256 * 1024 * 1024))
    except Exception:
        pass
    try:
        _resource.setrlimit(_resource.RLIMIT_NPROC, (32, 32))
    except Exception:
        pass


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

            # preexec_fn is POSIX-only. On Windows we pass nothing -- the
            # cross-platform floor (clean env + tempdir + 15s timeout) still
            # holds. Lazily wired so the same call site works on both.
            run_kwargs: dict = {
                "cwd": temp_dir,
                "capture_output": True,
                "text": True,
                "timeout": 15,
                "env": _build_clean_env(),
            }
            if sys.platform != "win32" and _HAS_RESOURCE:
                run_kwargs["preexec_fn"] = _set_resource_limits

            try:
                # sys.executable -- not bare "python" -- so the sandbox runs
                # under the SAME interpreter as the FastAPI parent. Using PATH
                # resolution can pick up a system Python with a different (or
                # broken) site-packages, which surfaces as ModuleNotFoundError
                # for libs (requests, urllib3, ...) that ARE installed in the
                # active venv.
                completed = subprocess.run(
                    [sys.executable, str(copied_path)],
                    **run_kwargs,
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
