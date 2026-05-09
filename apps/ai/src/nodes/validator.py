from __future__ import annotations

from services.tracer import record_event
from services.validator_engine import run_validation


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
    else:
        repair_attempts = int(next_state.get("repair_attempts") or 0)
        if repair_attempts < 3:
            next_state["status"] = "running"
        else:
            next_state["status"] = "failed"
            if result["validation_errors"]:
                next_state["final_error"] = result["validation_errors"][0]

    record_event(
        run_id, "node_exit", node="validator",
        validation_status=result["validation_status"],
        score=result.get("validation_score"),
    )
    return next_state