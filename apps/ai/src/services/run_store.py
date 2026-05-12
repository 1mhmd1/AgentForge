"""
Qdrant run store. Persists the full successful run state into a `runs`
collection so it can be retrieved by run_id later. Embeds `goal` for parity
with template_store (same model + dim + distance).

Hard rules honored:
- Sync qdrant-client only.
- All operations are graceful: any failure logs and returns None/False;
  the pipeline is never blocked by Qdrant being down.
- Reuses the lazy client + model from template_store (one process-wide
  instance, one warm-up cost).
"""
from __future__ import annotations

import hashlib
from typing import Any, Optional

from services.observability import log_event
from services import template_store as _ts

_RUNS_COLLECTION = "runs"
_VECTOR_SIZE = 384

_RUN_FIELDS = (
    "run_id",
    "domain",
    "status",
    "stage",
    "spec",
    "generated_code",
    "validation_status",
    "validation_score",
    "semantic_score",
    "repair_attempts",
    "created_at",
    "completed_at",
    "output_path",
    "build_duration_seconds",
    "run_audit",
    "validation_report",
)


_runs_index_ensured = False


def _ensure_runs_collection() -> bool:
    # Reuses template_store internals to avoid duplicating Qdrant config.
    if not _ts._ensure_collection(_RUNS_COLLECTION):
        return False
    # Qdrant rejects scroll+filter on payload fields without a payload index.
    # Create a keyword index on `run_id` once so retrieve_run() can find rows.
    global _runs_index_ensured
    if _runs_index_ensured:
        return True
    client = _ts._get_client()
    if client is None:
        return True  # collection is up; we just won't be able to filter
    try:
        from qdrant_client.http import models as qmodels
        client.create_payload_index(
            collection_name=_RUNS_COLLECTION,
            field_name="run_id",
            field_schema=qmodels.PayloadSchemaType.KEYWORD,
        )
    except Exception:
        # Index already exists, or older client. Either way: best-effort,
        # never block saves.
        pass
    _runs_index_ensured = True
    return True


def _deterministic_id(run_id: str) -> int:
    # Brief asks for `abs(hash(run_id)) % (10**12)`. Python's `hash()` is
    # randomized per process (PYTHONHASHSEED), which means the same run_id
    # produces different IDs across processes -- so a re-save would create
    # a duplicate point. md5 -> int gives the same idempotent property the
    # brief intends, deterministically.
    digest = hashlib.md5(run_id.encode("utf-8")).hexdigest()
    return int(digest, 16) % (10 ** 12)


def _extract_payload(state: dict) -> dict[str, Any]:
    spec = state.get("spec") if isinstance(state.get("spec"), dict) else {}
    payload: dict[str, Any] = {}
    for key in _RUN_FIELDS:
        value = state.get(key)
        if value is None:
            continue
        payload[key] = value
    # Pull goal from spec for the embed text + fast filter.
    goal = ""
    if isinstance(spec, dict):
        goal_val = spec.get("goal")
        if isinstance(goal_val, str):
            goal = goal_val.strip()
    if goal:
        payload["goal"] = goal
    return payload


def save_run(state: dict) -> bool:
    """
    Save the full run state to the `runs` collection. Returns True on
    success, False on any failure. Never raises.
    """
    if not isinstance(state, dict):
        return False
    run_id = state.get("run_id")
    if not isinstance(run_id, str) or not run_id:
        log_event("run_store_save_skipped", reason="missing_run_id")
        return False

    client = _ts._get_client()
    if client is None:
        return False
    if not _ensure_runs_collection():
        return False

    payload = _extract_payload(state)
    goal = payload.get("goal") or payload.get("run_id") or run_id
    vector = _ts._embed(goal)
    if vector is None:
        return False

    try:
        from qdrant_client.http import models as qmodels
        point_id = _deterministic_id(run_id)
        client.upsert(
            collection_name=_RUNS_COLLECTION,
            points=[
                qmodels.PointStruct(id=point_id, vector=vector, payload=payload),
            ],
        )
        log_event("run_store_saved", run_id=run_id, point_id=point_id)
        return True
    except Exception as exc:
        log_event("run_store_save_failed", run_id=run_id, error=str(exc))
        return False


def retrieve_run(run_id: str) -> Optional[dict]:
    """
    Fetch the run payload from `runs` by run_id (scroll + filter). Returns
    None when not found or on any failure. Never raises.
    """
    if not run_id:
        return None
    client = _ts._get_client()
    if client is None:
        return None

    try:
        if not client.collection_exists(collection_name=_RUNS_COLLECTION):
            return None
    except Exception:
        try:
            client.get_collection(collection_name=_RUNS_COLLECTION)
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
            collection_name=_RUNS_COLLECTION,
            scroll_filter=flt,
            with_payload=True,
            with_vectors=False,
            limit=1,
        )
        if not points:
            return None
        return dict(getattr(points[0], "payload", {}) or {})
    except Exception as exc:
        log_event("run_store_retrieve_failed", run_id=run_id, error=str(exc))
        return None
