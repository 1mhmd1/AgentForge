"""
Playwright MCP based visual QA for the website_builder domain.

Off by default. Set AGENTFORGE_MCP_BROWSER=1 to enable. The validator engine
calls run_browser_validation after execution_validation passes when the domain
is website_builder.

Behavior:
- Re-runs the generated agent in a managed temp dir so the HTML output file
  survives long enough to navigate to.
- Connects to @playwright/mcp via direct node invocation against the cached
  cli.js entry point (npx-stdio handshake is unreliable on Windows; direct
  node is what the probe verified works).
- Captures browser console errors and an accessibility snapshot.
- Returns a structured finding dict. NEVER raises. Failures are returned as
  warnings; this stage never flips validation_status.

Reads / writes no state. Pure function: agent_path + run_id -> findings dict.
"""

from __future__ import annotations

import asyncio
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Any

# Lazy mcp import so validator_engine stays importable if SDK or browser is
# missing. The browser_validator gracefully degrades to a warning.
try:
    from mcp import ClientSession
    from mcp.client.stdio import StdioServerParameters, stdio_client
    _MCP_AVAILABLE = True
except Exception:
    _MCP_AVAILABLE = False


_BROWSER_TIMEOUT_S = 45
_AGENT_TIMEOUT_S = 15


def is_enabled() -> bool:
    return os.environ.get("AGENTFORGE_MCP_BROWSER", "0") == "1"


def _find_playwright_mcp_entry() -> str | None:
    # Walk the npx cache to find @playwright/mcp/cli.js. The cache hash
    # changes across npm versions, so don't hardcode it.
    candidates: list[Path] = []
    if sys.platform == "win32":
        candidates.append(Path.home() / "AppData" / "Local" / "npm-cache" / "_npx")
    candidates.append(Path.home() / ".npm" / "_npx")
    for cache in candidates:
        if not cache.is_dir():
            continue
        for d in cache.iterdir():
            entry = d / "node_modules" / "@playwright" / "mcp" / "cli.js"
            if entry.is_file():
                return str(entry)
    return None


def _warm_npx_cache() -> str | None:
    # First-run cache populator. Called only if entry not found. Runs npx
    # briefly so the package is downloaded; then walks the cache again.
    npx = "npx.cmd" if sys.platform == "win32" else "npx"
    try:
        # We expect this to hang (MCP server speaks JSON-RPC on launch, no
        # --version flag). Give it 30s to download then kill.
        subprocess.run(
            [npx, "-y", "@playwright/mcp@latest"],
            capture_output=True,
            text=True,
            timeout=30,
            shell=False,
        )
    except subprocess.TimeoutExpired:
        pass  # expected; cache should be warm now
    except Exception:
        return None
    return _find_playwright_mcp_entry()


def _run_agent_capture_html(agent_path: str, run_id: str, domain: str) -> tuple[str | None, str | None]:
    # Run the generated agent in a managed temp dir we keep alive. Returns
    # (html_file_path, error). Caller is responsible for the cleanup_workdir.
    agent_file = Path(agent_path)
    if not agent_file.is_file():
        return None, "agent_file_missing"

    workdir = Path(tempfile.mkdtemp(prefix="browser_qa_"))
    try:
        copied = workdir / agent_file.name
        shutil.copy2(agent_file, copied)

        # Reuse the same clean-env construction as execution_checker, inlined
        # to avoid a cross-service import cycle.
        env = {
            "PATH": os.environ.get("PATH", ""),
            "PYTHONPATH": "",
            "PYTHONIOENCODING": "utf-8",
        }
        if sys.platform == "win32":
            for key in ("SYSTEMROOT", "SYSTEMDRIVE", "WINDIR", "TEMP", "TMP", "COMSPEC", "USERNAME", "USERPROFILE"):
                value = os.environ.get(key)
                if value:
                    env[key] = value

        try:
            subprocess.run(
                [sys.executable, str(copied)],
                cwd=str(workdir),
                capture_output=True,
                text=True,
                timeout=_AGENT_TIMEOUT_S,
                env=env,
            )
        except subprocess.TimeoutExpired:
            return None, "agent_execution_timeout"
        except Exception as exc:
            return None, f"agent_execution_failed:{type(exc).__name__}:{str(exc)[:120]}"

        # Locate the HTML file. Agent template writes to output/<RUN_ID>_<DOMAIN>.html
        expected = workdir / "output" / f"{run_id}_{domain}.html"
        if expected.is_file():
            return str(expected), None

        # Fallback: glob any html in output/. Agent may have produced a
        # differently-named file if the template ever shifts.
        output_dir = workdir / "output"
        if output_dir.is_dir():
            html_files = list(output_dir.glob("*.html"))
            if html_files:
                return str(html_files[0]), None

        return None, "html_output_not_found"
    except Exception as exc:
        return None, f"prepare_failed:{type(exc).__name__}"


async def _drive_playwright(entry_js: str, html_path: str, workdir: str) -> dict[str, Any]:
    # Single MCP session: launch browser, navigate file://, gather console
    # errors and a11y snapshot, close. Each call wrapped in try so partial
    # failures still return useful findings.
    # cwd=workdir confines Playwright MCP's .playwright-mcp/ artifact dir
    # to our managed tempdir so it gets rmtree'd with everything else.
    findings: dict[str, Any] = {
        "navigated": False,
        "console_error_count": 0,
        "console_errors": [],
        "snapshot_chars": 0,
        "warnings": [],
    }

    params = StdioServerParameters(command="node", args=[entry_js], env=os.environ.copy(), cwd=workdir)
    file_url = "file:///" + html_path.replace("\\", "/").lstrip("/")

    async with stdio_client(params) as (r, w):
        async with ClientSession(r, w) as s:
            await s.initialize()

            # Navigate
            try:
                await s.call_tool("browser_navigate", {"url": file_url})
                findings["navigated"] = True
            except Exception as exc:
                findings["warnings"].append(f"navigate_failed:{type(exc).__name__}")
                return findings

            # A short settle so console / DOM are stable.
            try:
                await s.call_tool("browser_wait_for", {"time": 1})
            except Exception:
                pass

            # Console errors (browser_console_messages requires 'level').
            # Playwright MCP returns a "### Result\nTotal messages: N (Errors: M, ...)"
            # summary even when M is 0, plus one item per real message. Parse
            # the (Errors: M) count from the summary to get the truth.
            try:
                import re
                console = await s.call_tool("browser_console_messages", {"level": "error"})
                raw_blobs: list[str] = []
                for item in (console.content or []):
                    text = getattr(item, "text", "")
                    if isinstance(text, str) and text.strip():
                        raw_blobs.append(text.strip())
                # Default to 0 errors. If we can parse the summary, trust it.
                err_count = 0
                summary_match = re.search(r"Errors:\s*(\d+)", " ".join(raw_blobs))
                if summary_match:
                    err_count = int(summary_match.group(1))
                # Drop the summary line(s) from the error-detail list.
                detail_lines = [b for b in raw_blobs if not b.lstrip("#").strip().lower().startswith(("result", "total messages"))]
                findings["console_errors"] = detail_lines[:10]
                findings["console_error_count"] = err_count
            except Exception as exc:
                findings["warnings"].append(f"console_failed:{type(exc).__name__}")

            # Accessibility snapshot (better than screenshot for analysis).
            try:
                snap = await s.call_tool("browser_snapshot", {})
                total = 0
                for item in (snap.content or []):
                    text = getattr(item, "text", "")
                    if isinstance(text, str):
                        total += len(text)
                findings["snapshot_chars"] = total
            except Exception as exc:
                findings["warnings"].append(f"snapshot_failed:{type(exc).__name__}")

            # Close browser; best effort.
            try:
                await s.call_tool("browser_close", {})
            except Exception:
                pass

    return findings


def run_browser_validation(
    agent_path: str,
    run_id: str,
    domain: str,
    success_criteria: str = "",
) -> dict[str, Any]:
    # Public entry. Never raises. Always returns a finding dict with at least
    # {"ok": bool, "warnings": list[str]}. Caller surfaces warnings into the
    # validation_report; validation_status is unaffected.
    result: dict[str, Any] = {
        "ok": False,
        "warnings": [],
        "console_error_count": 0,
        "console_errors": [],
        "snapshot_chars": 0,
        "elapsed_s": 0.0,
    }
    started_at = time.perf_counter()

    if not _MCP_AVAILABLE:
        result["warnings"].append("mcp_sdk_unavailable")
        result["elapsed_s"] = round(time.perf_counter() - started_at, 3)
        return result

    if domain != "website_builder":
        result["warnings"].append(f"unsupported_domain:{domain}")
        result["elapsed_s"] = round(time.perf_counter() - started_at, 3)
        return result

    entry = _find_playwright_mcp_entry() or _warm_npx_cache()
    if not entry:
        result["warnings"].append("playwright_mcp_entry_not_found")
        result["elapsed_s"] = round(time.perf_counter() - started_at, 3)
        return result

    html_path, run_error = _run_agent_capture_html(agent_path, run_id, domain)
    if html_path is None:
        result["warnings"].append(run_error or "html_capture_failed")
        result["elapsed_s"] = round(time.perf_counter() - started_at, 3)
        return result

    workdir = str(Path(html_path).parent.parent)  # <workdir>/output/<file>.html
    try:
        try:
            findings = asyncio.run(asyncio.wait_for(_drive_playwright(entry, html_path, workdir), timeout=_BROWSER_TIMEOUT_S))
            result.update(findings)
            result["ok"] = findings.get("navigated", False)
        except asyncio.TimeoutError:
            result["warnings"].append(f"browser_timeout_after_{_BROWSER_TIMEOUT_S}s")
        except Exception as exc:
            result["warnings"].append(f"browser_drive_failed:{type(exc).__name__}:{str(exc)[:120]}")
    finally:
        # Always clean up the workdir we created. Best effort.
        try:
            shutil.rmtree(workdir, ignore_errors=True)
        except Exception:
            pass

    # Console errors get surfaced as warnings (not failures) per scope.
    if result.get("console_error_count", 0) > 0:
        first = result.get("console_errors", [])
        sample = first[0] if first else ""
        result["warnings"].append(
            f"console_errors:{result['console_error_count']} first={sample[:120]}"
        )

    # success_criteria is currently unused for binary pass/fail in this stage
    # (LLM-free comparison is too brittle to assert). It is recorded for
    # observability so future iterations can wire a comparison if desired.
    if success_criteria:
        result["success_criteria_seen"] = success_criteria[:200]

    result["elapsed_s"] = round(time.perf_counter() - started_at, 3)
    return result
