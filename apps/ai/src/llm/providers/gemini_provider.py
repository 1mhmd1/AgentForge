import os
import shutil
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

# NEW "Google Gen AI" SDK -- package name google-genai (NOT the legacy
# google-generativeai). Client picks up GEMINI_API_KEY automatically when
# the env var is set; we still pass it explicitly so the failure mode is
# a clear RuntimeError instead of a silent unauthenticated call.
from google import genai
from google.genai import types as genai_types


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


def call_gemini(prompt: str, max_tokens: int = 1024) -> tuple[str, dict[str, Any]]:
    _ensure_env_loaded()
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is missing. Add it to .env")

    # Resolution: env override -> user-specified default. gemini-3-flash-preview
    # is the latest fast-tier model on the Gen AI SDK at time of wiring; swap
    # via GEMINI_MODEL env if Google rotates the alias.
    model = (os.getenv("GEMINI_MODEL") or "gemini-3-flash-preview").strip()

    # gemini-3-flash-preview (and gemini-2.5-flash) are reasoning/thinking
    # models -- they consume max_output_tokens on invisible "thoughts" before
    # emitting any text. With AgentForge's small per-call budgets (300-500
    # tokens), enabled thinking silently truncates the actual JSON output.
    # Default to 0 (no thinking) so behavior matches the old non-thinking
    # models. Power users can enable reasoning via GEMINI_THINKING_BUDGET
    # (e.g. 1024 for moderate, 4096 for hard problems).
    thinking_budget = int(os.getenv("GEMINI_THINKING_BUDGET", "0") or 0)

    # Inspection-mode override. When set, replaces every caller's max_tokens
    # with this value. Use to see full, un-truncated output from any call
    # site (planner / optimizer / sub_agents) without editing them. Unset
    # the env var to restore per-call budgets. Cap at the model's actual
    # output limit (gemini-3-flash-preview supports up to ~8192).
    override = os.getenv("GEMINI_MAX_TOKENS_OVERRIDE", "").strip()
    effective_max_tokens = int(override) if override.isdigit() else max_tokens

    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=model,
            contents=prompt,
            config=genai_types.GenerateContentConfig(
                temperature=0.2,
                top_p=0.8,
                top_k=20,
                max_output_tokens=effective_max_tokens,
                thinking_config=genai_types.ThinkingConfig(thinking_budget=thinking_budget),
            ),
        )
        text = (getattr(response, "text", None) or "").strip()
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
