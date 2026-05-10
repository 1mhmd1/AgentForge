"""
AgentForge Pipeline Test UI -- FastAPI server
Runs prompt_optimizer -> planner -> builder -> validator and streams stage-by-stage results.
"""
import sys
import os
import json
import time
import logging
import uuid

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

from fastapi import FastAPI, UploadFile, File
from fastapi.responses import StreamingResponse, HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from state.State import initial_state
from nodes.prompt_optimizer import prompt_optimizer_node
from nodes.planner import planner_node
from nodes.builder import (
    builder_node,
    STAGE_VALIDATION,
    STAGE_EXECUTION_PLANNING,
    STAGE_TEMPLATE_LOADING,
    STAGE_TEMPLATE_RENDERING,
    STAGE_CODE_INJECTION,
    STAGE_QUALITY_VALIDATION,
    STAGE_SYNTAX_VALIDATION,
    STAGE_FILE_WRITING,
)
from nodes.validator import validator_node
from services.mcp_tools import is_enabled as mcp_is_enabled

logging.basicConfig(level=logging.WARNING)

app = FastAPI(title="AgentForge Pipeline UI")

# CORS: comma-separated allowlist via AI_CORS_ORIGINS env var.
# Unset = "*" with a stderr warning (dev convenience, NOT production-safe).
_cors_env = os.getenv("AI_CORS_ORIGINS", "").strip()
if _cors_env:
    _cors_origins = [o.strip() for o in _cors_env.split(",") if o.strip()]
else:
    _cors_origins = ["*"]
    print("WARNING: AI_CORS_ORIGINS not set; allowing all origins. Do not use in production.", file=sys.stderr)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

PIPELINE_STAGES = [
    STAGE_VALIDATION,
    STAGE_EXECUTION_PLANNING,
    STAGE_TEMPLATE_LOADING,
    STAGE_TEMPLATE_RENDERING,
    STAGE_CODE_INJECTION,
    STAGE_QUALITY_VALIDATION,
    STAGE_SYNTAX_VALIDATION,
    STAGE_FILE_WRITING,
]


class RunRequest(BaseModel):
    prompt: str
    domain: str | None = None


def emit(event: str, data: dict) -> str:
    return f"data: {json.dumps({'event': event, **data})}\n\n"


def stream_pipeline(prompt: str, domain: str | None):
    run_id = f"ui_{uuid.uuid4().hex[:8]}"

    yield emit("started", {"run_id": run_id, "prompt": prompt, "mcp_enabled": mcp_is_enabled()})

    state = initial_state(run_id=run_id, user_prompt=prompt)
    if domain:
        state["domain"] = domain

    # ── Prompt Optimizer ───────────────────────────────────────────────
    yield emit("stage", {"stage": "PROMPT_OPTIMIZER", "status": "running", "label": "Optimizing prompt..."})
    t_opt = time.time()
    try:
        state = prompt_optimizer_node(state)
        opt_time = round(time.time() - t_opt, 2)
    except Exception as exc:
        # Optimizer failures are non-fatal -- fall back to raw prompt.
        opt_time = round(time.time() - t_opt, 2)
        yield emit("stage", {
            "stage": "PROMPT_OPTIMIZER", "status": "skipped",
            "error": str(exc), "duration": opt_time,
        })
    else:
        analysis = state.get("prompt_analysis") or {}
        yield emit("stage", {
            "stage": "PROMPT_OPTIMIZER",
            "status": "success",
            "duration": opt_time,
            "optimized_prompt": state.get("optimized_prompt"),
            "detected_domain": analysis.get("detected_domain"),
            "complexity": analysis.get("complexity"),
            "detected_requirements": analysis.get("detected_requirements", []),
        })

    # ── Planner ────────────────────────────────────────────────────────
    yield emit("stage", {"stage": "PLANNER", "status": "running", "label": "Planning with AI..."})

    t0 = time.time()
    try:
        planner_output = planner_node(state)
        planner_time = round(time.time() - t0, 2)
    except Exception as exc:
        yield emit("stage", {"stage": "PLANNER", "status": "failed", "error": str(exc)})
        yield emit("failed", {"final_error": str(exc), "error_stage": "PLANNER"})
        return

    if planner_output.get("status") == "failed":
        yield emit("stage", {
            "stage": "PLANNER", "status": "failed",
            "error": planner_output.get("final_error", "planner_failed"),
            "duration": planner_time,
        })
        yield emit("failed", {"final_error": planner_output.get("final_error"), "error_stage": "PLANNER"})
        return

    spec = planner_output.get("spec")
    if not spec:
        yield emit("stage", {"stage": "PLANNER", "status": "failed", "error": "no_spec_produced"})
        yield emit("failed", {"final_error": "no_spec_produced", "error_stage": "PLANNER"})
        return

    execution_plan = planner_output.get("execution_plan")

    yield emit("stage", {
        "stage": "PLANNER",
        "status": "success",
        "duration": planner_time,
        "spec": {
            "goal": spec.get("goal"),
            "domain": spec.get("domain"),
            "steps": spec.get("steps", []),
            "tools": spec.get("tools", []),
            "complexity": spec.get("complexity"),
            "success_criteria": spec.get("success_criteria"),
        },
        "execution_plan": execution_plan,
    })

    yield emit("spec", {"spec": {
        "goal": spec.get("goal"),
        "domain": spec.get("domain"),
        "steps": spec.get("steps", []),
        "tools": spec.get("tools", []),
        "complexity": spec.get("complexity"),
        "success_criteria": spec.get("success_criteria"),
    }})

    # ── Builder ────────────────────────────────────────────────────────
    for stage in PIPELINE_STAGES:
        yield emit("stage", {"stage": stage, "status": "pending"})

    t1 = time.time()
    builder_output = builder_node(planner_output)
    builder_time = round(time.time() - t1, 2)

    completed = builder_output.get("completed_stages", [])
    failed_stage = builder_output.get("error_stage")

    for stage in PIPELINE_STAGES:
        if stage in completed:
            yield emit("stage", {"stage": stage, "status": "success"})
        elif stage == failed_stage:
            yield emit("stage", {
                "stage": stage,
                "status": "failed",
                "error": builder_output.get("final_error"),
                "details": builder_output.get("final_error_details"),
            })
        else:
            yield emit("stage", {"stage": stage, "status": "skipped"})

    if builder_output.get("status") == "failed":
        yield emit("failed", {
            "final_error": builder_output.get("final_error"),
            "error_stage": builder_output.get("error_stage"),
            "details": builder_output.get("final_error_details"),
            "build_duration": builder_time,
            "run_audit": builder_output.get("run_audit"),
        })
        return

    code = builder_output.get("generated_code", "")
    output_path = builder_output.get("output_path", "")
    sub_results = builder_output.get("sub_agent_results", {})

    # ── Validator ──────────────────────────────────────────────────────
    yield emit("stage", {"stage": "VALIDATOR", "status": "running", "label": "Validating generated agent..."})
    t_val = time.time()
    try:
        validated = validator_node(builder_output)
        val_time = round(time.time() - t_val, 2)
    except Exception as exc:
        val_time = round(time.time() - t_val, 2)
        yield emit("stage", {
            "stage": "VALIDATOR", "status": "skipped",
            "error": str(exc), "duration": val_time,
        })
        validated = builder_output  # treat as if validator never ran
    else:
        v_status = validated.get("validation_status")
        v_report = validated.get("validation_report") or {}
        yield emit("stage", {
            "stage": "VALIDATOR",
            "status": "success" if v_status == "passed" else "failed",
            "duration": val_time,
            "validation_status": v_status,
            "validation_score": validated.get("validation_score"),
            "errors": v_report.get("errors", []),
            "warnings": v_report.get("warnings", []),
        })

    yield emit("success", {
        "build_duration": builder_output.get("build_duration_seconds"),
        "output_path": output_path,
        "code_length": len(code),
        "code": code,
        "domain": builder_output.get("domain", ""),
        "quality_score": builder_output.get("quality_score"),
        "run_audit": builder_output.get("run_audit"),
        "validation_status": validated.get("validation_status"),
        "validation_score": validated.get("validation_score"),
        "validation_report": validated.get("validation_report"),
        "sub_agent_results": {
            sid: {
                "step_id": sid,
                "status": sr.get("status"),
                "summary": sr.get("summary", ""),
                "generated_code": sr.get("generated_code", ""),
            }
            for sid, sr in sub_results.items()
        },
        "sub_agent_summary": [
            {
                "step_id": sid,
                "status": sr.get("status"),
                "summary": sr.get("summary", ""),
                "code_length": len(sr.get("generated_code", "")),
            }
            for sid, sr in sub_results.items()
        ],
    })


@app.post("/run")
async def run_pipeline(req: RunRequest):
    def generator():
        yield from stream_pipeline(req.prompt, req.domain)
    return StreamingResponse(generator(), media_type="text/event-stream")


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload a file and return its text content for pipeline processing."""
    UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    content = await file.read()
    filename = file.filename or "uploaded_file"
    filepath = os.path.join(UPLOAD_DIR, filename)

    with open(filepath, "wb") as f:
        f.write(content)

    # Try to read as text
    text_content = ""
    try:
        text_content = content.decode("utf-8")
    except UnicodeDecodeError:
        try:
            text_content = content.decode("latin-1")
        except Exception:
            text_content = f"[Binary file: {filename}, {len(content)} bytes]"

    return JSONResponse({
        "filename": filename,
        "size": len(content),
        "content": text_content[:10000],  # Limit to 10k chars
        "path": filepath,
    })


@app.get("/", response_class=HTMLResponse)
async def serve_ui():
    with open(os.path.join(os.path.dirname(__file__), "ui.html"), encoding="utf-8") as f:
        return f.read()



if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("AI_PORT", "4000"))
    print(f"\nAgentForge Pipeline UI → http://localhost:{port}\n")
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="warning")
