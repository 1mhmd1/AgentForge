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

ValidationStatus = Literal["passed", "failed"]


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


# ===== MAIN STATE =====

class AgentForgeState(TypedDict):
    run_id: str
    user_prompt: str

    # Prompt optimizer
    optimized_prompt: Optional[str]
    prompt_analysis: Optional[dict[str, Any]]

    # Workflow
    stage: Stage
    status: RunStatus

    # Planner
    spec: Optional[AgentSpec]
    domain: Optional[Domain]

    # Builder
    step_map: Optional[dict[str, ExecutionStep]]
    execution_order: Optional[list[str]]

    template_path: Optional[str]
    template_name: Optional[str]
    template_version: Optional[str]

    generated_code: Optional[str]

    generated_files: Optional[list[str]]
    file_manifest: Optional[list[dict[str, Any]]]

    output_path: Optional[str]

    sub_agent_results: Optional[dict[str, Any]]

    run_audit: Optional[dict[str, Any]]

    # Execution tracking
    current_stage: Optional[str]
    completed_stages: Optional[list[str]]
    error_stage: Optional[str]

    sandbox_workdir: Optional[str]

    sandbox_output: Optional[str]
    sandbox_exit_code: Optional[int]

    semantic_score: Optional[float]

    # Validator
    validation_status: Optional[ValidationStatus]

    validation_report: Optional[dict[str, Any]]

    validation_score: Optional[int]

    validation_errors: list[str]

    repair_payload: Optional[dict[str, Any]]

    repair_attempts: int

    # Final errors
    final_error: Optional[str]

    final_error_details: Optional[dict[str, Any]]

    # Timing
    created_at: str
    started_at: Optional[str]
    build_duration_seconds: Optional[float]
    completed_at: Optional[str]

    # Template retrieval (Qdrant)
    template_retrieved: Optional[bool]
    template_source_run_id: Optional[str]
    # Persistence outcomes -- set by validator after a successful run.
    # Surfaced in the SSE success event so UI/backend can show "saved to Qdrant".
    template_saved: Optional[bool]
    run_saved: Optional[bool]


# ===== INITIAL STATE =====

def require_state_keys(state: dict, keys: list[str], where: str) -> None:
    """
    Raise KeyError listing every missing key. Use at the top of any node that
    relies on upstream state. AgentForgeState is a TypedDict (compile-time
    only); this is the runtime check.
    """
    if not isinstance(state, dict):
        raise TypeError(f"{where}: expected state dict, got {type(state).__name__}")
    missing = [k for k in keys if k not in state]
    if missing:
        raise KeyError(f"{where}: missing required state keys: {missing}")


def initial_state(run_id: str, user_prompt: str) -> AgentForgeState:
    return AgentForgeState(
        run_id=run_id,
        user_prompt=user_prompt,

        # Prompt optimizer
        optimized_prompt=None,
        prompt_analysis=None,

        # Workflow
        stage="planning",
        status="running",

        # Planner
        spec=None,
        domain=None,

        # Builder
        step_map=None,
        execution_order=None,

        template_path=None,
        template_name=None,
        template_version=None,

        generated_code=None,

        generated_files=[],
        file_manifest=[],

        output_path=None,

        sub_agent_results=None,

        run_audit=None,

        # Execution tracking
        current_stage=None,
        completed_stages=[],
        error_stage=None,

        sandbox_workdir=None,

        sandbox_output=None,
        sandbox_exit_code=None,

        semantic_score=None,

        # Validator
        validation_status=None,

        validation_report=None,

        validation_score=None,

        validation_errors=[],

        repair_payload=None,

        repair_attempts=0,

        # Final errors
        final_error=None,

        final_error_details=None,

        # Timing
        created_at=datetime.utcnow().isoformat() + "Z",
        started_at=None,
        build_duration_seconds=None,
        completed_at=None,

        # Template retrieval / persistence
        template_retrieved=None,
        template_source_run_id=None,
        template_saved=None,
        run_saved=None,
    )