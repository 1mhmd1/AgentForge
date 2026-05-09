from __future__ import annotations

from typing import Any


def _is_non_negative_int(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and value >= 0


def validate_audit(audit: dict) -> dict:
    errors: list[str] = []
    warnings: list[str] = []

    if not isinstance(audit, dict):
        return {
            "valid": False,
            "errors": ["audit_not_dict"],
            "warnings": [],
        }

    total_tokens = audit.get("total_tokens")
    agents_executed = audit.get("agents_executed")
    provider_usage = audit.get("provider_usage")
    failed_step = audit.get("failed_step")

    if not _is_non_negative_int(total_tokens):
        errors.append("total_tokens_missing_or_invalid")
    if not _is_non_negative_int(agents_executed):
        errors.append("agents_executed_missing_or_invalid")
    if not isinstance(provider_usage, dict):
        errors.append("provider_usage_missing_or_invalid")
    else:
        for provider, count in provider_usage.items():
            if not _is_non_negative_int(count):
                errors.append(f"provider_usage_invalid:{provider}")

    if failed_step is not None:
        if not isinstance(failed_step, str) or not failed_step.strip():
            errors.append("failed_step_invalid")
        elif _is_non_negative_int(agents_executed) and agents_executed == 0:
            errors.append("failed_step_inconsistent")

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
    }