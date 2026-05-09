import json
from typing import Any
from llm.llm import call_llm
from prompts.planner_prompt import PLANNER_PROMPT


def _clean_json(text: str) -> str:
    """Remove markdown fences like ```json or ``` from AI response"""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3].strip()
    return cleaned


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

    user_prompt = next_state.get("user_prompt", "")
    prompt = PLANNER_PROMPT.format(user_prompt=user_prompt)

    try:
        raw = call_llm(prompt, max_tokens=500)
        cleaned = _clean_json(raw)
        spec = json.loads(cleaned)

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

    except Exception:
        next_state["status"] = "failed"

    return next_state