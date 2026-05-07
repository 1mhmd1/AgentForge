import os
from dotenv import load_dotenv
load_dotenv()
def call_llm(prompt: str) -> str:
    provider = os.getenv("LLM_PROVIDER", "groq")

    if provider == "groq":
        from llm.providers.groq_provider import call_groq
        return call_groq(prompt)

    elif provider == "gemini":
        from llm.providers.gemini_provider import call_gemini
        return call_gemini(prompt)

    else:
        raise ValueError("Unknown LLM provider: " + provider)