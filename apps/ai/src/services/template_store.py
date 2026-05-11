"""
Qdrant template store. Saves successfully validated agents into a per-domain
collection, retrieves the best semantic match for a new build's goal.

Hard rules honored:
- Sync qdrant-client only (no async pipeline addition).
- All operations are graceful: any failure logs and returns None/False; the
  pipeline is never blocked by Qdrant being down or unavailable.
- One model + one client per process, lazy init.
- Collections are auto-created once. Subsequent calls reuse them; we never
  recreate.
"""
from __future__ import annotations

import os
import threading
import uuid
from datetime import datetime, timezone
from typing import Optional

from services.observability import log_event

_VECTOR_SIZE = 384
_MODEL_NAME = "all-MiniLM-L6-v2"
_DEFAULT_THRESHOLD = 0.75

# Replacement margin: a new template REPLACES an existing near-duplicate only
# if its score beats the old one by at least this many points. Avoids constant
# churn when two LLM runs produce slightly different code at the same quality.
_REPLACE_MARGIN = 5

_lock = threading.Lock()
_client = None  # type: ignore[assignment]
_model = None  # type: ignore[assignment]
_ensured_collections: set[str] = set()
_init_failed = False


def _qdrant_url() -> str:
    return os.environ.get("QDRANT_URL", "").strip()


def _qdrant_api_key() -> Optional[str]:
    val = os.environ.get("QDRANT_API_KEY", "").strip()
    return val or None


def _get_client():
    """Lazily build a sync Qdrant client. Returns None on any failure."""
    global _client, _init_failed
    if _init_failed:
        return None
    if _client is not None:
        return _client
    url = _qdrant_url()
    if not url:
        _init_failed = True
        return None
    with _lock:
        if _client is not None:
            return _client
        try:
            from qdrant_client import QdrantClient  # local import keeps boot fast
            _client = QdrantClient(url=url, api_key=_qdrant_api_key(), timeout=10.0)
            return _client
        except Exception as exc:
            log_event("template_store_init_failed", error=str(exc))
            _init_failed = True
            return None


def _get_model():
    """Lazily load the sentence-transformer. Returns None on any failure."""
    global _model
    if _model is not None:
        return _model
    with _lock:
        if _model is not None:
            return _model
        try:
            from sentence_transformers import SentenceTransformer  # local import
            _model = SentenceTransformer(_MODEL_NAME)
            return _model
        except Exception as exc:
            log_event("template_store_model_load_failed", error=str(exc))
            return None


def _embed(text: str) -> Optional[list[float]]:
    model = _get_model()
    if model is None:
        return None
    try:
        vec = model.encode(text, normalize_embeddings=True)
        # Convert numpy -> list[float] (Qdrant accepts both, but list is JSON-safe).
        return [float(x) for x in vec.tolist()]
    except Exception as exc:
        log_event("template_store_embed_failed", error=str(exc))
        return None


def _ensure_collection(name: str) -> bool:
    if name in _ensured_collections:
        return True
    client = _get_client()
    if client is None:
        return False
    try:
        from qdrant_client.http import models as qmodels
        try:
            exists = client.collection_exists(collection_name=name)
        except Exception:
            # Older client versions: probe via get_collection.
            try:
                client.get_collection(collection_name=name)
                exists = True
            except Exception:
                exists = False
        if not exists:
            client.create_collection(
                collection_name=name,
                vectors_config=qmodels.VectorParams(
                    size=_VECTOR_SIZE,
                    distance=qmodels.Distance.COSINE,
                ),
            )
            log_event("template_store_collection_created", collection=name)
        _ensured_collections.add(name)
        return True
    except Exception as exc:
        log_event("template_store_ensure_failed", collection=name, error=str(exc))
        return False


def _collection_for(domain: str) -> str:
    safe = "".join(c if c.isalnum() or c == "_" else "_" for c in (domain or "")).strip("_")
    return f"templates_{safe or 'unknown'}"


def is_available() -> bool:
    """True only when Qdrant is reachable AND the embedding model loaded."""
    return _get_client() is not None and _get_model() is not None


def _search_one(collection: str, vector: list[float], threshold: float) -> Optional[dict]:
    """
    Return the top match's payload (with `_score` AND `_point_id`) when
    cosine score >= threshold, otherwise None. Never raises. Shared by
    retrieve_template + the dedup/upgrade check inside save_template, so we
    embed once per call site.

    Compatible with qdrant-client >= 1.10 (uses `query_points`) AND older
    builds that still expose `search`.
    """
    client = _get_client()
    if client is None:
        return None
    try:
        # Modern client: query_points returns QueryResponse(points=[ScoredPoint, ...]).
        if hasattr(client, "query_points"):
            response = client.query_points(
                collection_name=collection,
                query=vector,
                limit=1,
                with_payload=True,
            )
            results = list(getattr(response, "points", None) or [])
        else:
            # Legacy client (<1.10): direct list of ScoredPoint.
            results = client.search(
                collection_name=collection,
                query_vector=vector,
                limit=1,
                with_payload=True,
            )
        if not results:
            return None
        top = results[0]
        score = float(getattr(top, "score", 0.0) or 0.0)
        if score < threshold:
            return None
        payload = dict(getattr(top, "payload", {}) or {})
        payload["_score"] = score
        payload["_point_id"] = getattr(top, "id", None)
        return payload
    except Exception as exc:
        log_event("template_store_search_failed", collection=collection, error=str(exc))
        return None


def save_template(
    run_id: str,
    domain: str,
    goal: str,
    spec: dict,
    generated_code: str,
    score: int = 0,
) -> bool:
    """
    Embed `goal`, upsert into the per-domain collection. Returns True on
    successful save (insert OR upgrade-replace), False on any failure or when
    an existing near-duplicate is judged equally-good-or-better.

    Dedup + upgrade contract: if a template in the same collection has cosine
    similarity >= _DEFAULT_THRESHOLD against the new goal, we compare scores:

      - new score >= old score + _REPLACE_MARGIN  ->  replace (delete old,
        insert new)
      - otherwise                                 ->  skip (keep the old one)

    The margin avoids flapping when two LLM runs of the same prompt produce
    slightly different code at essentially the same quality.
    """
    if not run_id or not domain or not goal or not generated_code:
        log_event("template_store_save_skipped", reason="missing_field", run_id=run_id)
        return False

    client = _get_client()
    if client is None:
        return False

    collection = _collection_for(domain)
    if not _ensure_collection(collection):
        return False

    vector = _embed(goal)
    if vector is None:
        return False

    new_score = int(score or 0)

    # DEDUP / UPGRADE: search the same collection for a near-match.
    existing = _search_one(collection, vector, _DEFAULT_THRESHOLD)
    upgrade_target_id = None
    if existing is not None:
        old_score = int(existing.get("score") or 0)
        if new_score < old_score + _REPLACE_MARGIN:
            log_event(
                "template_store_save_skipped_duplicate",
                run_id=run_id,
                domain=domain,
                matched_run_id=existing.get("run_id"),
                matched_score=existing.get("_score"),
                old_quality=old_score,
                new_quality=new_score,
            )
            return False
        # Upgrade path: new template wins.
        upgrade_target_id = existing.get("_point_id")
        log_event(
            "template_store_save_upgrade",
            run_id=run_id,
            domain=domain,
            replacing_run_id=existing.get("run_id"),
            old_quality=old_score,
            new_quality=new_score,
            cosine=existing.get("_score"),
        )

    try:
        from qdrant_client.http import models as qmodels
        point_id = str(uuid.uuid4())
        payload = {
            "run_id": run_id,
            "domain": domain,
            "goal": goal,
            "spec": spec or {},
            "generated_code": generated_code,
            "score": new_score,
            "saved_at": datetime.now(timezone.utc).isoformat(),
        }
        if upgrade_target_id is not None:
            payload["replaced_run_id"] = existing.get("run_id") if existing else None
        client.upsert(
            collection_name=collection,
            points=[qmodels.PointStruct(id=point_id, vector=vector, payload=payload)],
        )
        # Delete the old point AFTER the new one is in place -- never leaves the
        # collection empty mid-operation. Failure to delete is non-fatal: worst
        # case the next save sees two near-matches and still picks the better.
        if upgrade_target_id is not None:
            try:
                client.delete(
                    collection_name=collection,
                    points_selector=qmodels.PointIdsList(points=[upgrade_target_id]),
                )
            except Exception as exc:
                log_event(
                    "template_store_delete_old_failed",
                    point_id=upgrade_target_id,
                    error=str(exc),
                )
        log_event(
            "template_store_saved",
            run_id=run_id,
            domain=domain,
            collection=collection,
            point_id=point_id,
            score=new_score,
            upgraded=upgrade_target_id is not None,
        )
        return True
    except Exception as exc:
        log_event("template_store_save_failed", run_id=run_id, error=str(exc))
        return False


def retrieve_template(
    domain: str,
    goal: str,
    score_threshold: float = _DEFAULT_THRESHOLD,
) -> Optional[dict]:
    """
    Return the best semantic match's payload when score >= threshold,
    otherwise None. Never raises.
    """
    if not domain or not goal:
        return None
    client = _get_client()
    if client is None:
        return None

    collection = _collection_for(domain)
    # Don't auto-create on retrieval -- just check existence.
    try:
        if not client.collection_exists(collection_name=collection):
            return None
    except Exception:
        try:
            client.get_collection(collection_name=collection)
        except Exception:
            return None

    vector = _embed(goal)
    if vector is None:
        return None

    payload = _search_one(collection, vector, score_threshold)
    if payload is None:
        log_event(
            "template_store_retrieve_below_threshold",
            domain=domain,
            threshold=score_threshold,
        )
        return None

    # Structural-quality gate: a near-match in Qdrant is no good if the
    # cached code itself has duplicate <header>/<footer>/<h1>/<section>
    # baked in. Run the same dedup checker the builder uses; reject any
    # template that fails so corrupted templates can never be served.
    code = payload.get("generated_code") or ""
    if domain == "website_builder" and code:
        try:
            from services.html_dedup import is_html_clean
            if not is_html_clean(code):
                log_event(
                    "template_store_retrieve_rejected_dirty",
                    domain=domain,
                    score=payload.get("_score"),
                    run_id=payload.get("run_id"),
                    reason="cached code has structural duplicates",
                )
                return None
        except Exception as exc:
            # If the checker itself errors, prefer to NOT serve the cached
            # template -- fresh generation is safer than blindly trusting
            # something we can't validate.
            log_event(
                "template_store_retrieve_quality_check_failed",
                error=str(exc),
            )
            return None

    log_event(
        "template_store_retrieved",
        domain=domain,
        score=payload.get("_score"),
        run_id=payload.get("run_id"),
    )
    return payload
