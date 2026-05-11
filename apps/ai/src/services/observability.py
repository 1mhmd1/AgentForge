"""
Structured logging for AgentForge.

Single helper: log_event(event, **fields). Emits one JSON object per line to
stderr. Replaces ad-hoc print() calls in validator_engine and any other node
that wants traceable output.

Format:
  {"ts": "2026-05-10T...", "event": "syntax_validation", "stage": "...", ...}

Disable structured output (revert to plain print) with AGENTFORGE_PLAIN_LOGS=1.
Used in tests where JSON-on-stderr would clutter the output.
"""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from typing import Any


def _plain_logs_enabled() -> bool:
    return os.getenv("AGENTFORGE_PLAIN_LOGS", "0").strip().lower() in {"1", "true", "yes"}


def log_event(event: str, **fields: Any) -> None:
    if _plain_logs_enabled():
        # Plain mode: human-friendly single line.
        parts = [event]
        for k, v in fields.items():
            parts.append(f"{k}={v}")
        print(" | ".join(parts), file=sys.stderr)
        return

    payload = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "event": event,
    }
    for key, value in fields.items():
        # Truncate noisy strings.
        if isinstance(value, str) and len(value) > 500:
            payload[key] = value[:500] + "...[truncated]"
        else:
            payload[key] = value
    try:
        sys.stderr.write(json.dumps(payload, default=str) + "\n")
        sys.stderr.flush()
    except Exception:
        # Never let logging break the pipeline.
        pass
