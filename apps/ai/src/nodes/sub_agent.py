import json
import re
from typing import Any

from llm.llm import call_llm
from prompts.sub_agent_prompt import SUB_AGENT_PROMPT


def _strip_invisible(text: str) -> str:
    invisible = ["\ufeff", "\u200b", "\u200c", "\u200d", "\u2060"]
    cleaned = text
    for char in invisible:
        cleaned = cleaned.replace(char, "")
    return cleaned


def _clean_response(response: str) -> str:
    cleaned = _strip_invisible(str(response))
    cleaned = cleaned.strip()
    # Remove markdown fences
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    return cleaned.strip()


def _extract_json(response: str) -> dict[str, Any]:
    start = response.find("{")
    end = response.rfind("}")

    if start == -1 or end == -1 or end < start:
        raise ValueError("No JSON object found in response")

    json_str = response[start : end + 1]

    # Fix common LLM JSON issues
    # Fix single quotes -> double quotes (careful with content)
    # Fix trailing commas
    json_str = re.sub(r",\s*}", "}", json_str)
    json_str = re.sub(r",\s*]", "]", json_str)

    try:
        data = json.loads(json_str)
    except json.JSONDecodeError:
        # Try to extract fields manually if JSON is malformed
        data = _extract_fields_fallback(response)

    if not isinstance(data, dict):
        raise ValueError("JSON output is not an object")
    return data


def _extract_fields_fallback(response: str) -> dict[str, Any]:
    """Last-resort extraction when JSON is malformed."""
    result = {
        "step_id": "",
        "status": "success",
        "generated_code": "",
        "summary": "",
        "error": None,
    }

    # Try to find step_id
    m = re.search(r'"step_id"\s*:\s*"([^"]*)"', response)
    if m:
        result["step_id"] = m.group(1)

    # Try to find status
    m = re.search(r'"status"\s*:\s*"([^"]*)"', response)
    if m:
        result["status"] = m.group(1)

    # Try to find summary
    m = re.search(r'"summary"\s*:\s*"([^"]*)"', response)
    if m:
        result["summary"] = m.group(1)

    # For generated_code, take everything between the first pair of content markers
    m = re.search(r'"generated_code"\s*:\s*"(.*?)"(?:\s*,|\s*})', response, re.DOTALL)
    if m:
        result["generated_code"] = m.group(1).replace("\\n", "\n").replace('\\"', '"')
    else:
        # If we can't find generated_code in JSON, use the whole response as content
        result["generated_code"] = response
        result["summary"] = "Raw LLM output used as content"

    return result


def _validate_response(data: dict[str, Any]) -> dict[str, Any]:
    validated = dict(data)

    if "step_id" not in validated:
        validated["step_id"] = ""
    if "status" not in validated:
        validated["status"] = "success"
    else:
        status = str(validated["status"]).strip().lower()
        validated["status"] = status if status in {"success", "error"} else "success"
    if "generated_code" not in validated:
        validated["generated_code"] = ""
    if "summary" not in validated:
        validated["summary"] = ""
    if "error" not in validated:
        validated["error"] = None

    validated["generated_code"] = str(validated.get("generated_code", ""))
    validated["summary"] = str(validated.get("summary", ""))
    error_value = validated.get("error")
    validated["error"] = None if error_value in (None, "", "null") else str(error_value)

    return validated


def _compress_previous_output(previous_results: dict[str, Any]) -> str:
    """Pass ONLY the last agent's summary + code snippet -- not the full history."""
    if not previous_results:
        return "none"

    keys = sorted(previous_results.keys())
    last_key = keys[-1]
    last = previous_results[last_key]

    # Include both summary and generated content for chaining
    summary = str(last.get("summary", "")).strip()
    code = str(last.get("generated_code", "")).strip()

    parts = []
    if summary:
        parts.append(f"Summary: {summary}")
    if code:
        # Truncate long content but keep enough for context
        if len(code) > 800:
            parts.append(f"Content (truncated): {code[:800]}...")
        else:
            parts.append(f"Content: {code}")

    return "\n".join(parts) if parts else "completed"


def execute_sub_agent(
    step_id: str,
    step_data: dict[str, Any],
    total_steps: int,
    previous_results: dict[str, Any],
    provider: str = "groq",
    max_tokens: int = 1024,
    domain: str = "",
    goal: str = "",
) -> dict[str, Any]:
    previous_output = _compress_previous_output(previous_results)

    prompt = SUB_AGENT_PROMPT.format(
        step_number=step_data.get("order"),
        total_steps=total_steps,
        step_id=step_id,
        step_text=step_data.get("text", ""),
        tools=step_data.get("tools", []),
        previous_output=previous_output,
        domain=domain,
        goal=goal,
    )

    last_error: Exception | None = None
    accumulated_usage = {
        "prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0,
        "provider": provider, "llm_calls": 0,
    }

    def _accumulate(u: dict[str, Any]) -> None:
        accumulated_usage["llm_calls"] += 1
        if not isinstance(u, dict):
            return
        accumulated_usage["prompt_tokens"] += int(u.get("prompt_tokens", 0) or 0)
        accumulated_usage["completion_tokens"] += int(u.get("completion_tokens", 0) or 0)
        accumulated_usage["total_tokens"] += int(u.get("total_tokens", 0) or 0)

    # Retry once only (2 attempts total)
    for _attempt in range(2):
        try:
            raw, usage = call_llm(prompt, provider=provider, max_tokens=max_tokens)
            _accumulate(usage)
            cleaned = _clean_response(raw)
            data = _extract_json(cleaned)
            validated = _validate_response(data)
            validated["step_id"] = step_id
            validated["usage"] = accumulated_usage

            # If generated_code is empty but we have raw output, use it
            if not validated["generated_code"].strip() and cleaned:
                validated["generated_code"] = cleaned
                validated["summary"] = validated.get("summary") or "Content extracted from LLM response"

            return validated
        except Exception as exc:
            last_error = exc

    # Final fallback: return raw LLM output as content if we got anything
    try:
        raw, usage = call_llm(prompt, provider=provider, max_tokens=max_tokens)
        _accumulate(usage)
        if raw and raw.strip():
            return {
                "step_id": step_id,
                "status": "success",
                "generated_code": raw.strip(),
                "summary": "Raw output (JSON parsing failed)",
                "error": None,
                "usage": accumulated_usage,
            }
    except Exception:
        pass

    return {
        "step_id": step_id,
        "status": "error",
        "generated_code": "",
        "summary": "Sub-agent failed after all retries",
        "error": str(last_error) if last_error else "Unknown error",
        "usage": accumulated_usage,
    }
