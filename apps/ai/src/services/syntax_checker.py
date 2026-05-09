from __future__ import annotations

import ast
import subprocess
import tempfile
from pathlib import Path


SKIP_SYNTAX_EXTENSIONS = {
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


def _truncate_output(text: str, limit: int = 2000) -> str:
    if len(text) <= limit:
        return text
    return text[:limit] + "\n...[truncated]"


def _normalize_extension(file_ext: str) -> str:
    if not file_ext:
        return ""
    ext = file_ext.strip().lower()
    if not ext.startswith("."):
        ext = "." + ext
    return ext


def _language_from_extension(file_ext: str) -> str:
    mapping = {
        ".py": "python",
        ".js": "javascript",
        ".jsx": "javascript",
        ".ts": "typescript",
        ".tsx": "typescript",
        ".html": "html",
        ".css": "css",
        ".json": "json",
        ".md": "markdown",
        ".txt": "text",
        ".env.example": "env",
        ".yaml": "yaml",
        ".yml": "yaml",
        ".toml": "toml",
    }
    return mapping.get(file_ext, file_ext.lstrip(".") or "unknown")


def validate_syntax(code: str, file_ext: str = ".py") -> dict:
    normalized_ext = _normalize_extension(file_ext)
    language = _language_from_extension(normalized_ext)

    result = {
        "valid": False,
        "language": language,
        "error": None,
        "stdout": "",
        "stderr": "",
    }

    try:
        if not isinstance(code, str):
            raise TypeError("code must be a string")

        if normalized_ext == ".py":
            tree = ast.parse(code)
            compile(tree, "<validator>", "exec")
            result["valid"] = True
            return result

        if normalized_ext in {".js", ".jsx", ".ts", ".tsx"}:
            with tempfile.TemporaryDirectory() as temp_dir:
                temp_path = Path(temp_dir) / f"snippet{normalized_ext}"
                temp_path.write_text(code, encoding="utf-8")

                if normalized_ext in {".js", ".jsx"}:
                    completed = subprocess.run(
                        ["node", "--check", str(temp_path)],
                        capture_output=True,
                        text=True,
                        timeout=15,
                    )
                else:
                    completed = subprocess.run(
                        ["npx", "tsc", "--noEmit", str(temp_path)],
                        capture_output=True,
                        text=True,
                        timeout=15,
                    )

                stdout = completed.stdout or ""
                stderr = completed.stderr or ""
                result["stdout"] = _truncate_output(stdout)
                result["stderr"] = _truncate_output(stderr)
                result["valid"] = completed.returncode == 0
                if not result["valid"]:
                    result["error"] = (stderr or stdout or "syntax_check_failed").strip()
                return result

        if normalized_ext in SKIP_SYNTAX_EXTENSIONS:
            result["valid"] = True
            return result

        result["error"] = f"unsupported_extension:{normalized_ext or file_ext}"
        return result
    except (SyntaxError, ValueError, TypeError, subprocess.TimeoutExpired) as exc:
        result["error"] = str(exc)
        if isinstance(exc, subprocess.TimeoutExpired):
            result["stderr"] = _truncate_output(str(getattr(exc, "stderr", "") or ""))
            result["stdout"] = _truncate_output(str(getattr(exc, "output", "") or ""))
        return result
    except OSError as exc:
        result["error"] = str(exc)
        return result
    except Exception as exc:
        result["error"] = str(exc)
        return result