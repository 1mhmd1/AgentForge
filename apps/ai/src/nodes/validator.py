from __future__ import annotations

from services.tracer import record_event
from services.validator_engine import run_validation


def _persist_to_qdrant(state: dict) -> tuple[bool, bool]:
    """
    Fire-and-forget: save the validated template + the full run.
    Both calls are graceful (template_store and run_store never raise).
    Returns (template_saved, run_saved) so the SSE event can surface them.
    """
    template_saved = False
    run_saved = False
    try:
        from services import template_store, run_store
        spec = state.get("spec") if isinstance(state.get("spec"), dict) else {}
        goal = ""
        if isinstance(spec, dict):
            goal_val = spec.get("goal")
            if isinstance(goal_val, str):
                goal = goal_val.strip()
        # Score = validator's verdict (0-100). Strongest "betterness" signal
        # because it reflects an actual subprocess execution, not a static
        # check. The store uses it to decide upgrade-vs-skip on near-duplicates.
        score = int(state.get("validation_score") or 0)
        template_saved = template_store.save_template(
            run_id=state.get("run_id", "") or "",
            domain=state.get("domain", "") or "",
            goal=goal,
            spec=spec or {},
            generated_code=state.get("generated_code", "") or "",
            score=score,
        )
        run_saved = run_store.save_run(state)
    except Exception:
        # Imports or any internal failure must not block validator.
        pass
    return template_saved, run_saved


def validator_node(state: dict) -> dict:
    next_state = state.copy() if isinstance(state, dict) else {}
    next_state["stage"] = "validating"

    run_id = next_state.get("run_id") if isinstance(next_state, dict) else None
    record_event(run_id, "node_enter", node="validator")

    result = run_validation(next_state)

    next_state["validation_status"] = result["validation_status"]
    next_state["validation_report"] = result["validation_report"]
    next_state["validation_score"] = result["validation_score"]
    next_state["validation_errors"] = result["validation_errors"]
    next_state["repair_payload"] = result["repair_payload"]

    execution_result = result.get("execution_result") or {}
    if isinstance(execution_result, dict):
        if execution_result.get("stdout") is not None:
            next_state["sandbox_output"] = execution_result.get("stdout")
        if execution_result.get("exit_code") is not None:
            next_state["sandbox_exit_code"] = execution_result.get("exit_code")

    if result["validation_status"] == "passed":
        next_state["stage"] = "completed"
        next_state["status"] = "completed"
        next_state["final_error"] = None
        # Persist successful run to Qdrant. Stash booleans on state so the
        # SSE success event in server.py can surface template_saved / run_saved.
        template_saved, run_saved = _persist_to_qdrant(next_state)
        next_state["template_saved"] = template_saved
        next_state["run_saved"] = run_saved
    else:
        repair_attempts = int(next_state.get("repair_attempts") or 0)
        if repair_attempts < 3:
            next_state["status"] = "running"
        else:
            next_state["status"] = "failed"
            if result["validation_errors"]:
                next_state["final_error"] = result["validation_errors"][0]
        next_state["template_saved"] = False
        next_state["run_saved"] = False

    record_event(
        run_id, "node_exit", node="validator",
        validation_status=result["validation_status"],
        score=result.get("validation_score"),
    )
    return next_state