from typing import Any
from llm.llm import call_llm
from prompts.planner_prompt import PLANNER_PROMPT
from services.llm_parsing import parse_with_recovery
from services.tracer import record_event


_PLANNER_REQUIRED_FIELDS = ["goal", "domain", "steps", "tools", "complexity", "agents"]


def _extract_execution_plan(spec: dict[str, Any]) -> dict[str, Any] | None:
    agents = spec.get("agents")
    if not isinstance(agents, list) or not agents:
        return None

    plan = {
        "goal": spec.get("goal", ""),
        "execution_type": "sequential",
        "estimated_total_tokens": spec.get("estimated_total_tokens", 0),
        "agents": [],
    }

    for i, agent in enumerate(agents):
        if not isinstance(agent, dict):
            continue
        plan["agents"].append({
            "id": agent.get("id", f"agent_{i + 1}"),
            "role": agent.get("role", f"step_{i + 1}"),
            "input": agent.get("input", "user_input"),
            "output": agent.get("output", "result"),
            "provider": agent.get("provider", "groq"),
            "max_tokens": agent.get("max_tokens", 300),
        })

    return plan if plan["agents"] else None


def planner_node(state: dict[str, Any]) -> dict[str, Any]:
    next_state = state.copy()

    optimized = next_state.get("optimized_prompt")
    raw_user = next_state.get("user_prompt", "")
    user_prompt = optimized if isinstance(optimized, str) and optimized.strip() else raw_user
    prompt = PLANNER_PROMPT.format(user_prompt=user_prompt)

    run_id = next_state.get("run_id")
    record_event(run_id, "node_enter", node="planner")
    try:
        raw, planner_usage = call_llm(prompt, max_tokens=500)
        spec = parse_with_recovery(raw, expected_fields=_PLANNER_REQUIRED_FIELDS)
        # Recovery may return an empty dict for garbage input; require at least
        # one core planning field to consider this a real plan.
        if not spec.get("goal") and not spec.get("steps"):
            raise ValueError("planner output missing core fields after recovery")
        next_state["planner_usage"] = planner_usage

        # Domain override: user's choice takes priority
        domain = next_state.get("domain")
        if domain is not None:
            spec["domain"] = domain
        else:
            domain = spec.get("domain")

        # Extract staged execution plan from spec
        execution_plan = _extract_execution_plan(spec)

        # If planner didn't produce agents, build a default single-agent plan
        if execution_plan is None:
            steps = spec.get("steps", [])
            execution_plan = {
                "goal": spec.get("goal", ""),
                "execution_type": "sequential",
                "estimated_total_tokens": 300 * max(len(steps), 1),
                "agents": [
                    {
                        "id": f"agent_{i + 1}",
                        "role": f"step_{i + 1}",
                        "input": "user_input" if i == 0 else f"agent_{i}.output",
                        "output": f"step_{i + 1}_result",
                        "provider": "groq",
                        "max_tokens": 300,
                    }
                    for i in range(max(len(steps), 1))
                ],
            }

        next_state["spec"] = spec
        next_state["domain"] = domain
        next_state["execution_plan"] = execution_plan
        next_state["stage"] = "planning"
        record_event(
            run_id, "node_exit", node="planner",
            status="success", domain=domain,
            steps=len(spec.get("steps", []) or []),
        )

    except Exception as exc:
        next_state["status"] = "failed"
        next_state["stage"] = "planning"
        next_state["final_error"] = "planner_failed"
        next_state["final_error_details"] = {
            "exception_type": type(exc).__name__,
            "message": str(exc),
        }
        record_event(
            run_id, "node_error", node="planner",
            exception_type=type(exc).__name__, message=str(exc)[:200],
        )

    return next_state