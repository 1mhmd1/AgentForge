import os
from typing import Any
import requests
from dotenv import load_dotenv

load_dotenv()


def call_minimax(
    prompt: str,
    model: str | None = None,
    max_tokens: int = 300,
) -> tuple[str, dict[str, Any]]:
    api_key = os.getenv("MINIMAX_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("MINIMAX_API_KEY is missing. Add it to .env")

    # Resolution order: explicit arg -> env override -> sane default. The old
    # abab6.5* models were retired by MiniMax (status 2013 "unknown model");
    # MiniMax-M1 is the reasoning-tier successor.
    resolved_model = (model or os.getenv("MINIMAX_MODEL") or "MiniMax-M1").strip()

    url = "https://api.minimaxi.chat/v1/text/chatcompletion_v2"

    payload = {
        "model": resolved_model,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": max_tokens,
        "temperature": 0.1,
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=30)
        resp.raise_for_status()
        data = resp.json() if resp.content else {}

        # MiniMax returns 200 even on logical failures, with details in
        # base_resp.status_code / status_msg. Surface those so call_llm's
        # cross-provider fallback (and retry detection) sees them.
        base_resp = data.get("base_resp") or {}
        status_code = base_resp.get("status_code")
        status_msg = (base_resp.get("status_msg") or "").strip()
        if status_code and int(status_code) != 0:
            raise RuntimeError(f"MiniMax API error: status_code={status_code} msg={status_msg}")

        choices = data.get("choices") or []
        if not choices:
            raise RuntimeError(f"MiniMax returned no choices (model={resolved_model}, msg={status_msg or 'unknown'})")

        text = ((choices[0].get("message") or {}).get("content") or "").strip()

        if not text:
            raise RuntimeError("MiniMax returned an empty response")

        u = data.get("usage") or {}
        usage = {
            "prompt_tokens": int(u.get("prompt_tokens", 0) or 0),
            "completion_tokens": int(u.get("completion_tokens", 0) or 0),
            "total_tokens": int(u.get("total_tokens", 0) or 0),
            "provider": "minimax",
        }
        return text, usage
    except requests.RequestException as exc:
        raise RuntimeError(f"MiniMax API error: {exc}") from exc
