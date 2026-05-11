"""
Per-run execution traces for AgentForge.

Disabled by default. Enable with AGENTFORGE_TRACE=1 (env var).
When enabled, each call to record_event(run_id, ...) appends a JSON line to
apps/ai/traces/<run_id>.jsonl. The full state dict is NEVER written to avoid
leaking prompts; only safe summary fields go in.

Usage from a node:
  from services.tracer import trace_node
  with trace_node(state.get("run_id"), "planner") as tr:
      ... do work ...
      tr.note("spec_extracted", goal=spec.get("goal"))
"""
from __future__ import annotations

import json
import os
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator


_TRACE_ROOT_NAME = "traces"


def is_enabled() -> bool:
    return os.getenv("AGENTFORGE_TRACE", "0").strip().lower() in {"1", "true", "yes"}


def _trace_dir() -> Path:
    # apps/ai/traces -- two levels up from this file (src/services/tracer.py)
    base = Path(__file__).resolve().parents[2]
    return base / _TRACE_ROOT_NAME


def _trace_path(run_id: str) -> Path:
    safe = "".join(c for c in str(run_id) if c.isalnum() or c in "-_") or "unknown"
    return _trace_dir() / f"{safe}.jsonl"


def record_event(run_id: str | None, event: str, **fields: Any) -> None:
    if not is_enabled() or not run_id:
        return
    try:
        path = _trace_path(run_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        line = json.dumps(
            {
                "ts": datetime.now(timezone.utc).isoformat(),
                "run_id": run_id,
                "event": event,
                **{k: _summarize(v) for k, v in fields.items()},
            },
            default=str,
        )
        with path.open("a", encoding="utf-8") as fh:
            fh.write(line + "\n")
    except Exception:
        # Trace failures must never break the pipeline.
        pass


def _summarize(value: Any) -> Any:
    """Cap large values; never trace prompts/code verbatim."""
    if isinstance(value, str) and len(value) > 200:
        return value[:200] + f"...[+{len(value) - 200} chars]"
    if isinstance(value, (list, tuple)) and len(value) > 20:
        return list(value[:20]) + [f"...[+{len(value) - 20} items]"]
    if isinstance(value, dict) and len(value) > 30:
        return {k: value[k] for k in list(value.keys())[:30]} | {"...": f"+{len(value) - 30} keys"}
    return value


class _NodeTracer:
    def __init__(self, run_id: str | None, node: str) -> None:
        self.run_id = run_id
        self.node = node
        self._start = 0.0

    def __enter__(self) -> "_NodeTracer":
        self._start = time.perf_counter()
        record_event(self.run_id, "node_enter", node=self.node)
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        elapsed = round(time.perf_counter() - self._start, 4)
        if exc is None:
            record_event(self.run_id, "node_exit", node=self.node, elapsed_s=elapsed)
        else:
            record_event(
                self.run_id,
                "node_error",
                node=self.node,
                elapsed_s=elapsed,
                exception_type=type(exc).__name__,
                message=str(exc)[:200],
            )

    def note(self, event: str, **fields: Any) -> None:
        record_event(self.run_id, event, node=self.node, **fields)


@contextmanager
def trace_node(run_id: str | None, node: str) -> Iterator[_NodeTracer]:
    tracer = _NodeTracer(run_id, node)
    tracer.__enter__()
    try:
        yield tracer
    except BaseException as exc:
        tracer.__exit__(type(exc), exc, exc.__traceback__)
        raise
    else:
        tracer.__exit__(None, None, None)
