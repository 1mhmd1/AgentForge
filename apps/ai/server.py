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
    # When set: load the checkpoint for this run_id from Qdrant and resume
    # from the failed step instead of starting over. The frontend gets this
    # value from a previously-emitted `interrupted` event.
    resume_run_id: str | None = None
    # Optional attachment forwarded by the NestJS backend for data_transform.
    # Bytes are base64-encoded so we round-trip binary formats (xlsx) cleanly.
    attachment_filename: str | None = None
    attachment_mimetype: str | None = None
    attachment_content_b64: str | None = None


def emit(event: str, data: dict) -> str:
    return f"data: {json.dumps({'event': event, **data})}\n\n"


def _decode_attachment(filename: str | None, mimetype: str | None, content_b64: str | None) -> dict | None:
    """
    Decode a base64-encoded attachment forwarded by the backend.

    Returns a dict with `filename`, `mimetype`, `content_bytes` (bytes),
    `content_text` (utf-8 text or None for binary), and `preview` (first ~2k
    chars of text content, or a binary marker). Returns None when no
    attachment was supplied or decoding failed.
    """
    if not content_b64:
        return None
    import base64
    try:
        raw = base64.b64decode(content_b64, validate=True)
    except Exception:
        return None
    text: str | None
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        text = None  # binary (xlsx etc.) -- the agent decodes via openpyxl
    preview = (text[:2000] if text else f"[binary, {len(raw)} bytes]")
    return {
        "filename": filename or "uploaded_file",
        "mimetype": mimetype or "application/octet-stream",
        "content_bytes": raw,
        "content_text": text,
        "preview": preview,
    }


def stream_pipeline(prompt: str, domain: str | None, resume_run_id: str | None = None, attachment: dict | None = None):
    # Resume path: if the caller passed resume_run_id, try to load that
    # run's checkpoint and continue from where it stopped. Falls back to a
    # fresh run silently when Qdrant is unreachable or no checkpoint exists.
    resumed_state = None
    if resume_run_id:
        try:
            from services import checkpoint_store as _cp
            resumed_state = _cp.load_checkpoint(resume_run_id)
        except Exception as exc:
            resumed_state = None
            yield emit("log", {"level": "warn", "msg": f"checkpoint load failed: {exc}"})

    if resumed_state:
        run_id = resume_run_id  # reuse the original run_id so the checkpoint stays addressable
        yield emit("started", {
            "run_id": run_id,
            "prompt": prompt,
            "mcp_enabled": mcp_is_enabled(),
            "resumed": True,
            "resumed_from_step": resumed_state.get("failed_step"),
            "completed_steps": resumed_state.get("completed_steps") or [],
        })
        # Hydrate a fresh initial_state, then overlay every checkpointed key.
        state = initial_state(run_id=run_id, user_prompt=prompt)
        for k, v in resumed_state.items():
            if v is not None:
                state[k] = v
        state["resume_run_id"] = resume_run_id
        # If the planner already ran and a spec exists, signal the optimizer +
        # planner stages as skipped (their work is in the checkpoint).
        if state.get("spec"):
            state["status"] = "running"
    else:
        run_id = f"ui_{uuid.uuid4().hex[:8]}"
        yield emit("started", {
            "run_id": run_id,
            "prompt": prompt,
            "mcp_enabled": mcp_is_enabled(),
            "resumed": False,
        })
        state = initial_state(run_id=run_id, user_prompt=prompt)
        if domain:
            state["domain"] = domain
        if attachment:
            state["attachment_filename"] = attachment.get("filename")
            state["attachment_mimetype"] = attachment.get("mimetype")
            state["attachment_content_text"] = attachment.get("content_text")
            state["attachment_content_b64"] = None  # not used by nodes; freed
            state["attachment_preview"] = attachment.get("preview")
            # Bytes stay attached only so the safe_injector can write them to
            # disk for the generated agent. Removed before checkpointing.
            state["attachment_bytes"] = attachment.get("content_bytes")

    # ── Prompt Optimizer ───────────────────────────────────────────────
    # On resume: the optimizer already ran in the prior invocation; we have
    # its output on state. Skip the LLM call to save tokens / latency.
    if resumed_state and state.get("optimized_prompt"):
        yield emit("stage", {
            "stage": "PROMPT_OPTIMIZER",
            "status": "skipped",
            "label": "Skipped (resumed from checkpoint)",
            "optimized_prompt": state.get("optimized_prompt"),
        })
    else:
        yield emit("stage", {"stage": "PROMPT_OPTIMIZER", "status": "running", "label": "Optimizing prompt..."})
        t_opt = time.time()
        try:
            state = prompt_optimizer_node(state)
            opt_time = round(time.time() - t_opt, 2)
        except Exception as exc:
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
    # On resume: planner output (spec + execution_plan) is on the checkpoint.
    # Promote state into the `planner_output` slot the builder expects.
    if resumed_state and state.get("spec") and state.get("execution_plan"):
        planner_output = state
        planner_time = 0.0
        yield emit("stage", {
            "stage": "PLANNER",
            "status": "skipped",
            "label": "Skipped (resumed from checkpoint)",
            "spec": state.get("spec"),
            "execution_plan": state.get("execution_plan"),
        })
        yield emit("spec", {"spec": state.get("spec")})
        # Builder section header still expected by frontend.
        for stage in PIPELINE_STAGES:
            yield emit("stage", {"stage": stage, "status": "pending"})
        # Fall through to the builder invocation below.
    else:
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
            # Surface the REAL exception (kept on planner_node's `final_error_details`)
            # so the UI doesn't just show the literal string "planner_failed".
            details = planner_output.get("final_error_details") or {}
            cause = details.get("message") or planner_output.get("final_error", "planner_failed")
            yield emit("stage", {
                "stage": "PLANNER", "status": "failed",
                "error": cause,
                "details": details,
                "duration": planner_time,
            })
            yield emit("failed", {
                "final_error": cause,
                "error_stage": "PLANNER",
                "details": details,
            })
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

        # Builder section header (only on the fresh-run path; the resume path
        # emitted it already above).
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

    if builder_output.get("status") == "interrupted":
        # Sub-agent terminally failed -- but a checkpoint was saved. Tell the
        # client they can resume by re-invoking /run with resume_run_id=<this>.
        yield emit("interrupted", {
            "run_id": builder_output.get("run_id"),
            "final_error": builder_output.get("final_error"),
            "failed_step": (builder_output.get("run_audit") or {}).get("failed_step"),
            "completed_step_count": len(builder_output.get("sub_agent_results") or {}),
            "checkpoint_saved": bool(builder_output.get("checkpoint_saved")),
            "build_duration": builder_time,
            "run_audit": builder_output.get("run_audit"),
            "resume_hint": "POST /run with body.resume_run_id set to this run_id to continue from the failed step.",
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
        # Qdrant persistence outcomes (informational; never blocks success).
        "template_saved": bool(validated.get("template_saved")),
        "run_saved": bool(validated.get("run_saved")),
        "template_retrieved": bool(builder_output.get("template_retrieved")),
        "template_source_run_id": builder_output.get("template_source_run_id"),
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
    attachment = _decode_attachment(
        req.attachment_filename,
        req.attachment_mimetype,
        req.attachment_content_b64,
    )

    def generator():
        yield from stream_pipeline(req.prompt, req.domain, req.resume_run_id, attachment)
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
