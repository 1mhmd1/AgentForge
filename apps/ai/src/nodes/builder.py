from typing import Any


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


def builder_node(state: dict[str, Any]) -> dict[str, Any]:
    next_state = state.copy()

    # Phase 1: input handling
    spec = next_state.get("spec")
    if not isinstance(spec, dict):
        next_state["status"] = "failed"
        next_state["final_error"] = "builder_invalid_spec"
        return next_state

    raw_steps = spec.get("steps")
    if not isinstance(raw_steps, list):
        next_state["status"] = "failed"
        next_state["final_error"] = "builder_invalid_spec"
        return next_state

    spec = dict(spec)
    goal = str(spec.get("goal", "")).strip()
    steps = _normalize_list(raw_steps)
    tools = _normalize_list(spec.get("tools"))

    if not goal or len(steps) < 2:
        next_state["status"] = "failed"
        next_state["final_error"] = "builder_invalid_spec"
        return next_state

    spec["goal"] = goal
    spec["steps"] = steps
    spec["tools"] = tools
    next_state["spec"] = spec
    next_state["domain"] = spec.get("domain")

    # Phase 2: execution planning
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

    return next_state
