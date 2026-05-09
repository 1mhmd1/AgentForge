from __future__ import annotations

import time
from pathlib import Path
from typing import Any

from .audit_checker import validate_audit
from .execution_checker import validate_execution
from .file_checker import validate_file
from .syntax_checker import SKIP_SYNTAX_EXTENSIONS, validate_syntax
from .validation_report import build_validation_report


def _log_stage(stage: str, passed: bool, elapsed: float, error_summary: str | None = None) -> None:
    summary = error_summary or "ok"
    summary = summary.replace("\n", " ").strip()
    if len(summary) > 120:
        summary = summary[:120] + "..."
    print(f"{stage} | {'pass' if passed else 'fail'} | {elapsed:.4f}s | {summary}")


def _normalize_path_list(paths: Any) -> list[str]:
    if not isinstance(paths, list):
        return []
    normalized: list[str] = []
    for item in paths:
        if isinstance(item, str) and item.strip():
            normalized.append(item.strip())
    return normalized


def _file_extension(path: str) -> str:
    lower_name = Path(path).name.lower()
    if lower_name.endswith(".env.example"):
        return ".env.example"
    return Path(path).suffix.lower()


def _read_text_file(path: str) -> tuple[str | None, str | None]:
    try:
        return Path(path).read_text(encoding="utf-8"), None
    except Exception as exc:
        return None, str(exc)


def _extract_primary_error(errors: list[str]) -> tuple[str, str]:
    if not errors:
        return "ValidationError", "validation_failed"
    first = errors[0]
    if ":" in first:
        prefix, remainder = first.split(":", 1)
        return prefix.strip(), remainder.strip()
    return "ValidationError", first


def _build_repair_payload(stage: str, failure_reason: str, error_message: str, recommended_fix: str) -> dict[str, Any]:
    return {
        "repair_context": {
            "failed_stage": stage,
            "failure_reason": failure_reason,
            "error_message": error_message,
            "recommended_fix": recommended_fix,
        }
    }


def _state_validation_errors(state: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if not isinstance(state, dict):
        return ["state_not_dict"]

    for key in ("generated_code", "output_path", "run_audit", "status"):
        if key not in state:
            errors.append(f"missing_required_field:{key}")

    generated_code = state.get("generated_code")
    if not isinstance(generated_code, str) or not generated_code.strip():
        errors.append("generated_code_missing_or_invalid")

    output_path = state.get("output_path")
    if not isinstance(output_path, str) or not output_path.strip():
        errors.append("output_path_missing_or_invalid")

    run_audit = state.get("run_audit")
    if not isinstance(run_audit, dict):
        errors.append("run_audit_missing_or_invalid")

    status = state.get("status")
    if not isinstance(status, str) or not status.strip():
        errors.append("status_missing_or_invalid")

    return errors


def run_validation(state: dict) -> dict:
    next_state = state if isinstance(state, dict) else {}

    state_start = time.perf_counter()
    state_errors = _state_validation_errors(next_state)
    state_elapsed = time.perf_counter() - state_start
    state_passed = len(state_errors) == 0
    _log_stage("State Validation", state_passed, state_elapsed, state_errors[0] if state_errors else None)

    if not state_passed:
        failure_reason, error_message = _extract_primary_error(state_errors)
        validation_report = {
            "validation_status": "failed",
            "syntax_valid": False,
            "file_valid": False,
            "execution_valid": False,
            "audit_valid": False,
            "score": 0,
            "errors": [f"CRITICAL: {error_message}"],
            "warnings": [],
        }
        return {
            "validation_status": "failed",
            "validation_report": validation_report,
            "validation_score": 0,
            "validation_errors": [f"CRITICAL: {error_message}"],
            "repair_payload": _build_repair_payload(
                "state_validation",
                failure_reason,
                error_message,
                "Provide all required state fields before validation.",
            ),
            "can_continue": False,
        }

    generated_code = str(next_state.get("generated_code", ""))
    syntax_started = time.perf_counter()
    syntax_result = validate_syntax(generated_code, ".py")

    generated_files = _normalize_path_list(next_state.get("generated_files"))
    generated_file_details: list[dict[str, Any]] = []
    syntax_errors: list[str] = []
    syntax_valid = bool(syntax_result.get("valid"))

    if not syntax_valid:
        syntax_error = syntax_result.get("error") or "syntax_validation_failed"
        syntax_errors.append(syntax_error)

    unique_files: list[str] = []
    for file_path in generated_files:
        if file_path not in unique_files:
            unique_files.append(file_path)

    for file_path in unique_files:
        file_ext = _file_extension(file_path)
        if file_ext not in SKIP_SYNTAX_EXTENSIONS and file_ext not in {".py", ".js", ".jsx", ".ts", ".tsx"}:
            syntax_errors.append(f"unsupported_extension:{file_ext or file_path}")
            syntax_valid = False
            continue

        file_content, read_error = _read_text_file(file_path)
        if read_error is not None or file_content is None:
            syntax_errors.append(f"missing_generated_file:{file_path}")
            syntax_valid = False
            continue

        file_result = validate_syntax(file_content, file_ext)
        generated_file_details.append({"path": file_path, **file_result})
        if not file_result.get("valid"):
            syntax_valid = False
            syntax_errors.append(file_result.get("error") or f"syntax_failed:{file_path}")

    syntax_elapsed = time.perf_counter() - syntax_started
    _log_stage("Syntax Validation", syntax_valid, syntax_elapsed, syntax_errors[0] if syntax_errors else syntax_result.get("error"))

    if not syntax_valid:
        failure_reason, error_message = _extract_primary_error(syntax_errors or [str(syntax_result.get("error") or "syntax_validation_failed")])
        validation_report = build_validation_report(
            {**syntax_result, "valid": False, "errors": syntax_errors, "details": generated_file_details},
            {"valid": True, "errors": [], "warnings": []},
            {"valid": False, "skipped": True, "skip_reason": "skipped_due_to_syntax_failure", "output_truncated": False, "error": "skipped_due_to_syntax_failure"},
            {"valid": True, "errors": [], "warnings": ["skipped_due_to_syntax_failure"]},
        )
        validation_report["validation_status"] = "failed"
        return {
            "validation_status": "failed",
            "validation_report": validation_report,
            "validation_score": validation_report["score"],
            "validation_errors": validation_report["errors"],
            "repair_payload": _build_repair_payload(
                "syntax_validation",
                failure_reason,
                error_message,
                "Fix the Python syntax error in generated_code or the invalid generated file.",
            ),
            "can_continue": False,
            "execution_result": {"valid": False, "skipped": True, "skip_reason": "skipped_due_to_syntax_failure"},
        }

    file_targets: list[str] = []
    output_path = str(next_state.get("output_path", "")).strip()
    if output_path:
        file_targets.append(output_path)
    for file_path in unique_files:
        if file_path not in file_targets:
            file_targets.append(file_path)

    file_details: list[dict[str, Any]] = []
    file_valid = True
    file_errors: list[str] = []
    for file_path in file_targets:
        file_result = validate_file(file_path)
        file_details.append({"path": file_path, **file_result})
        if not file_result.get("valid"):
            file_valid = False
            file_errors.append(file_result.get("error") or f"file_invalid:{file_path}")

    file_elapsed = time.perf_counter() - syntax_started - syntax_elapsed
    _log_stage("File Validation", file_valid, file_elapsed, file_errors[0] if file_errors else None)

    execution_result: dict[str, Any] = {
        "valid": False,
        "exit_code": -1,
        "stdout": "",
        "stderr": "",
        "execution_time": 0.0,
        "output_truncated": False,
        "skipped": True,
        "skip_reason": "skipped_due_to_file_validation",
        "error": None,
    }

    if syntax_valid and file_valid:
        execution_result = validate_execution(output_path, next_state.get("sandbox_workdir"))

    execution_elapsed = execution_result.get("execution_time", 0.0)
    _log_stage("Execution Validation", bool(execution_result.get("valid")), execution_elapsed, execution_result.get("error"))

    audit_started = time.perf_counter()
    run_audit = next_state.get("run_audit") if isinstance(next_state.get("run_audit"), dict) else {}
    audit_result = validate_audit(run_audit)
    audit_elapsed = time.perf_counter() - audit_started
    _log_stage("Audit Validation", bool(audit_result.get("valid")), audit_elapsed, audit_result.get("errors", [None])[0] if audit_result.get("errors") else None)

    validation_report = build_validation_report(
        {**syntax_result, "valid": syntax_valid, "errors": syntax_errors, "details": generated_file_details},
        {"valid": file_valid, "errors": file_errors, "details": file_details},
        execution_result,
        audit_result,
    )

    report_elapsed = time.perf_counter() - audit_started
    _log_stage("Report Generation", validation_report["validation_status"] == "passed", report_elapsed, validation_report["errors"][0] if validation_report["errors"] else None)

    validation_errors = list(validation_report.get("errors", []))
    if not validation_errors and validation_report.get("validation_status") != "passed":
        validation_errors = ["validation_failed"]

    if validation_report["validation_status"] == "passed":
        repair_payload = None
    else:
        if not syntax_valid:
            failed_stage = "syntax_validation"
            failure_reason, error_message = _extract_primary_error(syntax_errors or [str(syntax_result.get("error") or "syntax_validation_failed")])
            recommended_fix = "Fix the syntax error in generated_code or generated_files."
        elif not file_valid:
            failed_stage = "file_validation"
            failure_reason, error_message = _extract_primary_error(file_errors or ["file_validation_failed"])
            recommended_fix = "Create the missing file, ensure it is readable, and use an allowed extension."
        elif not bool(execution_result.get("valid")):
            failed_stage = "execution_validation"
            failure_reason = execution_result.get("error") or "ExecutionError"
            error_message = (execution_result.get("stderr") or execution_result.get("stdout") or failure_reason)
            recommended_fix = "Fix the runtime error in the generated Python entrypoint."
        elif not audit_result.get("valid"):
            failed_stage = "audit_validation"
            failure_reason, error_message = _extract_primary_error(audit_result.get("errors", []) or ["audit_validation_failed"])
            recommended_fix = "Normalize run_audit so required counters are present and non-negative integers."
        else:
            failed_stage = "validation"
            failure_reason, error_message = _extract_primary_error(validation_errors or ["validation_failed"])
            recommended_fix = "Review the validation report and repair the first reported issue."

        repair_payload = _build_repair_payload(failed_stage, failure_reason, error_message, recommended_fix)

    return {
        "validation_status": validation_report["validation_status"],
        "validation_report": validation_report,
        "validation_score": validation_report["score"],
        "validation_errors": validation_errors,
        "repair_payload": repair_payload,
        "can_continue": validation_report["validation_status"] == "passed",
        "execution_result": execution_result,
    }