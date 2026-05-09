import ast
import sys

sys.path.append("c:/Users/1mhmd/OneDrive/Desktop/Ai Projects/AgentForge/apps/ai/src")

from state.State import initial_state
from nodes.planner import planner_node
from nodes.builder import builder_node
from services.template_loader import load_template
from services.template_renderer import render_template
from services.code_injector import inject_code


def main() -> None:
    state = initial_state("audit_debug", "Build a simple website")
    state["domain"] = "website_builder"

    planned = planner_node(state)
    built = builder_node(planned)

    print("status", built.get("status"))
    print("final_error", built.get("final_error"))

    sub_agent_results = built.get("sub_agent_results") or {}
    spec = planned.get("spec", {})

    tpl_path, tpl = load_template(spec.get("domain"))
    context = {
        "run_id": planned.get("run_id"),
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

    rendered = render_template(tpl, context)
    missing_markers = [
        sid
        for sid in [f"step_{i + 1}" for i in range(len(spec.get("steps", [])))]
        if f"\"\"\"BUILDER_INJECT:{sid}\"\"\"" not in rendered
    ]

    final_code = inject_code(rendered, sub_agent_results)

    checks = {
        "empty": not final_code.strip(),
        "unresolved_jinja": "{{" in final_code or "}}" in final_code,
        "unresolved_marker": "BUILDER_INJECT:step_" in final_code,
        "todo": "TODO" in final_code,
        "missing_markers": missing_markers,
    }

    print("checks", checks)

    try:
        ast.parse(final_code)
        print("syntax_ok", True)
    except Exception as exc:
        print("syntax_ok", False, exc)


if __name__ == "__main__":
    main()
