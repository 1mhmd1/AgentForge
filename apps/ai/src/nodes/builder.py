import ast
import logging
import time
from typing import Any

from nodes.sub_agent import execute_sub_agent
from services.template_loader import load_template
from services.template_renderer import render_template
from services.code_injector import inject_code
from services.snippet_validator import score_quality
from services.file_writer import write_generated_agent
from services.errors import ERROR_CODES, SUPPORTED_DOMAINS

logger = logging.getLogger(__name__)

STAGE_VALIDATION = "VALIDATION"
STAGE_EXECUTION_PLANNING = "EXECUTION_PLANNING"
STAGE_TEMPLATE_LOADING = "TEMPLATE_LOADING"
STAGE_TEMPLATE_RENDERING = "TEMPLATE_RENDERING"
STAGE_CODE_INJECTION = "CODE_INJECTION"
STAGE_QUALITY_VALIDATION = "QUALITY_VALIDATION"
STAGE_SYNTAX_VALIDATION = "SYNTAX_VALIDATION"
STAGE_FILE_WRITING = "FILE_WRITING"


def _normalize_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        items: list[str] = []
        for item in value:
            if item is None:
                continue
            text = str(item).strip()
            if text:
                items.append(text)
        return items
    if isinstance(value, str):
        text = value.strip()
        return [text] if text else []
    text = str(value).strip()
    return [text] if text else []


def validate_spec(spec: dict[str, Any]) -> tuple[bool, str | None]:
    if not isinstance(spec, dict):
        return False, "spec_not_dict"

    goal = spec.get("goal")
    if not isinstance(goal, str) or not goal.strip():
        return False, "goal_missing"

    steps = spec.get("steps")
    if not isinstance(steps, list) or not steps:
        return False, "steps_missing"
    if not all(isinstance(step, str) and step.strip() for step in steps):
        return False, "steps_invalid"

    tools = spec.get("tools", [])
    if tools is not None and not isinstance(tools, list):
        return False, "tools_invalid"

    domain = spec.get("domain")
    if not isinstance(domain, str) or not domain.strip():
        return False, "domain_missing"
    normalized = domain.strip().lower()
    if normalized not in SUPPORTED_DOMAINS:
        return False, "domain_unsupported"

    return True, None


def _initialize_stage_tracking(state: dict[str, Any]) -> dict[str, Any]:
    next_state = dict(state)
    completed = next_state.get("completed_stages")
    if completed is None:
        completed = []
    next_state["completed_stages"] = list(completed)
    if "current_stage" not in next_state:
        next_state["current_stage"] = None
    if "error_stage" not in next_state:
        next_state["error_stage"] = None
    return next_state


def _enter_stage(state: dict[str, Any], stage: str) -> dict[str, Any]:
    next_state = dict(state)
    next_state["current_stage"] = stage
    completed = next_state.get("completed_stages")
    if completed is None:
        completed = []
    next_state["completed_stages"] = list(completed)
    return next_state


def _complete_stage(state: dict[str, Any], stage: str) -> dict[str, Any]:
    next_state = dict(state)
    completed = list(next_state.get("completed_stages") or [])
    if stage not in completed:
        completed.append(stage)
    next_state["completed_stages"] = completed
    return next_state


def _finalize_timing(state: dict[str, Any]) -> dict[str, Any]:
    next_state = dict(state)
    completed_at = time.time()
    next_state["completed_at"] = completed_at
    started_at = next_state.get("started_at")
    if isinstance(started_at, (int, float)):
        next_state["build_duration_seconds"] = max(0.0, completed_at - float(started_at))
    return next_state


def build_failure_state(
    state: dict[str, Any],
    error_code: str,
    details: dict[str, Any] | None = None,
    stage: str | None = None,
) -> dict[str, Any]:
    next_state = dict(state)
    next_state["status"] = "failed"
    next_state["final_error"] = error_code
    next_state["final_error_details"] = details
    if stage:
        next_state["error_stage"] = stage
    next_state = _finalize_timing(next_state)
    return next_state


def builder_node(state: dict[str, Any]) -> dict[str, Any]:
    next_state = _initialize_stage_tracking(state)
    next_state["started_at"] = time.time()
    next_state["build_duration_seconds"] = None
    next_state["error_stage"] = None
    logger.info("builder_start", extra={"run_id": next_state.get("run_id")})

    # Phase 1: input handling
    next_state = _enter_stage(next_state, STAGE_VALIDATION)
    logger.info("builder_validation_start", extra={"run_id": next_state.get("run_id")})
    spec = next_state.get("spec")
    is_valid, reason = validate_spec(spec) if isinstance(spec, dict) else (False, "spec_not_dict")
    if not is_valid:
        if reason == "domain_unsupported" and isinstance(spec, dict):
            domain_value = str(spec.get("domain", "")).strip().lower()
            error_code = f"{ERROR_CODES['TEMPLATE_NOT_FOUND']}:{domain_value}"
        else:
            error_code = f"{ERROR_CODES['INVALID_SPEC']}:{reason}"
        logger.error("builder_validation_failed", extra={"run_id": next_state.get("run_id"), "reason": reason})
        return build_failure_state(
            next_state,
            error_code,
            details={"reason": reason},
            stage=STAGE_VALIDATION,
        )

    spec = dict(spec)
    spec["goal"] = str(spec.get("goal")).strip()
    spec["steps"] = _normalize_list(spec.get("steps"))
    spec["tools"] = _normalize_list(spec.get("tools"))
    next_state["spec"] = spec
    next_state["domain"] = str(spec.get("domain")).strip().lower()
    steps = spec["steps"]
    tools = spec["tools"]
    next_state = _complete_stage(next_state, STAGE_VALIDATION)
    logger.info("builder_validation_success", extra={"run_id": next_state.get("run_id")})

    # Phase 2: execution planning
    next_state = _enter_stage(next_state, STAGE_EXECUTION_PLANNING)
    logger.info("builder_execution_planning_start", extra={"run_id": next_state.get("run_id")})
    step_map: dict[str, dict[str, Any]] = {}
    execution_order: list[str] = []

    for index, step in enumerate(steps, start=1):
        step_id = f"step_{index}"
        step_map[step_id] = {
            "order": index,
            "text": step,
            "tools": tools,
        }
        execution_order.append(step_id)

    next_state["step_map"] = step_map
    next_state["execution_order"] = execution_order
    next_state["stage"] = "building"
    next_state["status"] = "running"

    sub_agent_results: dict[str, Any] = {}

    for step_id in execution_order:
        if step_id not in step_map:
            logger.error("builder_step_consistency_failed", extra={"run_id": next_state.get("run_id"), "step_id": step_id})
            return build_failure_state(
                next_state,
                "step_consistency_failed",
                details={"step_id": step_id},
                stage=STAGE_EXECUTION_PLANNING,
            )
        step_data = step_map[step_id]
        result = execute_sub_agent(
            step_id=step_id,
            step_data=step_data,
            total_steps=len(execution_order),
            previous_results=sub_agent_results,
        )
        sub_agent_results[step_id] = result

        if result.get("status") == "error":
            next_state["sub_agent_results"] = sub_agent_results
            logger.error("builder_sub_agent_failed", extra={"run_id": next_state.get("run_id"), "step_id": step_id})
            return build_failure_state(
                next_state,
                f"sub_agent_failed_{step_id}",
                details={"step_id": step_id},
                stage=STAGE_EXECUTION_PLANNING,
            )

    next_state["sub_agent_results"] = sub_agent_results
    next_state = _complete_stage(next_state, STAGE_EXECUTION_PLANNING)
    logger.info("builder_execution_planning_success", extra={"run_id": next_state.get("run_id")})

    domain = next_state.get("domain")
    next_state = _enter_stage(next_state, STAGE_TEMPLATE_LOADING)
    logger.info("builder_template_loading_start", extra={"run_id": next_state.get("run_id")})
    try:
        template_path, template_text = load_template(domain)
        next_state["template_path"] = template_path
    except Exception as exc:
        logger.error("builder_template_loading_failed", extra={"run_id": next_state.get("run_id"), "reason": str(exc)})
        return build_failure_state(
            next_state,
            str(exc),
            details={"reason": str(exc)},
            stage=STAGE_TEMPLATE_LOADING,
        )
    next_state = _complete_stage(next_state, STAGE_TEMPLATE_LOADING)
    logger.info("builder_template_loading_success", extra={"run_id": next_state.get("run_id")})

    context = {
        "run_id": next_state.get("run_id"),
        "goal": spec.get("goal"),
        "domain": spec.get("domain"),
        "steps": spec.get("steps", []),
        "tools": spec.get("tools", []),
        "inputs": spec.get("inputs", []),
        "outputs": spec.get("outputs", []),
        "complexity": spec.get("complexity"),
        "success_criteria": spec.get("success_criteria"),
        "sub_agent_results": sub_agent_results,
    }

    next_state = _enter_stage(next_state, STAGE_TEMPLATE_RENDERING)
    logger.info("builder_template_rendering_start", extra={"run_id": next_state.get("run_id")})
    try:
        rendered = render_template(template_text, context)
        if not isinstance(rendered, str):
            raise RuntimeError("Rendered template is not a string")
    except Exception as exc:
        logger.error("builder_template_rendering_failed", extra={"run_id": next_state.get("run_id"), "reason": str(exc)})
        return build_failure_state(
            next_state,
            str(exc),
            details={"reason": str(exc)},
            stage=STAGE_TEMPLATE_RENDERING,
        )
    next_state = _complete_stage(next_state, STAGE_TEMPLATE_RENDERING)
    logger.info("builder_template_rendering_success", extra={"run_id": next_state.get("run_id")})

    next_state = _enter_stage(next_state, STAGE_CODE_INJECTION)
    logger.info("builder_code_injection_start", extra={"run_id": next_state.get("run_id")})
    try:
        final_code = inject_code(rendered, sub_agent_results)
        if not isinstance(final_code, str):
            raise RuntimeError("Generated code is not a string")
        if not final_code.strip():
            raise RuntimeError("Generated code is empty")
    except Exception as exc:
        logger.error("builder_code_injection_failed", extra={"run_id": next_state.get("run_id"), "reason": str(exc)})
        return build_failure_state(
            next_state,
            str(exc),
            details={"reason": str(exc)},
            stage=STAGE_CODE_INJECTION,
        )
    next_state = _complete_stage(next_state, STAGE_CODE_INJECTION)
    logger.info("builder_code_injection_success", extra={"run_id": next_state.get("run_id")})

    next_state = _enter_stage(next_state, STAGE_QUALITY_VALIDATION)
    logger.info("builder_quality_validation_start", extra={"run_id": next_state.get("run_id")})
    try:
        next_state["quality_score"] = score_quality(final_code, next_state.get("domain"))
    except Exception as exc:
        logger.warning("builder_quality_validation_failed", extra={"run_id": next_state.get("run_id"), "reason": str(exc)})
        next_state["quality_score"] = None
    next_state = _complete_stage(next_state, STAGE_QUALITY_VALIDATION)
    logger.info("builder_quality_validation_success", extra={"run_id": next_state.get("run_id")})

    next_state = _enter_stage(next_state, STAGE_SYNTAX_VALIDATION)
    logger.info("builder_syntax_validation_start", extra={"run_id": next_state.get("run_id")})
    try:
        ast.parse(final_code)
    except SyntaxError as exc:
        logger.error("builder_syntax_validation_failed", extra={"run_id": next_state.get("run_id"), "reason": str(exc)})
        return build_failure_state(
            next_state,
            ERROR_CODES["SYNTAX_ERROR"],
            details={
                "line": exc.lineno,
                "offset": exc.offset,
                "text": exc.text,
            },
            stage=STAGE_SYNTAX_VALIDATION,
        )
    except Exception as exc:
        logger.error("builder_syntax_validation_failed", extra={"run_id": next_state.get("run_id"), "reason": str(exc)})
        return build_failure_state(
            next_state,
            ERROR_CODES["SYNTAX_ERROR"],
            details={"reason": str(exc)},
            stage=STAGE_SYNTAX_VALIDATION,
        )
    next_state = _complete_stage(next_state, STAGE_SYNTAX_VALIDATION)
    logger.info("builder_syntax_validation_success", extra={"run_id": next_state.get("run_id")})

    next_state["generated_code"] = final_code

    next_state = _enter_stage(next_state, STAGE_FILE_WRITING)
    logger.info("builder_file_writing_start", extra={"run_id": next_state.get("run_id")})
    try:
        output_path = write_generated_agent(next_state.get("run_id", ""), final_code)
        next_state["output_path"] = output_path
    except Exception as exc:
        logger.error("builder_file_writing_failed", extra={"run_id": next_state.get("run_id"), "reason": str(exc)})
        return build_failure_state(
            next_state,
            "file_write_failed",
            details={"reason": str(exc)},
            stage=STAGE_FILE_WRITING,
        )
    next_state = _complete_stage(next_state, STAGE_FILE_WRITING)
    logger.info("builder_file_writing_success", extra={"run_id": next_state.get("run_id")})

    next_state = _finalize_timing(next_state)
    logger.info("builder_complete", extra={"run_id": next_state.get("run_id")})
    return next_state
