from __future__ import annotations

from typing import Any


def _add_unique(items: list[str], value: str) -> None:
    if value not in items:
        items.append(value)


def _append_messages(target: list[str], messages: list[str], prefix: str) -> None:
    for message in messages:
        if not message:
            continue
        _add_unique(target, f"{prefix}: {message}")


def build_validation_report(
    syntax_result: dict,
    file_result: dict,
    execution_result: dict,
    audit_result: dict,
) -> dict:
    syntax_valid = bool(syntax_result.get("valid"))
    file_valid = bool(file_result.get("valid"))
    execution_valid = bool(execution_result.get("valid"))
    audit_valid = bool(audit_result.get("valid"))

    score = 100
    if not syntax_valid:
        score -= 50
    if not execution_valid:
        score -= 30
    if not file_valid:
        score -= 10
    if not audit_valid:
        score -= 10
    score = max(0, min(100, score))

    errors: list[str] = []
    warnings: list[str] = []

    if not syntax_valid:
        syntax_error = syntax_result.get("error") or "syntax_validation_failed"
        _add_unique(errors, f"CRITICAL: SyntaxError — {syntax_error}")

    file_errors = []
    if not file_valid:
        file_error = file_result.get("error") or "file_validation_failed"
        file_errors.append(file_error)
    _append_messages(errors, file_errors, "CRITICAL")

    if not execution_valid:
        execution_error = execution_result.get("error") or "execution_validation_failed"
        _add_unique(errors, f"CRITICAL: ExecutionError — {execution_error}")

    if execution_result.get("output_truncated"):
        _add_unique(warnings, "output_truncated")
    if execution_result.get("skip_reason"):
        _add_unique(warnings, execution_result["skip_reason"])

    audit_errors = list(audit_result.get("errors", []) or [])
    audit_warnings = list(audit_result.get("warnings", []) or [])
    _append_messages(warnings, audit_errors, "AUDIT")
    _append_messages(warnings, audit_warnings, "AUDIT")

    if not audit_valid and not audit_errors:
        _add_unique(warnings, "audit_validation_failed")

    validation_status = "passed" if syntax_valid and file_valid and execution_valid and audit_valid else "failed"

    return {
        "validation_status": validation_status,
        "syntax_valid": syntax_valid,
        "file_valid": file_valid,
        "execution_valid": execution_valid,
        "audit_valid": audit_valid,
        "score": score,
        "errors": errors,
        "warnings": warnings,
    }