import os
import requests
from dotenv import load_dotenv

load_dotenv()


def call_minimax(
    prompt: str,
    model: str = "abab6.5s-chat",
    max_tokens: int = 300,
) -> str:
    api_key = os.getenv("MINIMAX_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("MINIMAX_API_KEY is missing. Add it to .env")

    url = "https://api.minimaxi.chat/v1/text/chatcompletion_v2"

    payload = {
        "model": model,
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
        data = resp.json()

        text = (
            data.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
            .strip()
        )

        if not text:
            raise RuntimeError("MiniMax returned an empty response")

        return text
    except requests.RequestException as exc:
        raise RuntimeError(f"MiniMax API error: {exc}") from exc
