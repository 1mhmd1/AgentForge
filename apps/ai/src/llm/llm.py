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


# Hard-quota errors (Gemini free-tier daily 20 req cap). Retrying the same
# provider won't help -- the quota resets in ~24 hours. Detecting these early
# lets the outer fallback chain skip the wasted retries and jump straight to
# groq, which is the whole point of having a fallback.
_QUOTA_MARKERS = (
    "resource_exhausted",
    "resource exhausted",
    "quota exceeded",
    "exceeded your current quota",
    "free_tier_requests",
    "generaterequestsperdayperprojectpermodel",
)


def _is_hard_quota(exc: Exception) -> bool:
    text = str(exc).lower()
    return any(marker in text for marker in _QUOTA_MARKERS)


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
    elif provider == "mistral":
        from llm.providers.mistral_provider import call_mistral
        return call_mistral(prompt, max_tokens=max_tokens)
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
            # Hard-quota errors won't recover by retrying the same provider --
            # the daily cap resets in ~24h. Fast-fail so the outer fallback
            # chain can jump to groq immediately instead of burning 7+ seconds
            # of useless backoff (1s + 2s + 4s).
            if _is_hard_quota(exc):
                raise
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
        # Default primary is Gemini -- better instruction adherence on the
        # detailed planner / sub-agent prompts. Groq is used as the fallback.
        provider = os.getenv("LLM_PROVIDER", "gemini")
    primary = provider.strip().lower()
    # Default fallback is Groq when the env var is unset. The user can
    # explicitly disable fallback by setting LLM_FALLBACK_PROVIDER="" (empty
    # string) -- the `or None` below preserves that opt-out.
    _fallback_raw = os.getenv("LLM_FALLBACK_PROVIDER")
    if _fallback_raw is None:
        fallback = "groq"
    else:
        fallback = _fallback_raw.strip().lower() or None

    try:
        return _call_with_retries(primary, prompt, max_tokens)
    except Exception as primary_exc:
        if not fallback or fallback == primary:
            raise
        # Log fallback attempt to BOTH the observability stream AND stderr so
        # operators can see it in the AI service console (the dev experience
        # the user cares about most). Quiet log_event failures are fine -- the
        # stderr line is the user-visible signal.
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
        import sys as _sys
        print(
            f"[llm] {primary} failed -> falling back to {fallback}: {str(primary_exc)[:200]}",
            file=_sys.stderr, flush=True,
        )
        # Cap output tokens for the fallback provider. Some fallback models
        # (e.g. groq llama-3.1-8b-instant, 8k context) have a much smaller
        # context window than the primary; a max_tokens that was sensible for
        # gemini-3-flash-preview can leave no room for the prompt and make
        # EVERY fallback call fail with a context-overflow error.
        _FALLBACK_OUTPUT_CAP = {
            "groq": 2000,
            "minimax": 2000,
            "kimi": 2000,
        }
        fallback_max = min(max_tokens, _FALLBACK_OUTPUT_CAP.get(fallback, max_tokens))
        try:
            return _call_with_retries(fallback, prompt, fallback_max)
        except Exception as fallback_exc:
            # Surface BOTH errors so the user can debug. Previously we hid the
            # fallback failure behind the primary error which made it look
            # like the fallback never ran. The combined message keeps the
            # primary error first (since it's what the user configured) but
            # appends the fallback reason so failures are diagnosable.
            print(
                f"[llm] fallback {fallback} ALSO failed: {str(fallback_exc)[:200]}",
                file=_sys.stderr, flush=True,
            )
            combined = (
                f"Both LLM providers failed. "
                f"Primary ({primary}): {primary_exc}. "
                f"Fallback ({fallback}): {fallback_exc}"
            )
            raise RuntimeError(combined) from fallback_exc


def _empty_usage(provider: str) -> dict[str, Any]:
    return {
        "prompt_tokens": 0,
        "completion_tokens": 0,
        "total_tokens": 0,
        "provider": provider,
    }
