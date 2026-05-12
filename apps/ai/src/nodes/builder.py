import ast
import os
import time
from datetime import datetime, timezone
from typing import Any

from nodes.sub_agent import execute_sub_agent
from services.errors import ERROR_CODES, SUPPORTED_DOMAINS
from services.tracer import record_event

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
        "prompt_tokens": 0,
        "completion_tokens": 0,
        "agents_executed": [],
        "provider_usage": {},
        "per_agent_tokens": {},
        "failed_step": None,
    }


def _track_agent(audit: dict[str, Any], agent_id: str, provider: str, usage: dict[str, Any] | None) -> None:
    audit["agents_executed"].append(agent_id)
    audit["provider_usage"][provider] = audit["provider_usage"].get(provider, 0) + 1
    if not isinstance(usage, dict):
        return
    prompt_t = int(usage.get("prompt_tokens", 0) or 0)
    comp_t = int(usage.get("completion_tokens", 0) or 0)
    total_t = int(usage.get("total_tokens", 0) or 0) or (prompt_t + comp_t)
    audit["prompt_tokens"] += prompt_t
    audit["completion_tokens"] += comp_t
    audit["total_tokens"] += total_t
    audit["per_agent_tokens"][agent_id] = {
        "prompt_tokens": prompt_t,
        "completion_tokens": comp_t,
        "total_tokens": total_t,
        "provider": provider,
    }


def _build_safe_agent(domain: str, goal: str, run_id: str, sub_agent_results: dict[str, Any], attachment: dict[str, Any] | None = None) -> dict[str, Any]:
    """
    Build agent using SafeCodeInjector -- content safely serialized into
    Python string constants. Guaranteed to produce valid Python.
    """
    from services.safe_injector import SafeCodeInjector

    # Sequential pipeline contract: each step rewrites the whole, so the LAST
    # step's output is the final artifact for text domains. data_transform is
    # the exception -- its steps are additive, so we keep the concatenation.
    ordered_keys = sorted(sub_agent_results.keys())
    if domain == "data_transform":
        parts = [str(sub_agent_results[k].get("generated_code", "")).strip() for k in ordered_keys]
        combined = "\n".join(p for p in parts if p)
    else:
        combined = ""
        for k in reversed(ordered_keys):
            candidate = str(sub_agent_results[k].get("generated_code", "")).strip()
            if candidate:
                combined = candidate
                break

    if not combined:
        combined = goal

    if domain == "website_builder":
        # Run HTML structural dedup on the RAW HTML before SafeCodeInjector
        # wraps it in a Python string literal. Done here (not after) because
        # dedup_html operates on HTML; running it on Python source corrupts
        # string literal boundaries and breaks `ast.parse`.
        try:
            from services.html_dedup import dedup_html
            combined_clean, dedup_report = dedup_html(combined)
            if not dedup_report.get("is_clean", True):
                record_event(
                    run_id, "html_dedup_applied",
                    dropped=dedup_report.get("dropped_duplicates"),
                    merged_style_blocks=dedup_report.get("merged_style_blocks"),
                    deduped_sections=dedup_report.get("deduped_sections"),
                )
                combined = combined_clean
        except Exception as exc:
            # Dedup failures must never block the build.
            record_event(run_id, "html_dedup_failed", error=str(exc))

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
        if attachment and attachment.get("content_b64"):
            return SafeCodeInjector.build_and_validate(
                domain=domain,
                goal=goal,
                data=combined,
                run_id=run_id,
                input_filename=attachment.get("filename"),
                input_mimetype=attachment.get("mimetype"),
                input_bytes_b64=attachment.get("content_b64"),
            )
        return SafeCodeInjector.build_and_validate(
            domain=domain, goal=goal, data=combined, run_id=run_id
        )
    else:
        return {"valid": False, "code": None, "warnings": [], "error": f"Unknown domain: {domain}"}


def builder_node(state: dict[str, Any]) -> dict[str, Any]:
    next_state = state.copy()
    completed_stages: list[str] = []
    t_start = time.time()
    record_event(next_state.get("run_id"), "node_enter", node="builder")

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

    # Phase 2: execution planning -- use staged plan from planner if available
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
    # Carry forward planner's actual token usage so the audit reflects the
    # whole pipeline, not just the build step.
    planner_usage = next_state.get("planner_usage")
    if isinstance(planner_usage, dict):
        run_audit["prompt_tokens"] += int(planner_usage.get("prompt_tokens", 0) or 0)
        run_audit["completion_tokens"] += int(planner_usage.get("completion_tokens", 0) or 0)
        run_audit["total_tokens"] += int(planner_usage.get("total_tokens", 0) or 0)
        run_audit["per_agent_tokens"]["planner"] = {
            "prompt_tokens": int(planner_usage.get("prompt_tokens", 0) or 0),
            "completion_tokens": int(planner_usage.get("completion_tokens", 0) or 0),
            "total_tokens": int(planner_usage.get("total_tokens", 0) or 0),
            "provider": planner_usage.get("provider", "unknown"),
        }
    sub_agent_results: dict[str, Any] = {}

    # MCP doc fetch: one-shot before step_1, off by default. Empty string when
    # disabled or on any failure -- never blocks the build.
    from services.mcp_tools import fetch_docs_context as _fetch_docs_context
    domain_for_docs = next_state.get("domain", "")
    goal_for_docs = spec.get("goal", "")
    docs_context = _fetch_docs_context(domain_for_docs, goal_for_docs)

    # Checkpoint resume: if state was hydrated from a saved checkpoint, honour
    # the sub_agent_results that already ran and skip those step ids in the
    # loop below. `resumed_from_step` (1-indexed) is informational; the source
    # of truth is which step_ids are already in sub_agent_results.
    from services import checkpoint_store as _cp
    resumed_results = next_state.get("sub_agent_results")
    if isinstance(resumed_results, dict) and resumed_results:
        sub_agent_results = dict(resumed_results)
    resumed_completed: set[str] = set(sub_agent_results.keys())
    if resumed_completed:
        record_event(
            next_state.get("run_id"), "builder_resumed",
            completed_step_count=len(resumed_completed),
            completed=sorted(resumed_completed),
        )

    for i, step_id in enumerate(execution_order):
        if step_id not in step_map:
            next_state["status"] = "failed"
            next_state["final_error"] = "step_consistency_failed"
            next_state["error_stage"] = STAGE_EXECUTION_PLANNING
            next_state["completed_stages"] = completed_stages
            run_audit["failed_step"] = step_id
            next_state["run_audit"] = run_audit
            return next_state

        # Resume: skip step ids that completed in a prior invocation. The
        # cached result is already in sub_agent_results, so the loop just
        # rolls forward to the first not-yet-done step.
        if step_id in resumed_completed:
            continue

        step_data = step_map[step_id]

        # Resolve provider + max_tokens from execution plan
        provider = "groq"
        max_tokens = 1024
        if i < len(planned_agents):
            agent_plan = planned_agents[i]
            if isinstance(agent_plan, dict):
                # Default per-sub-agent provider is gemini (matches LLM_PROVIDER
                # default + the planner prompt's "use gemini" rule). groq is
                # automatically used as the fallback via call_llm() when gemini
                # quota / errors out.
                provider = agent_plan.get("provider", "gemini")
                max_tokens = agent_plan.get("max_tokens", 1024)
        # Inspection-mode override. When AGENTFORGE_SUB_AGENT_MAX_TOKENS is set
        # (positive integer), it replaces the planner-allocated max_tokens for
        # every sub_agent call. Use it to see full un-truncated outputs across
        # all sub_agents regardless of which provider is active. Unset to
        # restore per-agent budgets from the planner spec. Provider-agnostic;
        # composes with GEMINI_MAX_TOKENS_OVERRIDE (which is gemini-only).
        _sub_override = os.getenv("AGENTFORGE_SUB_AGENT_MAX_TOKENS", "").strip()
        if _sub_override.isdigit() and int(_sub_override) > 0:
            max_tokens = int(_sub_override)
        # Provider override. When AGENTFORGE_FORCE_SUB_AGENT_PROVIDER is set
        # to a known provider name (groq / gemini / minimax / kimi), it
        # replaces whatever provider the planner spec specified for every
        # sub_agent call. Useful when LLM_PROVIDER=gemini but the planner
        # keeps emitting "groq" in its agents[] array. Unset to honor the
        # planner spec's per-agent provider choice.
        _force_provider = os.getenv("AGENTFORGE_FORCE_SUB_AGENT_PROVIDER", "").strip().lower()
        if _force_provider in {"groq", "gemini", "minimax", "kimi"}:
            provider = _force_provider

        domain = next_state.get("domain", "")
        goal = spec.get("goal", "")

        # SEQUENTIAL: each agent gets previous output ONLY.
        # docs_context is only sent to step_1; later steps already have the
        # earlier output (which was itself informed by the docs).
        result = execute_sub_agent(
            step_id=step_id,
            step_data=step_data,
            total_steps=len(execution_order),
            previous_results=sub_agent_results,
            provider=provider,
            max_tokens=max_tokens,
            domain=domain,
            goal=goal,
            docs_context=docs_context if i == 0 else "",
        )
        sub_agent_results[step_id] = result
        _track_agent(run_audit, step_id, provider, result.get("usage"))

        # On terminal sub-agent failure: save a checkpoint so the user can
        # resume from this step in a later /run call (pass resume_run_id).
        # Status becomes INTERRUPTED, NOT FAILED -- the pipeline didn't hit
        # an unrecoverable error, it paused. Sub-agent's own internal retries
        # are still the first line of defense; this is the second.
        if result.get("status") == "error":
            next_state["sub_agent_results"] = sub_agent_results
            next_state["error_stage"] = STAGE_EXECUTION_PLANNING
            next_state["completed_stages"] = completed_stages
            run_audit["failed_step"] = step_id
            next_state["run_audit"] = run_audit
            completed_step_ids = sorted(resumed_completed | set(execution_order[:i]))
            saved = _cp.save_checkpoint(
                next_state,
                extra={
                    "completed_steps": completed_step_ids,
                    "failed_step": step_id,
                    "final_error": f"sub_agent_failed_{step_id}",
                    "status": "interrupted",
                },
            )
            next_state["status"] = "interrupted"
            next_state["final_error"] = f"sub_agent_failed_{step_id}"
            next_state["checkpoint_saved"] = saved
            return next_state

        # Success: persist a checkpoint after every step so a future crash
        # (process kill, Gemini quota exhaustion mid-run, etc.) can resume.
        completed_so_far = sorted(resumed_completed | set(execution_order[: i + 1]))
        _cp.save_checkpoint(
            next_state,
            extra={
                "completed_steps": completed_so_far,
                "sub_agent_results": sub_agent_results,
                "run_audit": run_audit,
                "status": "running",
            },
        )

    next_state["sub_agent_results"] = sub_agent_results
    next_state["run_audit"] = run_audit

    # Phase 4+5+6: Safe code generation (replaces template load -> render -> inject)
    # Uses SafeCodeInjector to serialize content into safe Python constants
    domain = next_state.get("domain")
    run_id = next_state.get("run_id", "")
    goal = spec.get("goal", "")

    # Template retrieval: try Qdrant first, fall back to SafeCodeInjector.
    # Off automatically when QDRANT_URL is unset or sentence-transformers
    # cannot load. Failures here MUST NOT block the build.
    retrieved_template = None
    try:
        from services import template_store as _ts
        if _ts.is_available():
            retrieved_template = _ts.retrieve_template(domain=domain, goal=goal)
    except Exception:
        retrieved_template = None

    if retrieved_template and retrieved_template.get("generated_code"):
        next_state["template_retrieved"] = True
        next_state["template_source_run_id"] = retrieved_template.get("run_id")
        next_state["template_name"] = "qdrant_match"
        record_event(
            run_id, "template_retrieved",
            source_run_id=retrieved_template.get("run_id"),
            score=retrieved_template.get("_score"),
        )
        safe_result = {
            "valid": True,
            "code": retrieved_template["generated_code"],
            "warnings": [],
            "error": None,
        }
    else:
        next_state["template_retrieved"] = False
        next_state["template_source_run_id"] = None
        attachment_for_injector: dict[str, Any] | None = None
        if next_state.get("attachment_bytes") is not None:
            import base64 as _b64
            attachment_for_injector = {
                "filename": next_state.get("attachment_filename"),
                "mimetype": next_state.get("attachment_mimetype"),
                "content_b64": _b64.b64encode(next_state["attachment_bytes"]).decode("ascii"),
            }
        safe_result = _build_safe_agent(domain, goal, run_id, sub_agent_results, attachment_for_injector)

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
    # Mark the run finished. Without this, callers (server, tests, audit) that
    # branch on status in {"completed","failed"} mis-classify successful runs
    # as still in flight (status="running" was set when the build loop began).
    next_state["status"] = "completed"
    next_state["stage"] = "completed"
    next_state["completed_at"] = datetime.now(timezone.utc).isoformat()
    record_event(
        next_state.get("run_id"), "node_exit", node="builder",
        status="completed",
        steps=len(execution_order),
        total_tokens=run_audit.get("total_tokens", 0),
        duration_s=next_state["build_duration_seconds"],
    )
    return next_state

