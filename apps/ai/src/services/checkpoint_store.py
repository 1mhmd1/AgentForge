"""
Qdrant checkpoint store. Persists mid-pipeline state so a run that halts on
a sub-agent failure can be resumed from where it stopped, instead of
restarting from scratch.

Lifecycle:
  - After each successful sub-agent step  ->  save_checkpoint (upsert by run_id)
  - On terminal sub-agent failure          ->  save_checkpoint with failed_step
  - On successful validation               ->  delete_checkpoint
  - On explicit resume                     ->  load_checkpoint(run_id)

Hard rules honored:
- Sync qdrant-client only.
- Graceful: any failure logs and returns None/False; the pipeline is never
  blocked by Qdrant being down.
- Reuses the lazy client from template_store -- no second connection pool.
- No embeddings: we look checkpoints up by run_id (payload filter), so we
  upsert with a fixed all-zero vector. The vector dim must still match the
  configured Qdrant collection schema (384).
"""
from __future__ import annotations

import hashlib
from typing import Any, Optional

from services.observability import log_event
from services import template_store as _ts

_CHECKPOINTS_COLLECTION = "checkpoints"
_VECTOR_SIZE = 384
_FIXED_VECTOR = [0.0] * _VECTOR_SIZE

# Payload fields we persist on each checkpoint. Anything not listed is dropped
# so we don't leak unrelated state into Qdrant.
_PERSISTED_KEYS = (
    "run_id",
    "user_prompt",
    "optimized_prompt",
    "prompt_analysis",
    "domain",
    "spec",
    "execution_plan",
    "step_map",
    "execution_order",
    "sub_agent_results",
    "run_audit",
    "completed_steps",
    "failed_step",
    "final_error",
    "final_error_details",
    "planner_usage",
    "stage",
    "status",
    "created_at",
    "started_at",
)

_runs_index_ensured = False


def _deterministic_id(run_id: str) -> int:
    # Same idiom as run_store: md5 -> int so retries of the same run_id
    # always hit the same point (idempotent upsert across processes).
    digest = hashlib.md5(run_id.encode("utf-8")).hexdigest()
    return int(digest, 16) % (10 ** 12)


def _ensure_collection() -> bool:
    # Bootstrap the collection (idempotent) AND ensure the payload index on
    # run_id is in place so scroll+filter retrieval works.
    if not _ts._ensure_collection(_CHECKPOINTS_COLLECTION):
        return False
    global _runs_index_ensured
    if _runs_index_ensured:
        return True
    client = _ts._get_client()
    if client is None:
        return True
    try:
        from qdrant_client.http import models as qmodels
        client.create_payload_index(
            collection_name=_CHECKPOINTS_COLLECTION,
            field_name="run_id",
            field_schema=qmodels.PayloadSchemaType.KEYWORD,
        )
    except Exception:
        # Index already exists, or older client. Either way: best-effort.
        pass
    _runs_index_ensured = True
    return True


def is_available() -> bool:
    """True only when Qdrant is reachable (no embedder needed for checkpoints)."""
    return _ts._get_client() is not None


def _extract_payload(state: dict, extra: Optional[dict] = None) -> dict[str, Any]:
    payload: dict[str, Any] = {}
    for key in _PERSISTED_KEYS:
        value = state.get(key)
        if value is None:
            continue
        payload[key] = value
    if extra:
        payload.update(extra)
    return payload


def save_checkpoint(state: dict, extra: Optional[dict] = None) -> bool:
    """
    Upsert the run's current state. Idempotent on `run_id` (same point id
    each time). Returns True on success, False on any failure. Never raises.
    """
    if not isinstance(state, dict):
        return False
    run_id = state.get("run_id")
    if not isinstance(run_id, str) or not run_id:
        log_event("checkpoint_save_skipped", reason="missing_run_id")
        return False

    if not is_available():
        return False
    if not _ensure_collection():
        return False

    client = _ts._get_client()
    if client is None:
        return False

    try:
        from qdrant_client.http import models as qmodels
        payload = _extract_payload(state, extra)
        point_id = _deterministic_id(run_id)
        client.upsert(
            collection_name=_CHECKPOINTS_COLLECTION,
            points=[
                qmodels.PointStruct(id=point_id, vector=_FIXED_VECTOR, payload=payload),
            ],
        )
        log_event(
            "checkpoint_saved",
            run_id=run_id,
            point_id=point_id,
            completed_steps=len(payload.get("completed_steps") or []),
            sub_agent_results=len(payload.get("sub_agent_results") or {}),
            failed_step=payload.get("failed_step"),
        )
        return True
    except Exception as exc:
        log_event("checkpoint_save_failed", run_id=run_id, error=str(exc))
        return False


def load_checkpoint(run_id: str) -> Optional[dict]:
    """
    Look up a checkpoint by run_id (scroll + payload filter). Returns the
    payload dict on hit, None on miss or any failure. Never raises.
    """
    if not run_id:
        return None
    client = _ts._get_client()
    if client is None:
        return None

    try:
        if not client.collection_exists(collection_name=_CHECKPOINTS_COLLECTION):
            return None
    except Exception:
        try:
            client.get_collection(collection_name=_CHECKPOINTS_COLLECTION)
        except Exception:
            return None

    try:
        from qdrant_client.http import models as qmodels
        flt = qmodels.Filter(
            must=[
                qmodels.FieldCondition(
                    key="run_id",
                    match=qmodels.MatchValue(value=run_id),
                )
            ]
        )
        points, _next = client.scroll(
            collection_name=_CHECKPOINTS_COLLECTION,
            scroll_filter=flt,
            with_payload=True,
            with_vectors=False,
            limit=1,
        )
        if not points:
            return None
        payload = dict(getattr(points[0], "payload", {}) or {})
        log_event(
            "checkpoint_loaded",
            run_id=run_id,
            completed_steps=len(payload.get("completed_steps") or []),
            failed_step=payload.get("failed_step"),
        )
        return payload
    except Exception as exc:
        log_event("checkpoint_load_failed", run_id=run_id, error=str(exc))
        return None


def delete_checkpoint(run_id: str) -> bool:
    """
    Remove a checkpoint by run_id. Used after a run terminally succeeds
    (validation_status == 'passed'). No-op when no checkpoint exists.
    """
    if not run_id:
        return False
    client = _ts._get_client()
    if client is None:
        return False

    try:
        from qdrant_client.http import models as qmodels
        point_id = _deterministic_id(run_id)
        client.delete(
            collection_name=_CHECKPOINTS_COLLECTION,
            points_selector=qmodels.PointIdsList(points=[point_id]),
        )
        log_event("checkpoint_deleted", run_id=run_id, point_id=point_id)
        return True
    except Exception as exc:
        log_event("checkpoint_delete_failed", run_id=run_id, error=str(exc))
        return False
