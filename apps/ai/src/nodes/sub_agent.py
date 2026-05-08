import json
from typing import Any

from llm.llm import call_llm
from prompts.sub_agent_prompt import SUB_AGENT_PROMPT
from prompts.website_builder_prompt import WEBSITE_BUILDER_PROMPT


def _strip_invisible(text: str) -> str:
    invisible = ["\ufeff", "\u200b", "\u200c", "\u200d", "\u2060"]
    cleaned = text
    for char in invisible:
        cleaned = cleaned.replace(char, "")
    return cleaned


def _clean_response(response: str) -> str:
    cleaned = _strip_invisible(str(response))
    cleaned = cleaned.strip()
    cleaned = cleaned.replace("```json", "")
    cleaned = cleaned.replace("```python", "")
    cleaned = cleaned.replace("```", "")
    return cleaned.strip()


def _extract_json(response: str) -> dict[str, Any]:
    start = response.find("{")
    end = response.rfind("}")

    if start == -1 or end == -1 or end < start:
        raise ValueError("No JSON object found")

    data = json.loads(response[start : end + 1])
    if not isinstance(data, dict):
        raise ValueError("JSON output is not an object")
    return data


def _validate_response(data: dict[str, Any]) -> dict[str, Any]:
    validated = dict(data)

    if "step_id" not in validated:
        validated["step_id"] = ""
    if "status" not in validated:
        validated["status"] = "error"
    else:
        status = str(validated["status"]).strip().lower()
        validated["status"] = status if status in {"success", "error"} else "error"
    if "generated_code" not in validated:
        validated["generated_code"] = ""
    if "summary" not in validated:
        validated["summary"] = ""
    if "error" not in validated:
        validated["error"] = None

    validated["generated_code"] = str(validated.get("generated_code", ""))
    validated["summary"] = str(validated.get("summary", ""))
    error_value = validated.get("error")
    validated["error"] = None if error_value in (None, "") else str(error_value)

    return validated


def _select_prompt(domain: str | None) -> str:
    if domain == "website_builder":
        return WEBSITE_BUILDER_PROMPT
    return SUB_AGENT_PROMPT


def execute_sub_agent(
    step_id: str,
    step_data: dict[str, Any],
    total_steps: int,
    previous_results: dict[str, Any],
    domain: str | None = None,
    goal: str | None = None,
) -> dict[str, Any]:
    template = _select_prompt(domain)
    prompt = template.format(
        step_number=step_data.get("order"),
        total_steps=total_steps,
        step_id=step_id,
        step_text=step_data.get("text", ""),
        tools=step_data.get("tools", []),
        previous_results=json.dumps(previous_results),
        domain=domain or "general",
        goal=goal or "",
    )

    last_error: Exception | None = None

    for _ in range(3):
        try:
            raw = call_llm(prompt)
            cleaned = _clean_response(raw)
            data = _extract_json(cleaned)
            validated = _validate_response(data)
            validated["step_id"] = step_id
            return validated
        except Exception as exc:
            last_error = exc

    return {
        "step_id": step_id,
        "status": "error",
        "generated_code": "",
        "summary": "Sub-agent parsing failed",
        "error": str(last_error) if last_error else "Unknown error",
    }
