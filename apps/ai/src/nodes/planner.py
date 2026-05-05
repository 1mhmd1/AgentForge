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

def planner_node(state: dict[str, Any]) -> dict[str, Any]:
    next_state = state.copy()  # ① Make a copy (don't modify original)
    
    user_prompt = next_state.get("user_prompt", "")  # ② Get user's request
    prompt = PLANNER_PROMPT.format(user_prompt=user_prompt)  # ③ Fill in template
    
    try:
        raw = call_llm(prompt)         # ④ Ask OpenAI for plan
        cleaned = _clean_json(raw)     # ⑤ Remove markdown fences
        spec = json.loads(cleaned)     # ⑥ Convert JSON string → Python dict
        
        # ⑦ Domain override: user's choice takes priority
        domain = next_state.get("domain")
        if domain is not None:
            spec["domain"] = domain
        else:
            domain = spec.get("domain")
        
        # ⑧ Update state with the plan
        next_state["spec"] = spec
        next_state["domain"] = domain
        next_state["stage"] = "planning"
        
    except Exception:
        # ⑨ If anything fails, mark as failed
        next_state["status"] = "failed"
    
    return next_state  # ⑩ Return updated state