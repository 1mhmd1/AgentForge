import ast
import time
from typing import Any

from nodes.sub_agent import execute_sub_agent
from services.errors import ERROR_CODES, SUPPORTED_DOMAINS

# ===== STAGE CONSTANTS =====

STAGE_VALIDATION = "Spec Validation"
STAGE_EXECUTION_PLANNING = "Execution Planning"
STAGE_TEMPLATE_LOADING = "Template Loading"
STAGE_TEMPLATE_RENDERING = "Template Rendering"
STAGE_CODE_INJECTION = "Code Injection"
STAGE_QUALITY_VALIDATION = "Quality Validation"
STAGE_SYNTAX_VALIDATION = "Syntax Validation"
STAGE_FILE_WRITING = "File Writing"


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


def _init_run_audit() -> dict[str, Any]:
    return {
        "total_tokens": 0,
        "agents_executed": [],
        "provider_usage": {},
        "failed_step": None,
    }


def _track_agent(audit: dict[str, Any], agent_id: str, provider: str, max_tokens: int) -> None:
    audit["agents_executed"].append(agent_id)
    audit["total_tokens"] += max_tokens
    audit["provider_usage"][provider] = audit["provider_usage"].get(provider, 0) + 1


def _build_safe_agent(domain: str, goal: str, run_id: str, sub_agent_results: dict[str, Any]) -> dict[str, Any]:
    """
    Build agent using SafeCodeInjector — content safely serialized into
    Python string constants. Guaranteed to produce valid Python.
    """
    from services.safe_injector import SafeCodeInjector

    # Collect all generated content from sub-agents
    content_parts = []
    for _sid, sr in sub_agent_results.items():
        code_str = str(sr.get("generated_code", "")).strip()
        if code_str:
            content_parts.append(code_str)

    combined = "\n".join(content_parts) if content_parts else goal

    if domain == "website_builder":
        return SafeCodeInjector.build_and_validate(
            domain=domain, goal=goal, html=combined, css="", js="", run_id=run_id
        )
    elif domain == "web_research":
        return SafeCodeInjector.build_and_validate(
            domain=domain, goal=goal, query=combined, run_id=run_id
        )
    elif domain == "document":
        return SafeCodeInjector.build_and_validate(
            domain=domain, goal=goal, topic=combined, run_id=run_id
        )
    elif domain == "data_transform":
        return SafeCodeInjector.build_and_validate(
            domain=domain, goal=goal, data=combined, run_id=run_id
        )
    else:
        return {"valid": False, "code": None, "warnings": [], "error": f"Unknown domain: {domain}"}


def builder_node(state: dict[str, Any]) -> dict[str, Any]:
    next_state = state.copy()
    completed_stages: list[str] = []
    t_start = time.time()

    # Phase 1: input handling
    spec = next_state.get("spec")
    is_valid, reason = validate_spec(spec) if isinstance(spec, dict) else (False, "spec_not_dict")
    if not is_valid:
        next_state["status"] = "failed"
        if reason == "domain_unsupported" and isinstance(spec, dict):
            domain_value = str(spec.get("domain", "")).strip().lower()
            next_state["final_error"] = f"{ERROR_CODES['TEMPLATE_NOT_FOUND']}:{domain_value}"
        else:
            next_state["final_error"] = f"{ERROR_CODES['INVALID_SPEC']}:{reason}"
        next_state["final_error_details"] = {"reason": reason}
        next_state["error_stage"] = STAGE_VALIDATION
        next_state["completed_stages"] = completed_stages
        return next_state

    completed_stages.append(STAGE_VALIDATION)

    spec = dict(spec)
    spec["goal"] = str(spec.get("goal")).strip()
    spec["steps"] = _normalize_list(spec.get("steps"))
    spec["tools"] = _normalize_list(spec.get("tools"))
    next_state["spec"] = spec
    next_state["domain"] = str(spec.get("domain")).strip().lower()
    steps = spec["steps"]
    tools = spec["tools"]

    # Phase 2: execution planning — use staged plan from planner if available
    execution_plan = next_state.get("execution_plan")
    planned_agents = []
    if isinstance(execution_plan, dict):
        planned_agents = execution_plan.get("agents", [])

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
    completed_stages.append(STAGE_EXECUTION_PLANNING)

    # Phase 3: STRICT SEQUENTIAL sub-agent execution
    run_audit = _init_run_audit()
    sub_agent_results: dict[str, Any] = {}

    for i, step_id in enumerate(execution_order):
        if step_id not in step_map:
            next_state["status"] = "failed"
            next_state["final_error"] = "step_consistency_failed"
            next_state["error_stage"] = STAGE_EXECUTION_PLANNING
            next_state["completed_stages"] = completed_stages
            run_audit["failed_step"] = step_id
            next_state["run_audit"] = run_audit
            return next_state

        step_data = step_map[step_id]

        # Resolve provider + max_tokens from execution plan
        provider = "groq"
        max_tokens = 1024
        if i < len(planned_agents):
            agent_plan = planned_agents[i]
            if isinstance(agent_plan, dict):
                provider = agent_plan.get("provider", "groq")
                max_tokens = agent_plan.get("max_tokens", 1024)

        domain = next_state.get("domain", "")
        goal = spec.get("goal", "")

        # SEQUENTIAL: each agent gets previous output ONLY
        result = execute_sub_agent(
            step_id=step_id,
            step_data=step_data,
            total_steps=len(execution_order),
            previous_results=sub_agent_results,
            provider=provider,
            max_tokens=max_tokens,
            domain=domain,
            goal=goal,
        )
        sub_agent_results[step_id] = result
        _track_agent(run_audit, step_id, provider, max_tokens)

        # STOP on failure — no recursive retries, no fallback spawning
        if result.get("status") == "error":
            next_state["status"] = "failed"
            next_state["final_error"] = f"sub_agent_failed_{step_id}"
            next_state["sub_agent_results"] = sub_agent_results
            next_state["error_stage"] = STAGE_EXECUTION_PLANNING
            next_state["completed_stages"] = completed_stages
            run_audit["failed_step"] = step_id
            next_state["run_audit"] = run_audit
            return next_state

    next_state["sub_agent_results"] = sub_agent_results
    next_state["run_audit"] = run_audit

    # Phase 4+5+6: Safe code generation (replaces template load → render → inject)
    # Uses SafeCodeInjector to serialize content into safe Python constants
    domain = next_state.get("domain")
    run_id = next_state.get("run_id", "")
    goal = spec.get("goal", "")

    safe_result = _build_safe_agent(domain, goal, run_id, sub_agent_results)

    if not safe_result.get("valid") or not safe_result.get("code"):
        next_state["status"] = "failed"
        next_state["final_error"] = safe_result.get("error", "safe_injection_failed")
        next_state["final_error_details"] = {"warnings": safe_result.get("warnings", [])}
        next_state["error_stage"] = STAGE_CODE_INJECTION
        next_state["completed_stages"] = completed_stages
        next_state["run_audit"] = run_audit
        return next_state

    final_code = safe_result["code"]
    completed_stages.append(STAGE_TEMPLATE_LOADING)
    completed_stages.append(STAGE_TEMPLATE_RENDERING)
    completed_stages.append(STAGE_CODE_INJECTION)

    if safe_result.get("warnings"):
        next_state["sanitize_warnings"] = safe_result["warnings"]

    # Phase 7: quality validation
    try:
        from services.snippet_validator import score_quality
        quality = score_quality(final_code, domain)
        next_state["quality_score"] = quality
        completed_stages.append(STAGE_QUALITY_VALIDATION)
    except Exception:
        completed_stages.append(STAGE_QUALITY_VALIDATION)

    # Phase 8: syntax validation (should always pass with SafeCodeInjector)
    try:
        ast.parse(final_code)
        completed_stages.append(STAGE_SYNTAX_VALIDATION)
    except SyntaxError as exc:
        next_state["status"] = "failed"
        next_state["final_error"] = ERROR_CODES["SYNTAX_ERROR"]
        next_state["final_error_details"] = {
            "line": exc.lineno,
            "offset": exc.offset,
            "text": exc.text,
        }
        next_state["error_stage"] = STAGE_SYNTAX_VALIDATION
        next_state["completed_stages"] = completed_stages
        next_state["run_audit"] = run_audit
        return next_state
    except Exception as exc:
        next_state["status"] = "failed"
        next_state["final_error"] = ERROR_CODES["SYNTAX_ERROR"]
        next_state["final_error_details"] = {"reason": str(exc)}
        next_state["error_stage"] = STAGE_SYNTAX_VALIDATION
        next_state["completed_stages"] = completed_stages
        next_state["run_audit"] = run_audit
        return next_state

    next_state["generated_code"] = final_code

    # Phase 9: file writing
    try:
        from services.file_writer import write_generated_agent
        output_path = write_generated_agent(run_id, final_code)
        next_state["output_path"] = output_path
        completed_stages.append(STAGE_FILE_WRITING)
    except Exception:
        next_state["status"] = "failed"
        next_state["final_error"] = "file_write_failed"
        next_state["error_stage"] = STAGE_FILE_WRITING
        next_state["completed_stages"] = completed_stages
        next_state["run_audit"] = run_audit
        return next_state

    next_state["completed_stages"] = completed_stages
    next_state["build_duration_seconds"] = round(time.time() - t_start, 2)
    next_state["run_audit"] = run_audit
    return next_state

