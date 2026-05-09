# AgentForge Backend ↔ AI Service Integration Contract

This document is the **canonical** description of how the NestJS backend
integrates with the Python AI service. The frontend already consumes the
SSE shape below — do not change event names, field casing, or order without
also updating the frontend.

---

## 1. AI service surface

The Python FastAPI service at `apps/ai/server.py` exposes:

### `POST /run` — streaming pipeline execution

- **Request body** (JSON): `{"prompt": string, "domain": string | null}`
- **Response**: `text/event-stream` (SSE), one event per `data: {…}\n\n` line
- **Lifecycle**: opens immediately, streams stage events as the pipeline
  progresses, closes after the terminal `success` or `failed` event
- **Idempotency**: none — each call generates its own server-side `run_id`
  (`ui_<8-hex>`)

The backend **must NOT** add `sessionId`, `runId`, or any other field to
the request body. Only `prompt` and `domain` are part of the AI contract.

### `POST /upload` — dev-only

The AI service exposes a multipart `/upload` endpoint that writes files to
`apps/ai/uploads/` with no per-user namespacing. **The backend must not
call this endpoint.** Multi-tenant file ownership lives in the NestJS
`Attachment` table; backend-side files are stored under
`STORAGE_ROOT/users/<userId>/<id>/<original-name>`.

### `GET /` — dev UI HTML

Used by `AiProxyService.ping()` for health checks. Not proxied to clients.

---

## 2. Pipeline (real, not the older diagram)

```
POST /run
  └─ prompt_optimizer       (LLM call ~400 tokens)
       └─ planner            (LLM call ~500 tokens, returns spec + execution_plan)
            └─ builder       (orchestrates 1..N sub-agents sequentially)
                 │  └─ sub_agent (one LLM call per step, max_tokens per agent)
                 └─ SafeCodeInjector (writes the final Python file)
                 └─ ast.parse + file write
            └─ validator     (state -> syntax -> file -> execution(subprocess+timeout) -> audit -> report)
```

**There is no separate "sandbox" stage.** The validator's `execution_checker`
runs the generated agent in a tempdir-isolated subprocess with `timeout=15s`
and clean env — that IS the sandbox.

---

## 3. Supported domains (closed set)

```
website_builder
document
web_research
data_transform
```

Anything else is rejected by the backend (`POST /api/runs` → 400) before
the AI service ever sees it.

---

## 4. SSE event contract (verbatim)

| Event | When | Key fields |
|---|---|---|
| `started` | First event | `run_id`, `prompt` |
| `stage` PROMPT_OPTIMIZER | After optimizer node | `status` (`success`/`skipped`), `optimized_prompt`, `detected_domain`, `complexity`, `detected_requirements`, `duration` |
| `stage` PLANNER | After planner | `status`, `duration`, `spec`, `execution_plan` |
| `spec` | Right after PLANNER success | `spec` (echo for convenience) |
| `stage` (×8) | One per builder phase | Phase names: `Spec Validation`, `Execution Planning`, `Template Loading`, `Template Rendering`, `Code Injection`, `Quality Validation`, `Syntax Validation`, `File Writing`. Each emits `status`: `pending`/`success`/`failed`/`skipped` |
| `stage` VALIDATOR | After validator | `status`, `validation_status` (`passed`/`failed`), `validation_score`, `errors`, `warnings`, `duration` |
| `success` | Terminal (success path) | `build_duration`, `output_path`, `code_length`, `code` (full text), `domain`, `quality_score`, `run_audit`, `validation_status`, `validation_score`, `validation_report`, `sub_agent_results`, `sub_agent_summary` |
| `failed` | Terminal (failure path) | `final_error`, `error_stage`, `details`, `build_duration?`, `run_audit?` |

### `run_audit` shape

Persisted as-is on `Run.runAudit`, plus normalized columns
(`totalTokens`, `promptTokens`, `completionTokens`).

```ts
{
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  agents_executed: string[];           // ["step_1", "step_2", ...] — NOT an int
  provider_usage: Record<string, number>;  // { "groq": 3 }
  per_agent_tokens: Record<string, {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    provider: string;
  }>;
  failed_step: string | null;
}
```

### `validation_report` shape

```ts
{
  validation_status: "passed" | "failed";
  syntax_valid: boolean;
  file_valid: boolean;
  execution_valid: boolean;
  audit_valid: boolean;
  score: number;        // 0-100
  errors: string[];     // each prefixed with "CRITICAL:" or "AUDIT:"
  warnings: string[];
}
```

---

## 5. Backend routes that wrap this contract

| Route | Method | Notes |
|---|---|---|
| `/api/runs` | POST | Validates plan + concurrency, persists `Run` STARTED, returns `{runId, streamUrl}`. Does not open the AI stream. |
| `/api/runs/:id/stream` | GET (SSE) | Lazily opens the AI service stream and pipes events through. 15s heartbeat. Synthesizes `failed: ai_service_disconnected` on upstream drop. |
| `/api/runs/:id` | GET | Snapshot of the run including spec, validation report, `runAudit`. |
| `/api/runs/:id/code` | GET | `text/plain` download of generated Python source. |
| `/api/runs/:id/cancel` | POST | Sets `RunStatus = CANCELLED`. |
| `/api/runs/:id/replay` | POST | Creates a new run with the same prompt+domain+attachments. |
| `/api/runs` | GET | Paginated history with `domain` / `status` / `from` / `to` filters. |
| `/api/runs/:id` | DELETE | Soft delete. |

All routes require auth (cookie `token` or `Authorization: Bearer <jwt>` or
`Authorization: Bearer <api-key>`).

---

## 6. Status mapping

The AI service's `stage` event names map to coarse `RunStatus` values:

| AI stage label | Coarse `RunStatus` |
|---|---|
| `PROMPT_OPTIMIZER`, `PLANNER` | `PLANNING` |
| `Spec Validation`, `Execution Planning`, `Template Loading`, `Template Rendering`, `Code Injection`, `Quality Validation`, `Syntax Validation`, `File Writing` | `BUILDING` |
| `VALIDATOR` | `VALIDATING` |
| `success` event | `COMPLETED` |
| `failed` event | `FAILED` |
| upstream disconnect mid-stream | `INTERRUPTED` |
| user-cancel | `CANCELLED` |

The original (free-form) AI label is also persisted on `Run.currentStage`
so the frontend can display the precise sub-phase.

---

## 7. Error taxonomy

The AI service emits errors as opaque strings. The backend maps known
prefixes to HTTP responses:

| AI error prefix | HTTP | `errorCode` |
|---|---|---|
| `INVALID_SPEC:*` | 400 | `BAD_SPEC` |
| `TEMPLATE_NOT_FOUND:*` | 400 | `UNSUPPORTED_DOMAIN` |
| `sub_agent_failed_*` | 502 | `LLM_FAILURE` |
| `file_write_failed` | 500 | `STORAGE_FAILURE` |
| `ai_service_disconnected` | 502 | `AI_SERVICE_DISCONNECTED` |
| anything else | 500 | `PIPELINE_FAILURE` |

See `apps/backend/src/runs/ai-error-mapper.ts` for the implementation.

---

## 8. Cost accounting

Credits are debited **after** the terminal event using the real
`run_audit.total_tokens` and the env-driven prices
(`LLM_PRICE_INPUT_PER_1K`, `LLM_PRICE_OUTPUT_PER_1K`). Failed runs are also
charged for the tokens the LLM actually consumed. Negative balances are
allowed (the LLM call already happened); `GET /api/credits/balance` returns
`overdraft: true` and `POST /api/runs` 400s with `NO_CREDITS` until a
top-up arrives.

---

## 9. Health checks

- `GET /health/live` — process is up, no dependencies probed.
- `GET /health/ready` — DB ping + AI service `GET /` + Qdrant (when
  configured). Returns 200 with `{status:"ready",checks:{…}}`, or 503 with
  `{status:"degraded",checks:{…}}`.
