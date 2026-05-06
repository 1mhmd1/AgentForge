from langgraph.graph import StateGraph, END
from nodes.planner import planner_node
from nodes.builder import builder_node
from state.State import AgentForgeState

def build_graph():
    graph = StateGraph(AgentForgeState)       # ① Create a state machine
    graph.add_node("planner", planner_node)  # ② Add planner as a node
    graph.add_node("builder", builder_node)  # ③ Add builder as a node
    graph.set_entry_point("planner")         # ④ Start at planner
    graph.add_edge("planner", "builder")    # ⑤ Move to builder
    graph.add_edge("builder", END)           # ⑥ After builder, stop
    return graph.compile()                   # ⑦ Compile into runnable graph

graph = build_graph()