"""
MCP doc-tool integration. Surgical Phase 1: Microsoft Learn + Context7 only.

Off by default. Enable with AGENTFORGE_MCP_DOCS=1.
fetch_docs_context() returns a compact reference-docs string for prompt injection,
or "" on any failure / when disabled. NEVER raises.

The MCP SDK is async-first; we wrap each call with asyncio.run() so the rest of
the pipeline stays synchronous (the builder loop is a plain for-loop and stays
that way per the project's no-async-architecture rule).
"""
from __future__ import annotations

import asyncio
import os
import re
import time
from typing import Any

from .observability import log_event


MS_LEARN_URL = "https://learn.microsoft.com/api/mcp"
CONTEXT7_URL = "https://mcp.context7.com/mcp"
EXA_URL_TEMPLATE = "https://mcp.exa.ai/mcp?exaApiKey={key}"

# Per-call MCP timeout (seconds). Each MCP runs in its own event loop, so
# a stuck server only blocks that single call up to this limit.
_PER_CALL_TIMEOUT_S = 12.0

# Process-local TTL cache. The MCP fetch is the slowest part of an enabled
# build (Context7 round-trip alone is ~10s). Repeating the exact same prompt
# within the TTL window returns instantly. Cleared on process restart.
_CACHE_TTL_S = 300.0
_cache: dict[tuple[str, str], tuple[float, str]] = {}

# Whole words / well-known package names only. Keep this list conservative --
# false positives fire a slow Context7 lookup that adds ~10s for nothing.
_LIB_HINTS: dict[str, tuple[str, ...]] = {
    "website_builder": (
        "react", "vue", "nuxt", "next.js", "nextjs", "svelte", "angular",
        "solid", "solidjs", "astro", "tailwind", "bootstrap", "chakra",
    ),
    "data_transform": (
        "pandas", "numpy", "polars", "duckdb", "dask", "pyspark",
        "scikit-learn", "sklearn", "matplotlib", "seaborn", "plotly",
    ),
}


def is_enabled() -> bool:
    return os.getenv("AGENTFORGE_MCP_DOCS", "0").strip() == "1"


def fetch_docs_context(domain: str, goal: str, *, max_chars: int = 1500) -> str:
    # Top-level entry. Sync. Never raises.
    #
    # Each MCP gets its own asyncio.run() call. Sharing an event loop across
    # multiple streamable-HTTP MCP sessions exposes a cleanup race in the SDK
    # where the second/third session returns empty even when the server is
    # healthy. Separate event loops sidestep this entirely.
    if not is_enabled():
        return ""
    if not isinstance(goal, str) or not goal.strip():
        return ""
    cache_key = (str(domain or ""), goal)
    now = time.time()
    cached = _cache.get(cache_key)
    if cached is not None:
        cached_at, cached_text = cached
        if now - cached_at < _CACHE_TTL_S:
            log_event("mcp_docs_cache_hit", chars=len(cached_text), age_s=round(now - cached_at, 2))
            return cached_text

    sources: list[tuple[str, str]] = []

    ms_text = _run_one(_safe_ms_learn(goal))
    if ms_text:
        sources.append(("Microsoft Learn", ms_text.strip()))

    if isinstance(domain, str) and domain in _LIB_HINTS:
        library = _detect_library(domain, goal)
        if library:
            ctx_text = _run_one(_safe_context7(library, goal))
            if ctx_text:
                sources.append((f"Context7 ({library})", ctx_text.strip()))

    if domain == "web_research" and os.getenv("EXA_API_KEY", "").strip():
        exa_text = _run_one(_safe_exa(goal))
        if exa_text:
            sources.append(("Exa web search", exa_text.strip()))

    if not sources:
        _cache[cache_key] = (now, "")
        return ""

    # Per-source budget so a single chatty MCP (Microsoft Learn often returns
    # 20k+ chars) cannot drown out the others under the total max_chars cap.
    per_source = max(200, max_chars // len(sources))
    parts = [f"{label}:\n{_truncate(text, per_source)}" for label, text in sources]
    out = "\n\n".join(parts).strip()
    log_event("mcp_docs_fetched", chars=len(out), sources=len(sources))
    _cache[cache_key] = (now, out)
    return out


def _truncate(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    return text[:limit].rsplit(" ", 1)[0] + " ..."


def _run_one(coro) -> str:
    # Drive a single async MCP call to completion in its own event loop.
    # The async helper already has its own per-call timeout, so any hang is
    # bounded. Returns "" on any exception so the caller can keep going.
    try:
        return asyncio.run(coro)
    except Exception as exc:
        log_event("mcp_run_one_failed", error=f"{type(exc).__name__}: {str(exc)[:160]}")
        return ""


async def _safe_ms_learn(query: str) -> str:
    try:
        return await asyncio.wait_for(_ms_learn_search(query), timeout=_PER_CALL_TIMEOUT_S)
    except Exception as exc:
        log_event("mcp_ms_learn_failed", error=f"{type(exc).__name__}: {str(exc)[:160]}")
        return ""


async def _safe_context7(library: str, query: str) -> str:
    try:
        return await asyncio.wait_for(_context7_lookup(library, query), timeout=_PER_CALL_TIMEOUT_S)
    except Exception as exc:
        log_event("mcp_context7_failed", error=f"{type(exc).__name__}: {str(exc)[:160]}")
        return ""


async def _safe_exa(query: str) -> str:
    try:
        return await asyncio.wait_for(_exa_search(query), timeout=_PER_CALL_TIMEOUT_S)
    except Exception as exc:
        log_event("mcp_exa_failed", error=f"{type(exc).__name__}: {str(exc)[:160]}")
        return ""


async def _ms_learn_search(query: str) -> str:
    from mcp import ClientSession
    from mcp.client.streamable_http import streamablehttp_client

    async with streamablehttp_client(MS_LEARN_URL) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            result = await session.call_tool("microsoft_docs_search", {"query": query})
            return _extract_text(result)


async def _exa_search(query: str) -> str:
    from mcp import ClientSession
    from mcp.client.streamable_http import streamablehttp_client

    key = os.getenv("EXA_API_KEY", "").strip()
    if not key:
        return ""
    url = EXA_URL_TEMPLATE.format(key=key)
    async with streamablehttp_client(url) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            result = await session.call_tool(
                "web_search_exa",
                {"query": query, "numResults": 3},
            )
            return _extract_text(result)


async def _context7_lookup(library: str, query: str) -> str:
    from mcp import ClientSession
    from mcp.client.streamable_http import streamablehttp_client

    async with streamablehttp_client(CONTEXT7_URL) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            resolve_result = await session.call_tool(
                "resolve-library-id",
                {"libraryName": library, "query": query},
            )
            resolve_text = _extract_text(resolve_result)
            library_id = _first_library_id(resolve_text)
            if not library_id:
                return ""
            docs_result = await session.call_tool(
                "query-docs",
                {"libraryId": library_id, "query": query},
            )
            return _extract_text(docs_result)


def _detect_library(domain: str, goal: str) -> str | None:
    lowered = goal.lower()
    for hint in _LIB_HINTS.get(domain, ()):
        if hint in lowered:
            return hint
    return None


def _extract_text(call_tool_result: Any) -> str:
    content = getattr(call_tool_result, "content", None)
    if not content:
        return ""
    first = content[0]
    return str(getattr(first, "text", "") or "")


def _first_library_id(text: str) -> str | None:
    match = re.search(r"library ID:\s*(/[^\s]+)", text or "")
    return match.group(1) if match else None
