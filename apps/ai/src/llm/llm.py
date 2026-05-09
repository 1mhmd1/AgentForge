import os
from typing import Any
from dotenv import load_dotenv

load_dotenv()


def call_llm(
    prompt: str, provider: str | None = None, max_tokens: int = 1024
) -> tuple[str, dict[str, Any]]:
    """
    Call an LLM provider and return (text, usage).

    usage shape: {"prompt_tokens": int, "completion_tokens": int, "total_tokens": int, "provider": str}
    Providers that don't expose usage (e.g. gemini free tier) return zeros.
    """
    if provider is None:
        provider = os.getenv("LLM_PROVIDER", "groq")

    provider = provider.strip().lower()

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


def _empty_usage(provider: str) -> dict[str, Any]:
    return {
        "prompt_tokens": 0,
        "completion_tokens": 0,
        "total_tokens": 0,
        "provider": provider,
    }