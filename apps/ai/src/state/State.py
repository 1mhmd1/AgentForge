from typing import TypedDict, Optional, Literal, Any
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# ===== MATCH SHARED TYPES =====

Domain = Literal[
    "web_research",
    "document",
    "data_transform",
    "website_builder"
]

Stage = Literal[
    "planning",
    "building",
    "validating",
    "completed"
]

RunStatus = Literal[
    "queued",
    "running",
    "completed",
    "failed"
]

Complexity = Literal["simple", "medium"]


# ===== AGENT SPEC =====

class AgentSpec(TypedDict):
    goal: str
    domain: Domain
    inputs: list[dict]
    outputs: list[dict]
    tools: list[str]
    steps: list[str]
    success_criteria: str
    complexity: Complexity


# ===== BUILDER STATE =====

class ExecutionStep(TypedDict):
    order: int
    text: str
    tools: list[str]


# ===== EXECUTION PLAN (STAGED) =====

class PlannedAgent(TypedDict):
    id: str
    role: str
    input: str
    output: str
    provider: str
    max_tokens: int


class ExecutionPlan(TypedDict):
    goal: str
    execution_type: str
    estimated_total_tokens: int
    agents: list[PlannedAgent]


# ===== RUN AUDIT =====

class RunAudit(TypedDict):
    total_tokens: int
    agents_executed: list[str]
    provider_usage: dict[str, int]
    failed_step: Optional[str]


# ===== MAIN STATE =====

class AgentForgeState(TypedDict):
    run_id: str
    user_prompt: str

    # 🔥 FIXED
    stage: Stage
    status: RunStatus

    spec: Optional[AgentSpec]
    domain: Optional[Domain]

    execution_plan: Optional[ExecutionPlan]
    run_audit: Optional[RunAudit]

    step_map: Optional[dict[str, ExecutionStep]]
    execution_order: Optional[list[str]]
    sub_agent_results: Optional[dict[str, Any]]

    template_path: Optional[str]
    generated_code: Optional[str]
    output_path: Optional[str]

    validation_errors: list[str]
    repair_attempts: int

    sandbox_output: Optional[str]
    sandbox_exit_code: Optional[int]

    semantic_score: Optional[float]

    final_error: Optional[str]
    final_error_details: Optional[dict[str, Any]]

    created_at: str
    completed_at: Optional[str]


# ===== INITIAL STATE =====

def initial_state(run_id: str, user_prompt: str) -> AgentForgeState:
    return AgentForgeState(
        run_id=run_id,
        user_prompt=user_prompt,

        stage="planning",        # 🔥 workflow step
        status="running",        # 🔥 overall state

        spec=None,
        domain=None,

        execution_plan=None,
        run_audit=None,

        step_map=None,
        execution_order=None,
        sub_agent_results=None,

        template_path=None,
        generated_code=None,
        output_path=None,

        validation_errors=[],
        repair_attempts=0,

        sandbox_output=None,
        sandbox_exit_code=None,

        semantic_score=None,

        final_error=None,
        final_error_details=None,

        created_at=datetime.utcnow().isoformat() + "Z",
        completed_at=None,
    )
