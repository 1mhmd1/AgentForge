import os
import shutil
from pathlib import Path
from typing import Any

import google.generativeai as genai
from dotenv import load_dotenv


def _ensure_env_loaded() -> None:
    current = Path(__file__).resolve()
    env_example = None

    for parent in [current, *current.parents]:
        candidate = parent / ".env.example"
        if candidate.exists():
            env_example = candidate
            break

    if env_example is None:
        load_dotenv()
        return

    env_file = env_example.parent / ".env"
    if not env_file.exists():
        shutil.copyfile(env_example, env_file)

    load_dotenv(env_file)


def call_gemini(prompt: str) -> tuple[str, dict[str, Any]]:
    _ensure_env_loaded()
    api_key = os.getenv("GEMINI_API_KEY", "").strip()

    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is missing. Add it to .env")

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(
            "gemini-2.0-flash",
            generation_config={
                "temperature": 0.2,
                "top_p": 0.8,
                "top_k": 20,
            },
        )
        response = model.generate_content(prompt)
        text = (response.text or "").strip()

        if not text:
            raise RuntimeError("Gemini returned an empty response")

        meta = getattr(response, "usage_metadata", None)
        prompt_t = getattr(meta, "prompt_token_count", 0) or 0
        comp_t = getattr(meta, "candidates_token_count", 0) or 0
        total_t = getattr(meta, "total_token_count", 0) or (prompt_t + comp_t)
        usage = {
            "prompt_tokens": prompt_t,
            "completion_tokens": comp_t,
            "total_tokens": total_t,
            "provider": "gemini",
        }
        return text, usage
    except Exception as exc:
        raise RuntimeError(f"Gemini API error: {exc}") from exc
