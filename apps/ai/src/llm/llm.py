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
        return call_gemini(prompt)
    elif provider == "minimax":
        from llm.providers.minimax_provider import call_minimax
        return call_minimax(prompt, max_tokens=max_tokens)
    elif provider == "kimi":
        from llm.providers.kimi_provider import call_kimi
        return call_kimi(prompt, max_tokens=max_tokens)
    else:
        raise ValueError("Unknown LLM provider: " + provider)


def call_llm(
    prompt: str, provider: str | None = None, max_tokens: int = 1024
) -> tuple[str, dict[str, Any]]:
    """
    Call an LLM provider and return (text, usage).

    usage shape: {"prompt_tokens": int, "completion_tokens": int, "total_tokens": int, "provider": str}
    Providers that don't expose usage (e.g. gemini free tier) return zeros.

    Transient failures (HTTP 429/5xx, timeouts, connection drops) are retried
    with exponential backoff, controlled by env vars:
      LLM_MAX_RETRIES (default 3, total attempts including the first)
      LLM_RETRY_BASE_DELAY (default 1.0 seconds)
    Set LLM_MAX_RETRIES=1 to disable retries.
    """
    if provider is None:
        provider = os.getenv("LLM_PROVIDER", "groq")
    provider = provider.strip().lower()

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

    # Unreachable (loop either returns or raises) but keeps type checkers happy.
    raise last_exc if last_exc else RuntimeError("call_llm: no attempts made")


def _empty_usage(provider: str) -> dict[str, Any]:
    return {
        "prompt_tokens": 0,
        "completion_tokens": 0,
        "total_tokens": 0,
        "provider": provider,
    }
