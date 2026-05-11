import os
import time
from typing import Any
from dotenv import load_dotenv

load_dotenv()


# Substrings that indicate transient (retryable) failures across providers.
# We match on str(exc) because each SDK uses its own exception classes.
_TRANSIENT_MARKERS = (
    "429",
    "rate limit",
    "rate_limit",
    "503",
    "502",
    "504",
    "service unavailable",
    "bad gateway",
    "gateway timeout",
    "timeout",
    "connection reset",
    "connection aborted",
    "remote end closed",
    "temporarily unavailable",
)


def _is_transient(exc: Exception) -> bool:
    text = str(exc).lower()
    return any(marker in text for marker in _TRANSIENT_MARKERS)


def _call_provider(provider: str, prompt: str, max_tokens: int) -> tuple[str, dict[str, Any]]:
    if provider == "groq":
        from llm.providers.groq_provider import call_groq
        return call_groq(prompt, max_tokens=max_tokens)
    elif provider == "gemini":
        from llm.providers.gemini_provider import call_gemini
        return call_gemini(prompt, max_tokens=max_tokens)
    elif provider == "minimax":
        from llm.providers.minimax_provider import call_minimax
        return call_minimax(prompt, max_tokens=max_tokens)
    elif provider == "kimi":
        from llm.providers.kimi_provider import call_kimi
        return call_kimi(prompt, max_tokens=max_tokens)
    else:
        raise ValueError("Unknown LLM provider: " + provider)


def _call_with_retries(provider: str, prompt: str, max_tokens: int) -> tuple[str, dict[str, Any]]:
    # Existing single-provider retry loop, extracted so the outer fallback
    # wrapper can call it twice (primary then fallback).
    max_attempts = max(1, int(os.getenv("LLM_MAX_RETRIES", "3") or 3))
    base_delay = float(os.getenv("LLM_RETRY_BASE_DELAY", "1.0") or 1.0)

    last_exc: Exception | None = None
    for attempt in range(max_attempts):
        try:
            return _call_provider(provider, prompt, max_tokens)
        except Exception as exc:
            last_exc = exc
            if attempt + 1 >= max_attempts or not _is_transient(exc):
                raise
            time.sleep(base_delay * (2 ** attempt))
    raise last_exc if last_exc else RuntimeError("_call_with_retries: no attempts made")


def call_llm(
    prompt: str, provider: str | None = None, max_tokens: int = 1024
) -> tuple[str, dict[str, Any]]:
    """
    Call an LLM provider and return (text, usage).

    usage shape: {"prompt_tokens": int, "completion_tokens": int, "total_tokens": int, "provider": str}
    Providers that don't expose usage (e.g. gemini free tier) return zeros.

    Transient failures (HTTP 429/5xx, timeouts, connection drops) are retried
    on the same provider with exponential backoff, controlled by env vars:
      LLM_MAX_RETRIES (default 3, total attempts including the first)
      LLM_RETRY_BASE_DELAY (default 1.0 seconds)
    Set LLM_MAX_RETRIES=1 to disable retries.

    Cross-provider fallback: if LLM_FALLBACK_PROVIDER is set and the primary
    provider fails after its retry budget (transient or otherwise), one attempt
    is made against the fallback provider. If that also fails, the original
    primary exception is raised so error reporting reflects the configured
    primary. Empty / unset LLM_FALLBACK_PROVIDER disables fallback.
    """
    if provider is None:
        provider = os.getenv("LLM_PROVIDER", "groq")
    primary = provider.strip().lower()
    fallback = (os.getenv("LLM_FALLBACK_PROVIDER", "") or "").strip().lower() or None

    try:
        return _call_with_retries(primary, prompt, max_tokens)
    except Exception as primary_exc:
        if not fallback or fallback == primary:
            raise
        try:
            from services.observability import log_event
            log_event(
                "llm_provider_fallback",
                primary=primary,
                fallback=fallback,
                reason=str(primary_exc)[:200],
            )
        except Exception:
            pass
        # Cap output tokens for the fallback provider. Some fallback models
        # (e.g. groq llama-3.1-8b-instant, 8k context) have a much smaller
        # context window than the primary; a max_tokens that was sensible for
        # gemini-3-flash-preview can leave no room for the prompt and make
        # EVERY fallback call fail with a context-overflow error. The
        # per-provider cap is conservative on purpose so the fallback
        # actually has a chance of returning text on the heaviest steps.
        _FALLBACK_OUTPUT_CAP = {
            "groq": 2000,
            "minimax": 2000,
            "kimi": 2000,
        }
        fallback_max = min(max_tokens, _FALLBACK_OUTPUT_CAP.get(fallback, max_tokens))
        try:
            return _call_with_retries(fallback, prompt, fallback_max)
        except Exception:
            # Surface the primary failure as the canonical error -- the user
            # configured primary intentionally; hiding it behind the fallback
            # error makes debugging confusing.
            raise primary_exc


def _empty_usage(provider: str) -> dict[str, Any]:
    return {
        "prompt_tokens": 0,
        "completion_tokens": 0,
        "total_tokens": 0,
        "provider": provider,
    }
