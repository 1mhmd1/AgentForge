from langgraph.graph import StateGraph, END
from nodes.planner import planner_node
from state.State import AgentForgeState

def build_graph():
    graph = StateGraph(AgentForgeState)      # ① Create a state machine
    graph.add_node("planner", planner_node)  # ② Add planner as a node
    graph.set_entry_point("planner")         # ③ Start at planner
    graph.add_edge("planner", END)           # ④ After planner, stop
    return graph.compile()                   # ⑤ Compile into runnable graph

graph = build_graph()