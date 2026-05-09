import json
import sys

sys.path.append("c:/Users/1mhmd/OneDrive/Desktop/Ai Projects/AgentForge/apps/ai/src")

from state.State import initial_state
from nodes.planner import planner_node
from services.template_loader import load_template
from services.template_renderer import render_template
from services.code_injector import inject_code


def main() -> None:
    state = initial_state("run_phase4", "Build a simple website")
    state["domain"] = "website_builder"

    planned = planner_node(state)
    spec = planned.get("spec", {})
    template_path, template_text = load_template(spec.get("domain", ""))

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
    }

    rendered = render_template(template_text, context)
    sub_agent_results = {
        "step_1": {
            "step_id": "step_1",
            "generated_code": "print('step 1 injected')",
        }
    }
    final_code = inject_code(rendered, sub_agent_results)

    print("PLANNER OUTPUT:")
    print(json.dumps(planned.get("spec"), indent=2))

    print("\nTEMPLATE PATH:")
    print(template_path)

    code = final_code
    marker = "\"\"\"BUILDER_INJECT:step_1\"\"\""
    injected = marker not in code and len(code) > 0

    print("\nINJECTION CHECK:")
    print("step_1 marker replaced:", injected)


if __name__ == "__main__":
    main()
