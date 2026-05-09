"""
Shared LLM-output parsing utilities.

Centralizes the defensive logic for extracting JSON from low-tier LLM outputs.
Previously duplicated between sub_agent.py and (less robustly) planner.py.

Three-tier recovery:
1. clean_response: strip invisible chars, markdown fences, whitespace
2. extract_json: find first { to last }, fix trailing commas, parse
3. extract_fields_fallback: regex-based field extraction as last resort
"""
from __future__ import annotations

import json
import re
from typing import Any

_INVISIBLE = ("﻿", "​", "‌", "‍", "⁠")
_FENCE_START = re.compile(r"^```(?:json|python)?\s*", re.IGNORECASE)
_FENCE_END = re.compile(r"\s*```\s*$")


def strip_invisible(text: str) -> str:
    cleaned = text
    for ch in _INVISIBLE:
        cleaned = cleaned.replace(ch, "")
    return cleaned


def clean_response(response: str) -> str:
    cleaned = strip_invisible(str(response)).strip()
    cleaned = _FENCE_START.sub("", cleaned)
    cleaned = _FENCE_END.sub("", cleaned)
    return cleaned.strip()


def extract_json(response: str) -> dict[str, Any]:
    if not isinstance(response, str) or not response.strip():
        raise ValueError("empty response")

    start = response.find("{")
    end = response.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise ValueError("no JSON object found in response")

    candidate = response[start : end + 1]
    candidate = re.sub(r",\s*}", "}", candidate)
    candidate = re.sub(r",\s*]", "]", candidate)

    data = json.loads(candidate)
    if not isinstance(data, dict):
        raise ValueError("JSON output is not an object")
    return data


def extract_fields_fallback(response: str, expected_fields: list[str]) -> dict[str, Any]:
    """Regex-extract simple "key": "value" pairs when JSON parsing fails."""
    result: dict[str, Any] = {}
    for field in expected_fields:
        m = re.search(rf'"{re.escape(field)}"\s*:\s*"([^"]*)"', response)
        if m:
            result[field] = m.group(1)
    return result


def parse_with_recovery(
    raw: str,
    expected_fields: list[str] | None = None,
) -> dict[str, Any]:
    """
    Try clean+extract; on failure return a regex-extracted dict (possibly empty).
    Caller decides how to validate / fill defaults.
    """
    cleaned = clean_response(raw)
    try:
        return extract_json(cleaned)
    except (ValueError, json.JSONDecodeError):
        if expected_fields:
            return extract_fields_fallback(raw, expected_fields)
        return {}
