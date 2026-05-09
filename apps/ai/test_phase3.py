import json
import sys

sys.path.append("c:/Users/1mhmd/OneDrive/Desktop/Ai Projects/AgentForge/apps/ai/src")

from state.State import initial_state
from nodes.planner import planner_node
from services.template_loader import load_template
from services.template_renderer import render_template


def main() -> None:
    state = initial_state("run_phase3", "Build a simple website")
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
    rendered = ""
    try:
        rendered = render_template(template_text, context)
    except Exception as exc:
        print("\nTEMPLATE RENDER ERROR:")
        print(str(exc))

    print("PLANNER OUTPUT:")
    print(json.dumps(planned.get("spec"), indent=2))

    print("\nTEMPLATE PATH:")
    print(template_path)

    print("\nGENERATED CODE LENGTH:")
    print(len(rendered))


if __name__ == "__main__":
    main()
