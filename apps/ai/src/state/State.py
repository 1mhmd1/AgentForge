from typing import TypedDict, Optional, Literal
from dotenv import load_dotenv

load_dotenv()

# The 4 supported domains — only these values are allowed
Domain = Literal[
    "web_research",
    "document",
    "data_transform",
    "website_builder"
]

# The structured spec the planner produces
class AgentSpec(TypedDict):
    goal:             str           # what the agent should do
    domain:           Domain        # which domain it belongs to
    inputs:           list[dict]    # what the agent takes in
    outputs:          list[dict]    # what the agent produces
    tools:            list[str]     # e.g. ["requests", "beautifulsoup4"]
    steps:            list[str]     # ordered steps to accomplish the goal
    success_criteria: str           # how we know the agent worked
    complexity:       Literal["simple", "medium"]

# The main state — travels through every node in the pipeline
class AgentForgeState(TypedDict):
    run_id:            str                  # unique ID for this run
    user_prompt:       str                  # the original user request
    spec:              Optional[AgentSpec]  # filled by planner node
    domain:            Optional[Domain]     # filled by domain router
    template_path:     Optional[str]        # filled by domain router
    generated_code:    Optional[str]        # filled by builder node
    output_path:       Optional[str]        # path to the generated file
    validation_errors: list[str]            # errors from any validator
    repair_attempts:   int                  # starts at 0, max 2
    sandbox_output:    Optional[str]        # stdout from running the agent
    sandbox_exit_code: Optional[int]        # 0 = success, anything else = fail
    semantic_score:    Optional[float]      # 0.0 to 1.0 — how good is the output
    status:            str                  # planning / building / validating / done / failed
    final_error:       Optional[str]        # set if the whole pipeline fails


def initial_state(run_id: str, user_prompt: str) -> AgentForgeState:
    """Creates a fresh state at the start of every run."""
    return AgentForgeState(
        run_id=run_id,
        user_prompt=user_prompt,
        spec=None,
        domain=None,
        template_path=None,
        generated_code=None,
        output_path=None,
        validation_errors=[],
        repair_attempts=0,
        sandbox_output=None,
        sandbox_exit_code=None,
        semantic_score=None,
        status="planning",
        final_error=None,
    )