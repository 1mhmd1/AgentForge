import json
from typing import Any

from llm.llm import call_llm
from prompts.prompt_optimizer_prompt import PROMPT_OPTIMIZER_PROMPT
from services.tracer import trace_node


REQUIRED_FIELDS = (
    "original_prompt",
    "optimized_prompt",
    "detected_domain",
    "complexity",
    "detected_requirements",
)


def _clean_response(text: str) -> str:
    # Strips ```json / ``` fences and surrounding whitespace.
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3].strip()
    return cleaned.strip()


def _extract_json(text: str) -> dict[str, Any]:
    if not isinstance(text, str) or not text.strip():
        raise ValueError("empty response")
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("no JSON object found in response")
    candidate = text[start : end + 1]
    return json.loads(candidate)


def _validate_response(data: dict[str, Any], user_prompt: str) -> dict[str, Any]:
    if not isinstance(data, dict):
        data = {}

    original = data.get("original_prompt")
    if not isinstance(original, str) or not original.strip():
        original = user_prompt

    optimized = data.get("optimized_prompt")
    if not isinstance(optimized, str) or not optimized.strip():
        optimized = user_prompt

    domain = data.get("detected_domain")
    if not isinstance(domain, str) or not domain.strip():
        domain = "general"

    complexity = data.get("complexity")
    if not isinstance(complexity, str) or not complexity.strip():
        complexity = "unknown"

    reqs = data.get("detected_requirements")
    if not isinstance(reqs, list):
        reqs = []
    else:
        reqs = [str(r).strip() for r in reqs if isinstance(r, (str, int, float)) and str(r).strip()]

    return {
        "original_prompt": original,
        "optimized_prompt": optimized,
        "detected_domain": domain.strip().lower(),
        "complexity": complexity.strip().lower(),
        "detected_requirements": reqs,
    }


def _fallback(user_prompt: str, reason: str) -> dict[str, Any]:
    return {
        "original_prompt": user_prompt,
        "optimized_prompt": user_prompt,
        "detected_domain": "general",
        "complexity": "unknown",
        "detected_requirements": [],
        "error": reason,
    }


def optimize_prompt(user_prompt: str) -> dict[str, Any]:
    if not isinstance(user_prompt, str) or not user_prompt.strip():
        return _fallback(user_prompt or "", "empty user prompt")

    prompt = PROMPT_OPTIMIZER_PROMPT.format(user_prompt=user_prompt)

    try:
        raw, usage = call_llm(prompt, max_tokens=400)
    except Exception as exc:
        result = _fallback(user_prompt, f"llm_call_failed:{type(exc).__name__}")
        result["usage"] = None
        return result

    try:
        cleaned = _clean_response(raw)
        parsed = _extract_json(cleaned)
        validated = _validate_response(parsed, user_prompt)
        validated["usage"] = usage
        return validated
    except Exception as exc:
        result = _fallback(user_prompt, f"parsing_failure:{type(exc).__name__}")
        result["usage"] = usage
        return result


def prompt_optimizer_node(state: dict[str, Any]) -> dict[str, Any]:
    # Pipeline-safe wrapper: must NEVER crash the run.
    next_state = state.copy()
    user_prompt = next_state.get("user_prompt", "") or ""

    with trace_node(next_state.get("run_id"), "prompt_optimizer") as tr:
        analysis = optimize_prompt(user_prompt)
        tr.note(
            "optimizer_result",
            detected_domain=analysis.get("detected_domain"),
            complexity=analysis.get("complexity"),
            had_error=bool(analysis.get("error")),
        )

    optimized_text = analysis.get("optimized_prompt") or user_prompt
    next_state["optimized_prompt"] = optimized_text
    next_state["prompt_analysis"] = analysis

    detected_domain = analysis.get("detected_domain")
    if next_state.get("domain") is None and detected_domain in {
        "website_builder",
        "document",
        "web_research",
        "data_transform",
    }:
        next_state["domain"] = detected_domain

    return next_state
