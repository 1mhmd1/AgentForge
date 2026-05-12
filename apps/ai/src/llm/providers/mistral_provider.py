import os
from typing import Any

import requests
from dotenv import load_dotenv

load_dotenv()


def call_mistral(
    prompt: str,
    model: str | None = None,
    max_tokens: int = 1024,
) -> tuple[str, dict[str, Any]]:
    """
    Mistral chat completions via the OpenAI-compatible /v1/chat/completions
    endpoint. Returns (text, usage) matching the contract every provider
    follows.

    Free-tier defaults to mistral-small-latest. Override per call via the
    `model` kwarg, or system-wide via MISTRAL_MODEL.
    """
    api_key = os.getenv("MISTRAL_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("MISTRAL_API_KEY is missing. Add it to .env")

    resolved_model = (model or os.getenv("MISTRAL_MODEL") or "mistral-small-latest").strip()

    url = "https://api.mistral.ai/v1/chat/completions"
    payload: dict[str, Any] = {
        "model": resolved_model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.1,
        "max_tokens": max_tokens,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=30)
        resp.raise_for_status()
        data = resp.json() if resp.content else {}

        choices = data.get("choices") or []
        if not choices:
            raise RuntimeError(
                f"Mistral returned no choices (model={resolved_model})"
            )

        text = ((choices[0].get("message") or {}).get("content") or "").strip()
        if not text:
            raise RuntimeError("Mistral returned an empty response")

        u = data.get("usage") or {}
        usage: dict[str, Any] = {
            "prompt_tokens": int(u.get("prompt_tokens", 0) or 0),
            "completion_tokens": int(u.get("completion_tokens", 0) or 0),
            "total_tokens": int(u.get("total_tokens", 0) or 0),
            "provider": "mistral",
        }
        return text, usage
    except requests.HTTPError as exc:
        # Bubble the API body up so call_llm's retry detector + the SSE
        # surface have something useful to show (rate limits, auth errors).
        body = ""
        try:
            body = exc.response.text[:500]
        except Exception:
            pass
        raise RuntimeError(f"Mistral API error: {exc} | body={body}") from exc
    except requests.RequestException as exc:
        raise RuntimeError(f"Mistral API error: {exc}") from exc
