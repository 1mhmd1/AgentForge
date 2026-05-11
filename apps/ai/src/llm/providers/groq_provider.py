import os
from typing import Any
from groq import Groq

client = Groq(api_key=os.getenv("GROQ_API_KEY"))


def call_groq(prompt: str, max_tokens: int = 1024) -> tuple[str, dict[str, Any]]:
    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
        max_tokens=max_tokens,
    )

    text = response.choices[0].message.content.strip()
    usage_obj = getattr(response, "usage", None)
    usage = {
        "prompt_tokens": getattr(usage_obj, "prompt_tokens", 0) or 0,
        "completion_tokens": getattr(usage_obj, "completion_tokens", 0) or 0,
        "total_tokens": getattr(usage_obj, "total_tokens", 0) or 0,
        "provider": "groq",
    }
    return text, usage