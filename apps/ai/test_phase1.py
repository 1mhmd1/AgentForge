import json
import sys

sys.path.append("c:/Users/1mhmd/OneDrive/Desktop/Ai Projects/AgentForge/apps/ai/src")

from state.State import initial_state
from nodes.planner import planner_node
from nodes.builder import builder_node


def main() -> None:
    state = initial_state("run_phase1", "Build a simple website")
    state["domain"] = "website_builder"

    planned = planner_node(state)
    built = builder_node(planned)

    print("PLANNER OUTPUT:")
    print(json.dumps(planned.get("spec"), indent=2))

    print("\nEXECUTION ORDER:")
    print(json.dumps(built.get("execution_order"), indent=2))

    print("\nSUB AGENT RESULTS:")
    print(json.dumps(built.get("sub_agent_results"), indent=2))


if __name__ == "__main__":
    main()
