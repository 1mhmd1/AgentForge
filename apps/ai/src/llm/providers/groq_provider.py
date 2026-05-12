import os
from typing import Any
from groq import Groq


# Lazy client. Building the Groq client at IMPORT time meant the API key was
# captured then -- if dotenv hadn't loaded yet (import-order race), the key
# was None and every fallback request silently failed auth with no signal to
# the caller. We now build the client on first call, after dotenv has
# definitely run, and raise a clear error if the key is missing.
_client: Groq | None = None


def _get_client() -> Groq:
    global _client
    if _client is None:
        api_key = (os.getenv("GROQ_API_KEY") or "").strip()
        if not api_key:
            raise RuntimeError(
                "GROQ_API_KEY is missing. Set it in .env so the gemini -> groq "
                "fallback chain has somewhere to fall back to."
            )
        _client = Groq(api_key=api_key)
    return _client


def call_groq(prompt: str, max_tokens: int = 1024) -> tuple[str, dict[str, Any]]:
    try:
        response = _get_client().chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=max_tokens,
        )
    except Exception as exc:
        # Wrap so call_llm's transient detector + the error message the user
        # eventually sees both clearly say "Groq API error: ..." instead of
        # bubbling a raw groq SDK exception.
        raise RuntimeError(f"Groq API error: {exc}") from exc

    text = response.choices[0].message.content.strip()
    usage_obj = getattr(response, "usage", None)
    usage = {
        "prompt_tokens": getattr(usage_obj, "prompt_tokens", 0) or 0,
        "completion_tokens": getattr(usage_obj, "completion_tokens", 0) or 0,
        "total_tokens": getattr(usage_obj, "total_tokens", 0) or 0,
        "provider": "groq",
    }
    return text, usage