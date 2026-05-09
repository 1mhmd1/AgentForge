from langgraph.graph import StateGraph, END
from nodes.prompt_optimizer import prompt_optimizer_node
from nodes.planner import planner_node
from nodes.builder import builder_node
from state.State import AgentForgeState

def build_graph():
    graph = StateGraph(AgentForgeState)
    graph.add_node("prompt_optimizer", prompt_optimizer_node)
    graph.add_node("planner", planner_node)
    graph.add_node("builder", builder_node)
    graph.set_entry_point("prompt_optimizer")
    graph.add_edge("prompt_optimizer", "planner")
    graph.add_edge("planner", "builder")
    graph.add_edge("builder", END)
    return graph.compile()

graph = build_graph()
