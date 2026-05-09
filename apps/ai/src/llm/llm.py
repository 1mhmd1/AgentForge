import os
from dotenv import load_dotenv

load_dotenv()


def call_llm(prompt: str, provider: str | None = None, max_tokens: int = 1024) -> str:
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