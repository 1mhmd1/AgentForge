# AgentForge -- Full Project Hand-Off Document

This file is the single hand-off document for AgentForge. Give it to any new AI/dev so they fully understand the project, the user, decisions made, conventions to follow, corrections already burned-in, and what NOT to do.

Last updated: 2026-05-12 (post end-to-end UI integration: SSE event-type fix, LLM fallback context cap, admin credits UI, admin cancel-all-active, dynamic sub-agent display, HTML fragment rendering for web_research/document). Owner: Mhmd Salim (rabih@chipatech.com).

---

## 0. Quick-start: if you read nothing else

1. **Project**: AgentForge takes a user prompt -> AI plans + builds + validates a runnable Python agent -> returns it and persists successful runs to Qdrant Cloud for template reuse. Monorepo with `apps/ai` (Python, live), `apps/backend` (NestJS, **LIVE since 2026-05-11/12** -- streams SSE, owns auth/credits/admin/persistence), `apps/frontend` (Vite React, **LIVE, wired to real backend since 2026-05-11/12**).
2. **Pipeline**: `prompt_optimizer -> planner -> builder -> validator`. Sub-agents inside builder run SEQUENTIALLY (plain for-loop, no parallel, no async).
3. **Validator** runs 7 stages: state -> syntax -> file -> execution -> audit -> triviality -> browser (website only) -> report. Only on `validation_status == "passed"` does `_persist_to_qdrant` fire.
4. **Persistence**: Qdrant Cloud (eu-central-1). `templates_<domain>` per-domain collections (cosine, 384-dim, all-MiniLM-L6-v2) + single `runs` collection. Dedup threshold 0.75, upgrade margin 5 quality points.
5. **Code-gen approach**: SafeCodeInjector + `json.dumps`. NO Jinja2, NO f-strings, NO marker replacement.
6. **MCP doc tools**: 3 connectors wired (Microsoft Learn + Context7 + Exa). Off by default behind `AGENTFORGE_MCP_DOCS=1`. Step_1 only. Single file: `apps/ai/src/services/mcp_tools.py`.
7. **LLM providers**: `LLM_PROVIDER=gemini` is PRIMARY (gemini-3-flash-preview, thinking_budget=0 mandatory), `LLM_FALLBACK_PROVIDER=groq` is fallback. The legacy groq-primary default is gone.
8. **Critical paths at REPO ROOT (not apps/ai/)**: `venv\Scripts\python.exe`, `.env`. The server loads `.env` via `..\\..\\.env` relative to server.py.
9. **User style**: terse, action-biased. When user says "continue" or "ok go" or "do all of them", EXECUTE -- do not ask another question. Surgical patches only. No fabricated metrics. No new abstractions.
10. **Hard rules**: Python source must be ASCII only (no em-dashes, no smart quotes). Never put `"""` inside a `"""` docstring. Always unpack `text, usage = call_llm(...)`. Probe external endpoints before coding against them. Never recreate patterns the user just deleted (especially tests). After any `pip install`, the uvicorn process MUST be killed and re-launched -- module-level `_init_failed=True` caches survive code reloads.
11. **Don't commit unless explicitly asked.** User owns commit decisions.

---

## 1. Repo layout (verified 2026-05-11)

```
AgentForge/
  venv/                              # PYTHON VENV AT REPO ROOT (not apps/ai/venv)
    Scripts/python.exe               # use this binary for every Python invocation
  .env                               # AT REPO ROOT. gitignored. LLM keys + QDRANT_* + AGENTFORGE_MCP_DOCS + EXA_API_KEY
  .env.example                       # tracked. Placeholders only. NEVER commit real keys here.
  Requirements.txt                   # UTF-8 no-BOM. 96 packages including mcp==1.27.1, qdrant-client, sentence-transformers, torch, transformers, google-genai
  MEMORY.md                          # this file (root hand-off)
  apps/
    ai/                              # Python AI service (FastAPI + LangGraph). LIVE.
      server.py                      # FastAPI + SSE entrypoint. Loads .env via ..\..\.env. Emits mcp_enabled in started event.
      src/
        graph/graph.py               # LangGraph StateGraph wiring
        state/State.py               # AgentForgeState TypedDict + require_state_keys()
        nodes/
          prompt_optimizer.py
          planner.py
          builder.py                 # sequential sub-agents, last-only merge for text domains, MCP fetch before loop
          sub_agent.py               # one LLM call per step. Accepts docs_context kwarg.
          validator.py               # 7-stage pipeline. Calls _persist_to_qdrant ONLY on passed.
        services/
          safe_injector.py           # 4 hardcoded domain skeletons
          code_serializer.py         # json.dumps wrappers
          code_sanitizer.py
          file_writer.py
          errors.py                  # SUPPORTED_DOMAINS + ERROR_CODES
          snippet_validator.py       # score_quality()
          llm_parsing.py             # parse_with_recovery()
          observability.py           # log_event()
          tracer.py                  # JSONL traces
          mcp_tools.py               # MCP connectors (MS Learn + Context7 + Exa)
          template_store.py          # NEW 2026-05-10/11. Qdrant per-domain templates collection.
          run_store.py               # NEW 2026-05-10/11. Qdrant single runs collection. Idempotent via md5(run_id).
          validator_engine.py        # state -> syntax -> file -> execution -> audit -> triviality -> browser -> report
          syntax_checker.py
          execution_checker.py       # subprocess sandbox, clean env, 15s timeout
          audit_checker.py           # accepts agents_executed as list OR int
          file_checker.py
          browser_checker.py         # website_builder domain only
          validation_report.py       # 0-100 score
        prompts/
          prompt_optimizer_prompt.py
          planner_prompt.py
          sub_agent_prompt.py        # 1-shot example. REWRITE-THE-WHOLE contract. NO Lorem ipsum.
        llm/
          llm.py                     # transient-error retry+backoff, returns (text, usage)
          providers/
            groq_provider.py
            gemini_provider.py       # uses google-genai SDK (NOT legacy google-generativeai). thinking_budget=0 mandatory.
            minimax_provider.py
            kimi_provider.py
        generated_agents/            # output dir (run_*.py, gitignored). file_writer auto-creates.
      DIAGNOSTIC_REPORT.md
      OPTIMIZATION_REPORT.md
      VALIDATOR_PRODUCTION_AUDIT_REPORT.md
      AGENTFORGE_COMPLETE_SYSTEM_AUDIT.md
      traces/                        # AGENTFORGE_TRACE=1 writes here
      uploads/.gitkeep
    backend/                         # NestJS (in dev by friend)
    frontend/                        # React 18 + Vite + TS, inline-style design system
  packages/
    shared/                          # SOURCE OF TRUTH for cross-language types
  node_modules/.bin/tsc.cmd          # at monorepo root (NOT in apps/frontend)
```

**Notable removals across sessions**: All test files deleted at user's explicit request (2026-05-10): `apps/ai/test_*.py` + `apps/ai/src/tests/` directory entirely. DO NOT recreate these or any test files under different names without confirming.

---

## 2. AI service architecture (the active layer)

### Pipeline (verified end-to-end 2026-05-11)

```
START -> prompt_optimizer -> planner -> builder -> validator -> END
                                          |              |
                                          |              +-- if passed: _persist_to_qdrant
                                          |                          |
                                          |                          +-- template_store.save_template
                                          |                          +-- run_store.save_run
                                          |
                                          +-- MCP doc fetch (one-shot, before sub-agent loop)
                                          +-- sub_agents step_1 receives docs_context
```

Both `graph.py` AND `server.py:stream_pipeline` wire all four nodes. Server.py used to BYPASS the graph (called planner_node + builder_node manually), which made prompt_optimizer + validator unreachable. Fixed AUDIT-3.

### Node responsibilities

- **prompt_optimizer** (`nodes/prompt_optimizer.py`) -- LLM rewrites raw user prompt into structured `optimized_prompt` + `prompt_analysis`. Failures non-fatal. Auto-sets `domain` from optimizer's detected_domain only if not already set.
- **planner** (`nodes/planner.py`) -- LLM produces `spec` + `execution_plan`. Uses `services/llm_parsing.parse_with_recovery()` for robust 3-tier JSON extraction. Required fields: `goal, domain, steps, tools, complexity, agents`. Raises if `goal` AND `steps` both missing after recovery. `max_tokens=4096` (verbose gemini JSON for 5-agent plans hits 1100-2500 tokens; 1024 was too tight).
- **builder** (`nodes/builder.py`) -- Validates spec, fetches MCP docs once if enabled, runs sub-agents in plain `for` loop (NOT parallel), calls SafeCodeInjector, writes `.py` file. Sets `status="completed"` on success. STOP-on-failure (no retries inside builder). `_init_run_audit` initializes `{"total_tokens": 0, "agents_executed": [], "provider_usage": {}}` -- THESE are the required field names.
- **sub_agent** (`nodes/sub_agent.py`) -- One LLM call per step. Accepts `docs_context: str = ""` kwarg. REWRITE-THE-WHOLE contract: each step emits the COMPLETE artifact built so far plus its own addition. NO Lorem ipsum / TODO. Compresses previous output to last step's summary + truncated code (cap 800 chars). 2 retries + 1 raw-output fallback.
- **validator** (`nodes/validator.py`) -- Calls `services/validator_engine.run_validation` over 7 stages. On `validation_status == "passed"`, calls `_persist_to_qdrant` (line 70). Else branch (line 73) hard-codes `template_saved=False`, `run_saved=False`.

### Validator pipeline (7 stages, 2026-05-11 order)

```
1. state         -- require_state_keys(generated_code, output_path, run_audit, status)
2. syntax        -- ast.parse + check_unresolved_markers + check_triviality
3. file          -- exists + readable + non-empty + extension allowed
4. execution     -- subprocess sandbox (tempdir, clean env, 15s timeout)
5. audit         -- run_audit shape: {total_tokens: int, agents_executed: list|int, provider_usage: dict}
6. triviality    -- placeholder/stub detection in generated content
7. browser       -- website_builder only: headless playwright smoke check
   report        -- aggregate score, return validation report
```

If ANY stage fails -> `validation_status = "failed"` -> persistence is skipped entirely. Browse failures, audit failures, syntax failures, execution failures -> NO save to Qdrant.

### Output

- File at `apps/ai/src/generated_agents/run_{run_id}.py`
- `file_writer.py` uses `output_dir.mkdir(parents=True, exist_ok=True)` so the dir auto-recreates if deleted.
- `run_id` format: `ui_<8hex>` (e.g. `ui_4e33546b`).

### Output merge strategy

In `_build_safe_agent()` in builder.py:
- `website_builder`, `document`, `web_research`: **LAST sub-agent output only** (chained pipeline; concat duplicates content)
- `data_transform`: **ALL steps concatenated** (additive pipeline)

### Key architectural facts (verified, do not "improve" without asking)

- **Sequential sub-agents**: plain `for` loop in `builder.py`. NOT parallel. NO async. NO threading.
- **`asyncio.run()` is allowed inside individual sync functions** (the no-async rule is about pipeline architecture, not banning event loops in helpers). MCP code and template embedding both use isolated `asyncio.run()` per call where applicable.
- **SafeCodeInjector** (`services/safe_injector.py`) replaced the old Jinja2 templates. AGENT_TEMPLATE is a hardcoded Python string constant. Per-domain skeletons in `build_website_agent`, `build_research_agent`, `build_document_agent`, `build_data_agent`.
- **All content serialized via `json.dumps`** (`services/code_serializer.py`) -- no marker replacement. Eliminates triple-quote-collision bugs by construction.
- **call_llm signature**: `tuple[str, dict[str, Any]]`. Usage dict: `{prompt_tokens, completion_tokens, total_tokens, provider}`. ALWAYS unpack both: `text, usage = call_llm(...)`.
- **State**: `AgentForgeState` TypedDict in `state/State.py`. Compile-time only -- runtime checks via `require_state_keys(state, keys, where)` helper.

---

## 3. Service modules (apps/ai/src/services/)

| Module | Purpose |
|---|---|
| `safe_injector.py` | Builds the final Python agent file. 4 hardcoded domain skeletons. |
| `code_serializer.py` | json.dumps wrappers for HTML/CSS/text/JSON content. |
| `code_sanitizer.py` | Pre-syntax checks: triple-quote balance, indentation, raw HTML/CSS leaks. |
| `file_writer.py` | Writes `run_{id}.py` to `generated_agents/`. |
| `errors.py` | `SUPPORTED_DOMAINS` set + `ERROR_CODES` dict. |
| `snippet_validator.py` | `score_quality()` -- placeholder detection, missing imports, semantic completeness. |
| `llm_parsing.py` | `parse_with_recovery()` -- strip_invisible -> clean_response -> extract_json -> extract_fields_fallback. Used by planner. |
| `observability.py` | `log_event(event, **fields)` -- JSON-to-stderr. `AGENTFORGE_PLAIN_LOGS=1` for human format. |
| `tracer.py` | Per-run JSONL traces. Off by default. `AGENTFORGE_TRACE=1`. |
| `mcp_tools.py` | MCP connectors: MS Learn + Context7 + Exa. `is_enabled()`, `fetch_docs_context(domain, goal, max_chars=1500)`. Off by default behind `AGENTFORGE_MCP_DOCS=1`. |
| `template_store.py` | **NEW.** Qdrant per-domain template collection. `save_template(run_id, domain, goal, spec, generated_code, score)`. Embeds `goal` via all-MiniLM-L6-v2 (384-dim cosine). Dedup threshold 0.75. Upgrade margin 5 quality points. |
| `run_store.py` | **NEW.** Qdrant single `runs` collection. `save_run(state_dict)`. Deterministic point_id via `int(md5(run_id).hexdigest(), 16) % 10**12` -> idempotent re-saves. KEYWORD payload index on `run_id` (templates collections do NOT have this). |
| `validator_engine.py` | Orchestrates validator pipeline. Uses log_event for stage logs. |
| `syntax_checker.py` | `ast.parse` + `check_unresolved_markers` + `check_triviality`. |
| `execution_checker.py` | Subprocess in tempdir with timeout=15s + `_build_clean_env()` strips PYTHONPATH. Use `TemporaryDirectory()` context, never `mkdtemp` without cleanup. |
| `audit_checker.py` | Validates `run_audit` shape. Accepts `agents_executed` as INT or LIST. |
| `file_checker.py` | exists + readable + non-empty + extension allowed. |
| `browser_checker.py` | website_builder only: launches headless playwright to assert HTML loads without console errors. |
| `validation_report.py` | Aggregates checker results. Score = 100 - (50 syntax + 30 exec + 10 file + 10 audit). Adds `TRIVIAL_OUTPUT` warning when triviality detected. |

### Qdrant persistence layer (verified 2026-05-11)

- **Both modules are sync-only and graceful.** Every failure path is `try/except` that logs via `services.observability.log_event` and returns False. Pipeline never blocks on Qdrant.
- **Init lifecycle**: `_get_client()` and `_get_model()` cache `_init_failed=True` on first failure for the entire process lifetime. After ANY `pip install` (adding qdrant-client or sentence-transformers), the running uvicorn MUST be killed and re-launched. Module-load failures cached pre-install survive code reloads.
- **Embedding model**: `all-MiniLM-L6-v2` (384-dim cosine). Loaded once per process. ~80MB.
- **When persistence fires**: ONLY from `nodes/validator.py:_persist_to_qdrant` on validation-pass branch. `validation_status != "passed"` -> both `template_saved` and `run_saved` are hard-coded False.
- **Dedup + upgrade contract (template_store only)**: for each new template, search per-domain collection for top cosine match against new `goal`:
  - score < 0.75 -> no near-match, insert
  - score >= 0.75 AND new_quality < old_quality + 5 -> skip with `template_store_save_skipped_duplicate`
  - score >= 0.75 AND new_quality >= old_quality + 5 -> upgrade: delete old, insert new, log `template_store_save_upgrade`
- **`run_store` has no dedup** -- every successful run upserts. Idempotent because point_id is deterministic.
- **Payload index gotcha (do NOT filter-delete on templates)**: `run_store._ensure_runs_collection` creates a KEYWORD payload index on `run_id` for the `runs` collection. `template_store._ensure_collection` does NOT. So:
  - OK: filter-delete on `runs` by `run_id`
  - FAIL with 400 ("Index required but not found for run_id"): same filter-delete on `templates_<domain>`
  - ALWAYS-OK: delete by point id via `PointIdsList`. Scroll first to collect IDs, then delete by ID.
- **Collection list (as of 2026-05-11)**: `runs`, `templates_website_builder`, `templates_document`. `templates_web_research` and `templates_data_transform` will appear on first save in those domains. Domain string is sanitized to `[a-zA-Z0-9_]` only.

---

## 4. LLM providers

Configured via `LLM_PROVIDER` env. **PRIMARY changed 2026-05-11**: default is now `gemini`, not `groq`. All providers return `(text, usage)`:

| Provider | Model | Notes |
|---|---|---|
| gemini | `gemini-3-flash-preview` | **PRIMARY 2026-05-11**. `thinking_budget=0` mandatory (any other value fails). Uses `google-genai` SDK, NOT legacy `google-generativeai`. Produces detailed sections; preferred for sub-agents. |
| groq | `llama-3.1-8b-instant` | **Fallback** via `LLM_FALLBACK_PROVIDER=groq`. temperature=0. Produces shorter / more boilerplate output. |
| minimax | (REST) | Secondary fallback. |
| kimi | (REST) | Secondary fallback. |

`call_llm()` retries transient HTTP errors (429, 5xx, timeout, conn-reset) with exponential backoff. Configurable via `LLM_MAX_RETRIES` (default 3) and `LLM_RETRY_BASE_DELAY` (default 1.0s). Retry detection is provider-agnostic string matching against `_TRANSIENT_MARKERS`.

**Quality budgets that matter**:
- Planner needs `max_tokens=4096` (was 500, then 1024 -- gemini's verbose JSON for 5-agent plans hits 1100-2500 tokens)
- Sub-agents: 1500-2500 per section step, 3000+ for the final CSS step
- `GEMINI_MAX_TOKENS_OVERRIDE` env replaces every gemini caller's budget (inspection mode)
- `AGENTFORGE_FORCE_SUB_AGENT_PROVIDER=gemini` forces sub-agents to use gemini even if a planner step says `provider:groq` (useful when probing maximum quality)
- `AGENTFORGE_SUB_AGENT_MAX_TOKENS` env raises per-step ceiling

**Phase 18 verdict context**: the original "do not upgrade the model" decision was made when groq llama-3.1-8b was primary and the OUTPUTS were the bottleneck. Migration to gemini-3-flash-preview happened because gemini produces measurably more complete artifacts (per user verification on website_builder outputs). The decision against further upgrades still stands -- gemini-3-flash-preview is sufficient for current output requirements.

---

## 5. SSE event contract (server.py /run)

| Event | Key fields |
|---|---|
| `started` | `run_id` (`ui_<8hex>`), `prompt`, `mcp_enabled` (bool) |
| `stage` PROMPT_OPTIMIZER | `status`, `optimized_prompt`, `detected_domain`, `complexity`, `detected_requirements`, `duration` |
| `stage` PLANNER | `status`, `duration`, `spec`, `execution_plan` |
| `spec` | echo of spec for convenience |
| `stage` (x8 builder phases) | Spec Validation, Execution Planning, Template Loading, Template Rendering, Code Injection, Quality Validation, Syntax Validation, File Writing |
| `stage` VALIDATOR | `status`, `validation_status`, `validation_score`, `errors`, `warnings`, `duration` |
| `template_saved` | `True` only if validation_status==passed AND template_store.save_template returned True |
| `run_saved` | `True` only if validation_status==passed AND run_store.save_run returned True |
| `success` | `build_duration`, `output_path`, `code`, `domain`, `quality_score`, `run_audit`, `validation_status`, `validation_score`, `validation_report`, `template_saved`, `run_saved`, `sub_agent_results`, `sub_agent_summary` |
| `failed` | `final_error`, `error_stage`, `details`, `build_duration?`, `run_audit?` |

When user reports "run didn't save", inspect `template_saved` and `run_saved` values in the browser DevTools Network tab SSE stream. Don't infer from UI.

---

## 6. Token audit shape

```python
{
  "total_tokens": int,
  "prompt_tokens": int,                  # optional, planner folds in
  "completion_tokens": int,              # optional, planner folds in
  "agents_executed": list[str],          # ["step_1", "step_2"] -- LIST, not int
  "provider_usage": {"gemini": int, "groq": int},
  "per_agent_tokens": {agent_id: {prompt_tokens, completion_tokens, total_tokens, provider}},
  "failed_step": str | None,
}
```

`per_agent_tokens["planner"]` is also folded in. `agents_executed: list[str]` is the post-BUG-E format; `audit_checker.py` accepts both int (legacy) and list (current).

**The audit shape used by `_init_run_audit` in builder.py is the authoritative shape for the validator**: `{"total_tokens": 0, "agents_executed": [], "provider_usage": {}}`. When writing test fixtures or synthetic states, use THESE field names -- not `tokens_used` or `stages_completed`.

---

## 7. Validation report shape

```python
{
  "validation_status": "passed" | "failed",
  "syntax_valid": bool,
  "file_valid": bool,
  "execution_valid": bool,
  "audit_valid": bool,
  "browser_valid": bool,                 # website_builder only
  "triviality_warning": bool,
  "score": int,                          # 0-100
  "errors": list[str],                   # prefixed "CRITICAL:" or "AUDIT:"
  "warnings": list[str],                 # may include "TRIVIAL_OUTPUT: ..."
}
```

---

## 8. Domains supported

`SUPPORTED_DOMAINS = {"website_builder", "document", "web_research", "data_transform"}` (in `services/errors.py`).

Cross-language mapping (when backend is wired):

| Layer  | Example      |
| ------ | ------------ |
| Shared | web_research |
| Prisma | WEB_RESEARCH |
| Python | web_research |

---

## 9. Environment variables

| Var | Default | Purpose |
|---|---|---|
| `AI_PORT` | `4000` | uvicorn port |
| `AI_CORS_ORIGINS` | (unset) | Comma-separated origin allowlist; if unset, allows `*` with stderr warning |
| `LLM_PROVIDER` | `gemini` | **Default provider (PRIMARY)**. Was `groq` pre-2026-05-11. |
| `LLM_FALLBACK_PROVIDER` | `groq` | Used when primary fails |
| `LLM_MAX_RETRIES` | `3` | Total attempts on transient errors |
| `LLM_RETRY_BASE_DELAY` | `1.0` | Seconds; doubled per attempt |
| `GEMINI_THINKING_BUDGET` | `0` | **MANDATORY = 0** for gemini-3-flash-preview. Any other value fails. |
| `GEMINI_MAX_TOKENS_OVERRIDE` | (unset) | Inspection mode: replaces every gemini caller's max_tokens budget |
| `AGENTFORGE_FORCE_SUB_AGENT_PROVIDER` | (unset) | When set (e.g. `gemini`), forces sub-agents to use this provider regardless of planner-assigned provider |
| `AGENTFORGE_SUB_AGENT_MAX_TOKENS` | (unset) | Per-step max_tokens override for sub-agents |
| `AGENTFORGE_TRACE` | `0` | When `1`, writes per-run JSONL traces |
| `AGENTFORGE_PLAIN_LOGS` | `0` | When `1`, observability uses human format |
| `AGENTFORGE_MCP_DOCS` | `0` | When `1`, builder fetches MCP doc context for step_1 |
| `EXA_API_KEY` | (unset) | When set, enables Exa web search MCP for `web_research` domain |
| `QDRANT_URL` | (required for persistence) | Qdrant Cloud cluster URL (current: eu-central-1 cluster) |
| `QDRANT_API_KEY` | (required for persistence) | JWT for Qdrant. **In `.env` at REPO ROOT** |
| `GROQ_API_KEY`, `GEMINI_API_KEY`, `MINIMAX_API_KEY`, `KIMI_API_KEY` | -- | Per-provider credentials |

**Critical**: `.env` is at REPO ROOT (`AgentForge\.env`), not `apps/ai/.env`. `server.py` loads it via `load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))`. The repo has no `apps/ai/.env`. Smoke tests must load `r'C:\...\AgentForge\.env'` explicitly.

`.env` is gitignored (contains real keys). `.env.example` is tracked (placeholders only, never real values).

---

## 10. Tests (DELETED 2026-05-10)

**All test files were deleted at the user's explicit request: "DELETE ALL THE TESTED FILES BUT ALSO WITHOUT AFFECTING THE PROJECT".**

Removed: `test_comprehensive.py`, `test_builder_audit.py`, `test_prompt_optimizer.py`, `test_validator_adversarial.py`, `test_phase1.py`, and the entire `apps/ai/src/tests/` directory.

**Hard rule**: do NOT recreate test files under any name (`test_*.py`, `*_spec.py`, `_probe.py` for repeated runs, etc.) without explicit user confirmation. If a brief asks for new tests, surface the conflict before acting. See section 17.16.

If verification is needed, run a one-shot probe script at the repo root with a `_` prefix (e.g. `_probe.py`), READ the output, and DELETE the script and any artifacts before finishing. See section 17.15.

**EXCEPTION**: When verifying persistence or storage, LEAVE the saved artifact in place so the user can independently see it in the Qdrant dashboard. See rule 17.18.

---

## 11. Audit reports written across sessions

| File | When | Scope |
|---|---|---|
| `apps/ai/DIAGNOSTIC_REPORT.md` | 2026-05-09 | Pre-fix diagnosis: what's actually in the codebase vs the brief's premise. |
| `apps/ai/OPTIMIZATION_REPORT.md` | 2026-05-09 | Surgical fixes summary: BUG-A through BUG-E. |
| `apps/ai/VALIDATOR_PRODUCTION_AUDIT_REPORT.md` | 2026-05-10 | Validator hardening: 19 adversarial probes, 6 found gaps, 3 fixed, 3 deferred with documented reasons. |
| `apps/ai/AGENTFORGE_COMPLETE_SYSTEM_AUDIT.md` | 2026-05-10 | 17-phase system audit. 64 findings (4 critical / 15 high / 30 medium / 15 low). Phase 18 verdict: do NOT upgrade LLM yet. |

These are deliverables for humans, not machine-readable specs. Verify against current code before acting on any specific recommendation.

---

## 11.5 MCP Doc-Tool Integration (2026-05-10)

The builder can inject ground-truth API/library docs into step_1's prompt before code is written. Off by default behind `AGENTFORGE_MCP_DOCS=1`.

### Connectors wired

| MCP | URL | Auth | Tool(s) | Fires for |
|---|---|---|---|---|
| Microsoft Learn | `https://learn.microsoft.com/api/mcp` | none | `microsoft_docs_search` | every build (always queried with goal text) |
| Context7 | `https://mcp.context7.com/mcp` | none | `resolve-library-id` -> `query-docs` | only when goal contains a known library keyword (`_LIB_HINTS` substring match) |
| Exa | `https://mcp.exa.ai/mcp?exaApiKey=<key>` | API-key query param | `web_search_exa` | only when `domain=web_research` AND `EXA_API_KEY` is set |

### Architecture (post-fix)

- **Single file**: `apps/ai/src/services/mcp_tools.py`. No `src/mcp/` directory. No per-connector classes. No plugin registry.
- **One-shot fetch**: `builder_node` calls `fetch_docs_context(domain, goal, max_chars=1500)` once per build, before the sub-agent loop. Result passed only to step_1 via `docs_context` kwarg.
- **Isolated event loops**: each MCP call runs in its own `asyncio.run()` via `_run_one()` helper. Sharing one event loop across multiple streamable-HTTP MCP sessions exposed an SDK cleanup race -- the second/third session returned empty even when healthy. Isolated loops are simpler AND more reliable than `asyncio.gather`.
- **Per-source budget**: total `max_chars` is split equally across MCPs that returned content (`max_chars // n_sources`, floor 200).
- **Cache**: 5-minute process-local TTL dict keyed on `(domain, goal)`. Both successful AND empty fetches are cached. Cleared on process restart.
- **Timeouts**: 12s per MCP call. No total timeout. On any failure, `fetch_docs_context()` returns `""` and the build proceeds normally.
- **SSE event**: `mcp_enabled: bool` on the `started` event.
- **Sync architecture preserved**: `asyncio.run()` is wrapped inside `fetch_docs_context()`. Builder loop is still a plain for-loop.

### Endpoint quirks worth remembering

- Context7 `resolve-library-id` requires BOTH `libraryName` AND `query` arguments.
- Context7 `query-docs` requires `libraryId` (the `/org/project` form returned by resolve), not the bare library name.
- MS Learn search returns 15k-25k chars routinely. Without per-source budget it floods the output cap.
- First MCP call after process start needs ~10-12s due to TLS warmup. Warm calls are 3-7s.
- The `mcp` SDK's streamable-HTTP transport prints "Error parsing SSE message" + ClosedResourceError to stderr during cleanup. Non-fatal SDK noise.
- All three endpoints have transient empty responses on bad days; graceful degradation is critical.

### Dependencies

- `mcp==1.27.1` in `Requirements.txt`.
- Uses `mcp.client.streamable_http.streamablehttp_client` for all three endpoints.

---

## 11.6 Qdrant persistence integration (verified 2026-05-11)

### Smoke test (sanity check before reporting persistence works)

1. Load `.env` from repo root: `load_dotenv(r'C:\...\AgentForge\.env')`
2. Set `PYTHONPATH=C:\...\AgentForge\apps\ai\src`
3. Use repo-root venv: `C:\...\AgentForge\venv\Scripts\python.exe`
4. `from services import template_store as ts; ts.save_template(run_id=..., domain=..., goal=..., spec={...}, generated_code=..., score=100)` -- returns True
5. `from services import run_store as rs; rs.save_run({run_id, domain, status, generated_code, spec, validation_status, validation_score, ...})` -- returns True
6. Verify via `client.count(collection_name=..., exact=True).count` -- should increment by 1 in both collections

A full replay of the live validator path against an artifact at `generated_agents/run_<id>.py` is the most realistic test -- it goes through state/syntax/file/execution/audit/triviality before calling `_persist_to_qdrant`.

### Verification artifacts policy

When the user asks "did persistence work?", LEAVE the saved point in place. The user verifies via the Qdrant dashboard, not your stderr. Auto-cleanup of probe points hides the evidence they need to see. See rule 17.18.

### Diagnosing "didn't save" reports

Walk this checklist BEFORE chasing exotic causes (see also rule 17.19):

1. **Was the server restarted after the last code/dep change?** Most "still broken" reports are stale processes. `_init_failed=True` and `_client/_model` caches survive code reloads.
2. **Did the change actually land in the running process's import path?**
3. **What does the SSE event actually say?** Check `template_saved`, `run_saved`, `validation_status` from DevTools Network tab.
4. **Is there a real artifact to inspect?** `apps/ai/src/generated_agents/run_<id>.py` shows what the build actually produced.

---

## 12. Cumulative bug-fix history

### 2026-05-09 session (initial pipeline pass)

- **BUG-A**: builder never set status="completed" -> fixed
- **BUG-B**: `_build_safe_agent` concatenated all outputs -> fixed (last-only for text domains, concat for data_transform)
- **BUG-C**: planner exceptions silently failed -> fixed (`final_error_details` captures exception_type+message)
- **BUG-D**: `serialize_html`/`serialize_css` had triple-quote-collision -> fixed (json.dumps everywhere)
- **BUG-E**: `_track_agent` summed `max_tokens` not real usage -> fixed (all providers now return `(text, usage)` tuple)

### 2026-05-10 session (validator + system audit)

- **AUDIT-1 (CRITICAL)**: `audit_checker` required `agents_executed: int`, builder writes list -> accept both
- **AUDIT-2 (HIGH)**: `syntax_checker` missed unresolved BUILDER_INJECT/Jinja markers -> added `check_unresolved_markers`
- **AUDIT-3 (CRITICAL)**: server.py bypassed graph (optimizer + validator unreachable) -> wired into `stream_pipeline`
- **AUDIT-4 (CRITICAL)**: server.py had `os.chdir` at import time -> removed
- **AUDIT-5 (CRITICAL)**: CORS hardcoded to `*` -> env-driven allowlist via `AI_CORS_ORIGINS`
- **AUDIT-6 (HIGH)**: subprocess inherited PYTHONPATH (host modules importable) -> `_build_clean_env()`
- **AUDIT-7 (HIGH)**: planner had weaker JSON recovery than sub_agent -> shared `services/llm_parsing.py`
- **AUDIT-8 (HIGH)**: no LLM retry on transient errors -> retry+backoff in `llm.py`
- **AUDIT-9 (HIGH)**: no structured logging -> `services/observability.py`
- **AUDIT-10 (HIGH)**: no per-run trace -> `services/tracer.py`
- **AUDIT-11 (HIGH)**: no prompt-injection defense -> `<user_input>` wrapper paragraph in planner_prompt + prompt_optimizer_prompt
- **AUDIT-13 (MEDIUM)**: triviality not detected -> conservative warning (imports-only, all-pass)
- **AUDIT-14 (MEDIUM)**: state contract not enforced at runtime -> `require_state_keys()` helper

### 2026-05-10 session (MCP integration)

- MCP-1 through MCP-13: see section 11.5 for connector wiring history.

### 2026-05-10/11 session (Qdrant persistence + provider migration)

- **QDRANT-1**: Wired `template_store.py` (per-domain `templates_<domain>` collections, cosine, 384-dim).
- **QDRANT-2**: Wired `run_store.py` (single `runs` collection, deterministic point_id via md5(run_id), idempotent re-saves).
- **QDRANT-3**: Validator persistence gate -- only fires on `validation_status == "passed"`. Failed builds hard-code `template_saved=False`, `run_saved=False`.
- **QDRANT-4**: Dedup contract -- score >= 0.75 with margin 5 quality points to upgrade vs skip.
- **QDRANT-5**: Payload index discovery -- only `runs` has KEYWORD index on `run_id`; templates collections do not. Filter-delete on templates returns 400. Workaround: scroll + delete-by-point-id.
- **QDRANT-6**: Process-local module cache -- `_init_failed=True` survives code reloads. After `pip install sentence-transformers`, the running uvicorn MUST be killed and re-launched.
- **QDRANT-7 (2026-05-11)**: sentence-transformers was missing from the venv, causing `_init_failed=True` even though the code was correct. Reason "nothing saves to Qdrant" was traced to missing dep, not logic bug. Fix: pip install + restart uvicorn.
- **QDRANT-8 (2026-05-11)**: Requirements.txt had duplicate `qdrant-client` entries (`==1.17.1` AND `>=1.9,<2.0`) and missing torch/transformers transitives. Fixed: full `pip freeze` rewrite -> 96 packages all pinned exactly.
- **QDRANT-9 (2026-05-11)**: Smoke test loaded wrong `.env` (`apps/ai/.env` doesn't exist; real one is at repo root). Fix: load from `r'C:\...\AgentForge\.env'`.
- **QDRANT-10 (2026-05-11)**: Auto-cleanup of verification points hid evidence -- user saw 0 points in dashboard despite "save returned True". Fix policy: leave verification artifacts in place. See rule 17.18.
- **QDRANT-11 (2026-05-11)**: Synthetic test state had wrong field names (`tokens_used`, `stages_completed` instead of `total_tokens`, `agents_executed`, `provider_usage`). Made validator falsely report "audit_validation fails". Fix: use real audit shape from `_init_run_audit`. See rule 17.19.
- **PROVIDER-1 (2026-05-11)**: Default provider migrated from `groq` to `gemini` because gemini-3-flash-preview produces measurably more complete website_builder artifacts. `LLM_PROVIDER=gemini`, `LLM_FALLBACK_PROVIDER=groq`. `thinking_budget=0` mandatory for the preview model.
- **PROVIDER-2 (2026-05-11)**: Added `AGENTFORGE_FORCE_SUB_AGENT_PROVIDER`, `AGENTFORGE_SUB_AGENT_MAX_TOKENS`, `GEMINI_MAX_TOKENS_OVERRIDE` envs for quality-probing experiments.
- **PROVIDER-3 (2026-05-11)**: Planner `max_tokens` bumped to 4096 because gemini's verbose JSON for 5-agent plans hits 1100-2500 tokens (was 500, then 1024 -- both truncated).
- **PROMPT-1 (2026-05-11)**: Sub-agent prompt rewritten with REWRITE-THE-WHOLE contract -- each step emits the COMPLETE artifact built so far. Concrete element counts, exact element types, no Lorem ipsum / TODO. Reason: user explicitly rejected scaffold-only outputs. See rule 17.20.

### Deferred (still open)

- Conditional graph edges (#14)
- Domain plugin system (#16)
- LLM cache for dev (#20)
- AGENT_TEMPLATE format extraction (#22)
- Sanitizer indent normalization (#23)
- Domain skeleton parameterization (#24)
- Observability MCPs (Slack/Linear/Figma/Supabase) -- different concern from doc quality

---

## 13. Cleanup state (2026-05-11)

Deleted in cleanup passes across sessions:
- 6 broken test files from earlier sessions (test_phase3/4/5, test_quality, debug_builder, debug_pipeline, debug_step)
- 2 dead prompt files (`website_builder_prompt`, `builder_prompt`)
- All `__pycache__/` dirs (in `.gitignore`)
- All `generated_agents/run_*.py` artifacts (in `.gitignore`; `file_writer.py` auto-recreates the dir)
- `uploads/zip_sums.csv` and `uploads/monthly_sales (1).csv` stray data
- ~174 leaked tempdirs from earlier adversarial test runs

**2026-05-10 deletions**:
- ALL test files (`apps/ai/test_*.py` + `apps/ai/src/tests/`) -- per user request "DELETE ALL THE TESTED FILES"
- One-shot MCP probe scripts (`_probe*.py`, `_trace_run.py`) deleted before final summary
- `EXA_API_KEY` value relocated from tracked `.env.example` to gitignored `.env`; example blanked

**2026-05-11 deletions**:
- Smoke-test probe scripts after verifying Qdrant round-trip
- KEPT in place: verification points in Qdrant (`templates_website_builder` x2, `runs` x3, `templates_document` x1) so user can see them in dashboard

`.gitignore` covers: `__pycache__/`, `*.pyc`, `apps/ai/src/generated_agents/run_*.py`, `apps/ai/uploads/*` (with `.gitkeep` exception), `.env`. The `!.env.example` exception in `.gitignore` makes `.env.example` explicitly trackable -- NEVER write real keys to `.env.example`.

---

## 14. Frontend (preserved from prior memory)

### Layout

```
apps/frontend/src/
  App.tsx                    # state-machine router (NO react-router-dom)
  index.css                  # all design tokens + keyframes
  components/
    BackgroundLayers.tsx
    Icons.tsx
    Navbar.tsx
    WorkflowTheater.tsx
  pages/
    Home.tsx, RunExecution.tsx, Runs.tsx, Agents.tsx,
    Pricing.tsx, Account.tsx, Admin.tsx, Settings.tsx
  data/
    mockData.ts              # MOCK_AGENTS, MOCK_RUNS, MOCK_LOGS, MOCK_RESULT
```

### Conventions to match

- Inline styles only (`const s: Record<string, React.CSSProperties> = { ... }`)
- All keyframes live in `index.css`
- CSS custom properties for tokens (`var(--accent-purple)`, etc.)
- Sub-components co-located in same file
- No comments unless the *why* is non-obvious
- No emojis in code/UI text except existing checkmarks
- Do NOT introduce `react-router-dom`
- Do NOT introduce Tailwind / new styling systems
- Do NOT add JSDoc/TSDoc or verbose comments

### Frontend type check (PowerShell)

```powershell
& "C:\Users\1mhmd\OneDrive\Desktop\Ai Projects\AgentForge\node_modules\.bin\tsc.cmd" --noEmit -p "apps\frontend\tsconfig.json"
```

### Dev server

`npm run dev:frontend` from repo root -> `localhost:5173`

### WorkflowTheater -- critical rules (do not regress)

- Perspective: `1100px`, origin `50% 30%`
- World: `rotateX(26deg)` + `preserve-3d`
- Agents at x = `-310, 0, 310`
- Sub-agent fan centered at `left: 50%; bottom: 50px; height: 175px`
- Energy beams at `top: 49%`
- `humanoidBob` keyframe must be Y-only (no translateX/translate3d)
- Body div must NOT have `marginLeft: -40`
- `backdrop-filter` creates stacking context -> `promptWrap` uses `position: relative; zIndex: 10`
- Builder is conditionally rendered (building + completed)
- Walk-in and bob are separate wrappers

### ui.html (debug surface)

- `<select id="domain-select">` -- 2026-05-10 fix; was `<select title="domain-select">` which caused `getElementById` null at line 1194.
- Status text adds " · docs MCP" suffix when `started.mcp_enabled === true`.

### Frontend corrections already burned-in (don't reintroduce)

1. Dropdown overlap fixed by `promptWrap` zIndex
2. Sub-agent fan origin aligned via `bottom: 50px` + `height: 175px`
3. Energy beams at `top: 49%`
4. Agents spacing to plus/minus 310, beam ends inset plus/minus 40
5. `humanoidBob` keyframe Y-only
6. Removed body `marginLeft: -40`
7. Builder hidden during planning/validating
8. Walk-ins separated from bob animation, keyed on `runId`
9. Sub-agent count random 5-9 with backend swap marker

---

## 15. Backend (NestJS, in dev by friend)

The user's friend is implementing the NestJS backend. When backend goes live:
- Sit between frontend and the Python AI service
- Persist runs to PostgreSQL via Prisma
- Map between Shared Types (`packages/shared`) <-> AI state shapes
- Re-stream SSE events to the frontend

### Cross-language type contract (Shared Types are SOURCE OF TRUTH)

`packages/shared/core.ts`:
```ts
export type Domain = "web_research" | "document" | "data_transform" | "website_builder";
export type Stage = "planning" | "building" | "validating" | "completed";
export type RunStatus = "queued" | "running" | "completed" | "failed";
export type Complexity = "simple" | "medium";
```

`packages/shared/agent.ts`:
```ts
export interface AgentSpec {
  goal: string;
  domain: Domain;
  inputs: Array<{ name: string; type: string }>;
  outputs: Array<{ name: string; type: string }>;
  tools: string[];
  steps: string[];
  success_criteria: string;
  complexity: Complexity;
}
```

### Final rule on contract drift

If two parts of the system disagree -> **shared types win.** Not Prisma, not backend DTOs, not AI state.

---

## 16. User profile

### Identity

- **Name**: Mhmd Salim
- **Email**: rabih@chipatech.com
- **Role**: Software developer; building AgentForge solo on the AI + frontend, with a friend on backend
- **Environment**: Windows 11, Python 3.11.x, PowerShell default shell (bash also available via Git/WSL)
- **Project root**: `c:\Users\1mhmd\OneDrive\Desktop\Ai Projects\AgentForge`

### Communication style

- Informal English with consistent typos (plzz, u, nb, fous, validater, hiddin, donot, prefernces) AND occasional voice-input transcription artifacts ("did u" / "veny" -> "venv"). Don't correct them; read for intent.
- Prefers numbered lists when requesting multiple tasks ("1- update the requirements 2- why didnt it save").
- Describes by visuals/intent, not pixels ("the sub-agent fan looks off", "make it both", "the one that i really need")
- "live" = dynamic/cinematic, not literal real-time
- Often hands MASSIVE prescriptive prompts (audit specs with 17 phases, NestJS backend specs, MCP integration briefs with 8 connectors). Read carefully but don't take every claim at face value -- some refer to code that doesn't exist, use outdated diagrams, or have wrong API shapes. Diagnose first.

### Working preferences

- **Bias to action when given a green light.** "continue", "ok go", "make it both", "do all of them" mean EXECUTE -- not "ask me again".
- **Surgical patches.** No refactors. No new abstractions. No backwards-compat shims around dead code.
- **No fabricated metrics.** Cite real evidence (file:line, observed test results). Severity buckets and counts are fine because they're real.
- **Diagnose before coding.** Many briefs are written against an older codebase or have wrong API shapes. Read the relevant source FIRST, then propose.
- **No tests created without permission.** User deleted all tests 2026-05-10; do not recreate them or any test-shaped file under different names.
- **Verifies visually.** Browser at `localhost:5173`, Qdrant Cloud dashboard, generated HTML in the browser. Leave verification artifacts in place.
- **Wants complete artifacts.** "I need a full page created not only html structure." No Lorem ipsum / TODO / placeholders.
- **Never `git commit` unless asked.** User owns commit decisions.
- **When asked to "write a prompt for my friend"**, deliverable is just the prompt text -- no code execution.
- **Architecture preservation matters.** Don't propose async/threading/multiprocessing in the AI service. Don't add LangGraph wiring that changes existing behavior. The no-async rule is about the pipeline, not banning event loops inside isolated sync functions.

---

## 17. HARD RULES (do not violate)

These are corrections the user has explicitly given; each comes from a real failure or strong preference. The auto-memory system at `~/.claude/projects/.../memory/` has individual files per rule -- those are authoritative; this list is the consolidated reference.

### 17.1 "Continue" / "ok go" / "make it both" means EXECUTE

When the user replies "continue", "ok go", "do all of them", "make it both", or hands a prescriptive task spec -- EXECUTE. Do not ask another decision question.

- Decision-gate rule applies to the START of an open-ended task -- not every batch within it.
- ASK up front (max 1 question) when: codebase doesn't match the task's premise; multiple sensible architectural paths exist; the work would touch shared resources.
- DON'T ask "Do you want me to also do X?" when X was already in the user's task list.

### 17.2 No fabricated metrics in audit reports

Never invent percentages ("+300% quality", "+370% code richness"), multipliers, or measurements you didn't measure.

- Cite real file paths and line numbers (e.g. `server.py:13`)
- Mark estimates explicitly: "directional, not measured"
- Use real test results: "32/32 tests pass" beats "test coverage: high"
- Counts (errors found: 64) and severity buckets (Critical: 4 / High: 15) are FINE because they're real.

### 17.3 Diagnosis-first approach

Always read and verify the current state of the code BEFORE writing fixes. Task briefs may be written against an older codebase.

- Read the relevant source files before proposing any change
- When a brief says "X is broken", check if X is actually broken in the current code
- Present diagnosis findings to user BEFORE coding
- If a stated problem is already fixed, say so explicitly and redirect to the real issues

### 17.4 Surgical patches only

No refactoring, no new abstractions, no cleanup beyond explicit scope.

- Fix the specific bug; do not clean up surrounding code
- Do not introduce helper classes, registries, or new modules unless the task demands it
- No backwards-compatibility shims for removed code -- delete completely
- No feature flags, no optional parameters for hypothetical future callers
- Three similar lines is better than a premature abstraction

### 17.5 Python source: ASCII only

NEVER use em-dashes, en-dashes, smart quotes, curly quotes, or any non-ASCII punctuation in Python source files.

- Windows Python 3.11.x rejects non-ASCII even inside comments. Error: `SyntaxError: invalid character 'U+2014'`.
- Use `--` for em-dash, `-` for en-dash, straight quotes only, `*` or ALL-CAPS for emphasis.

### 17.6 Triple-quote docstring rule

Never put `"""` inside a `"""..."""` docstring -- use `#` line comments instead.

### 17.7 call_llm returns a tuple

Always unpack: `text, usage = call_llm(...)`. Never assign to a single variable.

- Usage dict shape: `{prompt_tokens: int, completion_tokens: int, total_tokens: int, provider: str}`
- When writing test stubs for call_llm, return `(json_string, usage_dict)` -- never just the string

### 17.8 Architecture preservation (will reject)

- Async / threading / multiprocessing as a pipeline pattern (event loops inside individual sync functions are FINE)
- New frameworks, DBs, queues, DI containers
- Shape changes to `AgentForgeState` TypedDict (additive runtime keys are OK)
- LangGraph wiring changes that break existing test stubs
- New stage constants without a clear reason

### 17.9 Merge conflict resolution

Read both sides carefully. Keep HEAD if HEAD contains a recent fix the user is currently working on; do not blindly accept theirs. Cite which side you kept and why. Don't `git commit` after resolution unless asked.

### 17.10 PowerShell vs bash PYTHONPATH separator

PowerShell uses semicolon `;`, bash uses colon `:`. On Windows, ALWAYS use semicolon regardless of shell -- Python on Windows expects Windows-style separator. Better: use `conftest.py` with `sys.path.insert(0, ...)`.

### 17.11 Documentation policy

No unsolicited docs (no `README.md`, `CHANGELOG.md`, etc.).

EXCEPTION: when the user explicitly asks for an audit/report/spec (DIAGNOSTIC_REPORT, OPTIMIZATION_REPORT, VALIDATOR_PRODUCTION_AUDIT_REPORT, AGENTFORGE_COMPLETE_SYSTEM_AUDIT) -- those are deliverables and should be substantial.

### 17.12 Probe external endpoints before wiring

For any third-party API/MCP integration, run a one-shot probe that hits the real endpoint, lists capabilities, and verifies argument schemas BEFORE writing the connector code.

- Save probe at repo root with `_` prefix, run it once, READ the schemas (`inputSchema` is authoritative; description text is not), then DELETE.
- Cross-check against the brief: if the brief shows different arg names, the brief is wrong. Code against the schema.

### 17.13 Probe cleanup -- delete BEFORE wrapping up

When you write a one-shot script to verify behavior, delete BOTH the script AND any artifacts it generated, BEFORE writing the final summary.

- Probe scripts go at repo root or tmp paths, never inside `apps/ai/src/`. Naming: `_probe.py` / `_trace_run.py` / underscore-prefixed.
- Always verify cleanup at the end: `rm -f _*.py` and `rm -rf apps/ai/src/generated_agents` (file_writer.py auto-recreates).
- Confirm via `git status --short` -- the only `??` entries should be actual deliverables.
- **Exception**: this rule is for probe SCRIPTS and BUILD artifacts. Verification points in Qdrant are a different category -- see rule 17.18.

### 17.14 Don't recreate patterns the user just deleted

If the user explicitly removed a category of files or pattern (tests, abstractions, registries), DO NOT silently reintroduce it -- even if a brief asks for it under a different name. Stop and ask.

- 2026-05-10: user said "DELETE ALL THE TESTED FILES" -- skipping the brief's `test_mcp_tools.py` ask was correct.
- The right response: "You said DELETE ALL TESTED FILES. The brief asks for test_mcp_tools.py -- this directly reverses that decision. Want me to do it anyway, or skip?"

### 17.15 Proactive security flag for real-looking secrets in tracked files

If you observe what looks like a real API key, token, or password in a file that is git-tracked (`.env.example`, READMEs, docs, source code), flag it explicitly.

- Verify whether a file is git-tracked: `git ls-files --error-unmatch <path>`
- In your reply: (1) name what's exposed, (2) cite file:line, (3) explain why it matters, (4) offer concrete fix (move to gitignored `.env`, blank example, rotate).
- DO NOT echo the secret back. Reference its location only.

### 17.16 Brief inspection checklist

When given a prescriptive multi-step task spec, verify these 8 things before executing:

1. Does the codebase match the brief's premise?
2. Are the API shapes correct?
3. Are the arg names/schemas correct? (Probe external endpoints.)
4. Are there fabricated metrics?
5. Does any task ask for a category the user just removed?
6. Does any task introduce architecture the user has rejected?
7. Are there real-looking secrets in tracked files?
8. Are there shadow asks ("also create unit tests", "also write README") that aren't justified by the explicit goal?

Surface skipped tasks in your reply with the reason, then execute the rest.

### 17.17 Server restart after dep install (NEW 2026-05-11)

After ANY `pip install`, the running uvicorn MUST be killed and re-launched. Module-level caches (`_init_failed=True`, `_client`, `_model`) survive code reloads if the process wasn't killed.

- 2026-05-11 case: `sentence-transformers` was added to the venv but the user's uvicorn was started BEFORE the install. `_get_model()` had cached `_init_failed=True` from the first ImportError; all subsequent template_store.save calls returned False silently.
- Always ask FIRST when the user reports "still broken after fix": "Did you restart the AI server after the last code/dep change?"
- For your own smoke tests, start a fresh Python process every time.

### 17.18 Leave verification evidence in place for the user to confirm (NEW 2026-05-11)

When the user asks to verify that something works (Qdrant persistence, file output, API call), run the smoke test in a way that LEAVES evidence behind for them to check, rather than tidying up immediately.

- 2026-05-11 case: I ran a Qdrant round-trip that saved a point then deleted it as cleanup. The user looked at the dashboard, saw 0 points, and concluded "you said it worked but nothing is there." They couldn't independently verify.
- For persistence verification: save with a clearly-tagged run_id (e.g. `verify-<uuid8>`), leave the point in place, and tell them what to look for in the UI.
- For file output: write to a known path and tell them the path so they can inspect.
- Only clean up AFTER the user has independently confirmed they can see the artifact.
- **Different from rule 17.13**: that rule is about deleting probe SCRIPTS to not pollute the codebase. This rule is about not removing the EVIDENCE the user needs to verify the work.

### 17.19 Verify with real artifacts, not synthetic dicts (NEW 2026-05-11)

When testing the validator or persistence flow, drive it with an actual `apps/ai/src/generated_agents/run_*.py` file the build pipeline produced. Don't fabricate a synthetic state dict with guessed field names.

- 2026-05-11 case: my synthetic state had `tokens_used` and `stages_completed`. Real shape from `_init_run_audit` is `{"total_tokens": 0, "agents_executed": [], "provider_usage": {}}`. The synthetic state made the audit checker falsely report a failure that doesn't exist in the live flow.
- Always sanity-check field names against the actual code that produces the state -- read `_init_run_audit` in `builder.py`, the validator's `require_state_keys` call, etc.
- For a full end-to-end verification, point the validator at a real `run_<id>.py` artifact and let it walk all 7 stages.

### 17.20 User wants complete artifacts, not minimal scaffolds (NEW 2026-05-11)

When the user asks for a generated artifact (website page, document, etc.), they want the FULL deliverable. NO Lorem ipsum / TODO / placeholders.

- 2026-05-11 corrections: "i need a full page created not only html structure" and "i need the subagent to be precise and this must be through divide the tasks truely and in detailed".
- Planner uses 3-5 sub-agents for website_builder using section-per-step pattern (hero / menu / about / contact+footer / complete responsive CSS).
- Sub-agent contract is REWRITE-THE-WHOLE: each step emits the COMPLETE artifact built so far plus its own addition.
- Concrete instructions beat generic ones: "emit `<section id='menu'>` with 6 `<article class='menu-item'>` each containing `<h3>` name, `<p>` description, `<span class='price'>`, items: Espresso, Cappuccino, Latte, Mocha, Cold Brew, Pour Over" produces detailed output; "do the styling" produces vague output with placeholders.
- Provider matters: gemini-3-flash-preview produces detailed sections, groq-llama-3.1-8b produces shorter / boilerplate. Default `LLM_PROVIDER=gemini` is intentional.
- max_tokens budgets matter: planner needs 4096, sub-agents need 1500-2500 per section step, 3000+ for the final CSS step.

---

## 18. Anti-patterns to avoid

- Over-analyzing screenshots
- Adjusting magic numbers instead of root causes
- Treating bugs as separate when one root cause exists
- Acting on linter noise (inline styles etc.)
- Long narrative responses
- Asking permission for obvious related fixes when user said "go"
- Reading entire files unnecessarily
- Adding helpers / abstractions / plugins for hypothetical future callers
- Inventing quality percentages or speedup multipliers in audits
- Recommending model upgrades when engineering ROI hasn't been exhausted
- Recreating tests / abstractions / patterns the user explicitly removed
- Using `asyncio.gather` for multiple streamable-HTTP MCP sessions in one event loop (cleanup race -> empty results)
- Letting one verbose source flood a multi-source budget without per-source allocation
- Writing real keys to `.env.example`
- Leaving probe scripts or run artifacts in the repo after verification
- Auto-cleaning Qdrant verification points before the user can see them in the dashboard
- Synthetic test states with guessed field names instead of using real `_init_run_audit` shape
- Forgetting to restart uvicorn after `pip install`
- Generating Lorem ipsum / TODO placeholders in user-facing artifacts

---

## 19. Things deliberately NOT done

- No API client yet
- No utils package
- No validation package
- No logs table
- No microservices split
- No Tailwind / new styling systems on frontend
- No `react-router-dom`
- No JSDoc/TSDoc
- No compatibility shims around mocks
- No emojis in code/UI text
- No bypassing hooks
- No async / threading / multiprocessing as a pipeline pattern
- No tests (deleted 2026-05-10; do not recreate)
- No `src/mcp/` directory or per-connector classes (single-file mcp_tools.py is intentional)
- No quality bonus in validator for MCP usage (fabricated metric)
- No AGENT_TEMPLATE injection of MCP runtime (build-time tool, not runtime artifact)
- No observability MCPs wired (Slack/Linear/Figma/Supabase) -- different concern
- No legacy `google-generativeai` SDK -- only `google-genai`
- No model upgrade beyond `gemini-3-flash-preview` for now (sufficient for current quality)

Reason throughout: premature complexity.

---

## 20. Memory system pointers

The user has a parallel auto-memory system at `~/.claude/projects/c--Users-1mhmd-OneDrive-Desktop-Ai-Projects-AgentForge/memory/` with discrete files per rule. Index lives in `MEMORY.md` inside that directory and is auto-loaded each session. Authoritative individual feedback/reference files (as of 2026-05-11):

**User profile**
- `user_work_style.md`

**Feedback (hard rules)**
- `feedback_continue_means_execute.md`
- `feedback_no_fabricated_metrics.md`
- `feedback_diagnosis_first.md`
- `feedback_surgical_patches.md`
- `feedback_python_source_rules.md`
- `feedback_triple_quote_docstrings.md`
- `feedback_call_llm_signature.md`
- `feedback_merge_conflict_resolution.md`
- `feedback_powershell_pythonpath.md`
- `feedback_brief_inspection_checklist.md`
- `feedback_dont_recreate_deleted_patterns.md`
- `feedback_probe_endpoints_before_wiring.md`
- `feedback_probe_cleanup.md`
- `feedback_proactive_security_flag.md`
- `feedback_tempfile_leaks.md`
- `feedback_test_patching.md`
- `feedback_server_restart_after_install.md` (NEW 2026-05-11)
- `feedback_verify_with_real_artifacts.md` (NEW 2026-05-11)
- `feedback_leave_evidence_for_user.md` (NEW 2026-05-11)
- `feedback_user_wants_complete_artifacts.md` (NEW 2026-05-11)

**Project / reference**
- `project_agentforge.md` (architecture snapshot)
- `project_mcp_integration.md`
- `reference_audit_reports.md`
- `reference_qdrant_persistence.md` (NEW 2026-05-11)
- `reference_qdrant_smoke_test.md`

This root-level `MEMORY.md` is the consolidated hand-off. If you (a future AI) are running with the auto-memory system loaded, prefer the per-rule files for canonical content. If not, this single document covers everything.

---

## 20.5 2026-05-12 session — end-to-end UI integration (the big one)

This session connected the dots between frontend, backend, AI service, Postgres, Qdrant, and gemini/groq for real. Every fact below comes from observed behavior on this user's machine, with code references.

### Critical NestJS gotcha: MessageEvent uses `type`, NOT `event`

**Symptom**: Frontend stepper stuck on "Planner: thinking" forever even though backend was emitting SSE events. Captured raw bytes showed `id: N\ndata: {...}` with no `event:` line. Frontend listeners (`es.addEventListener('started'|'stage'|'spec'|'success'|'failed')`) never fired because every event hit the default `message` event type.

**Root cause**: [`@nestjs/common`'s `MessageEvent.type` is the field that becomes the SSE `event:` line](node_modules/@nestjs/common/interfaces/http/message-event.interface.d.ts). The code in [`run-stream.service.ts`](apps/backend/src/runs/run-stream.service.ts) was using `subscriber.next({ event: 'stage', data })` which Nest ignores.

**Fix**: 6 spots in `run-stream.service.ts` and 1 in `runs.controller.ts`. `event:` -> `type:` in every `subscriber.next(...)` and in the Observable return type annotation.

**How to verify**: `curl http://localhost:3000/api/runs/<id>/stream -H "Authorization: Bearer <jwt>"` -- output must show `event: started\nid: 1\ndata: {...}` with the `event:` line present.

### LLM fallback: works as-is, but groq needs a max_tokens cap

`call_llm` in [`apps/ai/src/llm/llm.py`](apps/ai/src/llm/llm.py) reads `LLM_FALLBACK_PROVIDER` from env **regardless** of the `provider=` argument the caller passes -- so sub-agents that explicitly request gemini still fall back to groq when gemini fails. This was verified with a probe that forced gemini failure via bogus key; fallback fired in 3.4s.

**But**: groq's `llama-3.1-8b-instant` context window is much smaller than gemini-3-flash-preview's. When a heavy step (step_5 final-CSS, max_tokens=4000) falls back, the input prompt + 4000-token output blows the groq context, every retry fails, sub_agent returns `status="error"`, builder emits `sub_agent_failed_step_5`.

**Fix applied 2026-05-12**: `call_llm`'s fallback path now caps `max_tokens` per fallback provider via `_FALLBACK_OUTPUT_CAP = {"groq": 2000, "minimax": 2000, "kimi": 2000}`. So when gemini fails and groq picks up, groq is called with `max_tokens=min(requested, 2000)` to leave room for the prompt. Restart `python server.py` after editing this file -- module-level changes don't hot-reload.

### Gemini free tier quota maths

- Gemini free tier: **20 requests/day, per project, per model**.
- One AgentForge run = 1 optimizer + 1 planner + N sub-agents (3-7). Average ~7 calls.
- After ~3 runs the daily quota is exhausted; subsequent runs only succeed via groq fallback.
- Quota resets at midnight Pacific.
- When `AGENTFORGE_FORCE_SUB_AGENT_PROVIDER=gemini` is set in .env, EVERY sub-agent uses gemini, accelerating quota exhaustion. Removing this env lets the planner-assigned `provider` field (per agent) determine routing.

### ConcurrencyGuard: cap=1 + stuck-run trap

[`apps/backend/src/runs/concurrency.guard.ts`](apps/backend/src/runs/concurrency.guard.ts) caps each user at `Plan.maxConcurrentRuns ?? 1` runs in non-terminal state (`STARTED | PLANNING | BUILDING | VALIDATING`). When pipelines crash without emitting a terminal event, runs get stuck in those states forever and block new submissions with HTTP 429 `CONCURRENT_LIMIT`.

**Recovery**: Admin endpoint added 2026-05-12 -- `POST /api/admin/runs/cancel-active` (and a button in the Admin Console -> Overview tab) that bulk-marks every non-terminal run as `CANCELLED`. Uses Prisma `$transaction` to update both `Run` and `AgentRun` rows in one atomic step.

Backend method: `RunsService.cancelAllActive(userId?)` -- when `userId` is passed it scopes to one user, else system-wide. Returns `{ cancelled: N }`.

### Credits ledger != LLM quota

These are two completely separate "out of credits" surfaces. Confusion guaranteed if you forget:

| System | What it tracks | What blocks new runs |
|---|---|---|
| **LLM provider quota** (gemini API daily 20/day, groq rate limits) | API calls to upstream LLM | When upstream returns 429 -> fallback fires; user never sees this directly |
| **Backend credits ledger** (`CreditEntry` table) | $ value of LLM tokens consumed | `RunsController.create` checks balance via `CreditsService` -> 402-style block before AI is even called |

The user's typical confusion: gemini 429s in the streaming view, then submits a new run, sees "Out of credits -- top up" and assumes it's the same thing. It isn't. The first is gemini's daily quota; the second is the user's backend ledger balance.

**Admin grant endpoint**: `POST /api/admin/users/:id/grant-credits` -- body `{ amount: number (cents), reason?: string }`. Wired to a **+ Credits** button per user row in Admin -> Members tab (modal with amount input, $ preview, presets, optional reason). Implemented 2026-05-12.

**Pricing** (cents per 1k tokens) lives in `.env`:
```
LLM_PRICE_INPUT_PER_1K=0.5
LLM_PRICE_OUTPUT_PER_1K=1.5
```
A typical website_builder run costs ~5500 cents. 1M cents ≈ 180 runs.

### Planner: dynamic agent count (2-7), driven by sections in brief

The planner prompt [`apps/ai/src/prompts/planner_prompt.py`](apps/ai/src/prompts/planner_prompt.py) was tightened 2026-05-12 to make agent count actually scale with the user's brief instead of defaulting to 5.

**New rule** (rule 2 in the prompt): First list the sections the brief explicitly names or implies, then produce ONE agent per section plus ONE mandatory final CSS agent. Concrete sizing:
- "one-pager hero + contact" -> 3 agents (hero+chrome, contact+footer, css)
- "coffee shop landing page" (no detail) -> 4 agents (hero+chrome, menu, contact+footer, css)
- "landing page with hero, menu, about, contact, footer" -> 5 agents
- "SaaS site with hero, features, pricing, testimonials, FAQ, contact, footer" -> 7 agents

Agent count must be between 2 and 7.

### Frontend display: roles, not "Step N"

The planner emits `execution_plan.agents[]` with each entry having a `role` field like `skeleton_and_hero`, `menu_section`, `complete_responsive_css`. The frontend was reading `plan.steps[]` (array of instruction STRINGS) instead, so step.role was always undefined and the fallback name "Step N" displayed.

**Fix** in [`apps/frontend/src/pages/RunExecution.tsx`](apps/frontend/src/pages/RunExecution.tsx):
- `spec` event handler now prefers `execution_plan.agents` over `execution_plan.steps`
- New `formatSubAgentName(entry, index)` helper turns `skeleton_and_hero` -> "Skeleton & Hero", `step_N`/`agent_N` -> "Step N", capped at 22 chars

**Workflow theater spacing**: per-agent slot width scales with count -- 170px (1-5), 150px (6-8), 120px (9+). Was 100px fixed which caused role-name overlap.

### Frontend artifact extraction: read JSON-encoded vars

`safe_injector` produces Python files where the rendered output sits in JSON-encoded string assignments:
```python
HTML_CONTENT = "<!DOCTYPE html>\n<html lang='en'>..."
CSS_CONTENT  = ""
JS_CONTENT   = ""
```

The old `extractEmbeddedArtifact` scanned for `"""..."""` triple-quoted blocks, found the **f-string template** containing literal `{HTML_CONTENT}`, and dumped THAT into the iframe -- so the preview showed `{HTML_CONTENT}` instead of the website.

**Fix**: New `readJsonStringVar(name)` matches `NAME = "<json string>"` with escape handling, then `JSON.parse`s the value. Checked in priority: `HTML_CONTENT`, `CONTENT`, `CSV_CONTENT`, `JSON_CONTENT`, `MARKDOWN_CONTENT`. Falls back to longest `"""..."""` block only if no named variable is found -- and even then skips blocks containing literal `{HTML_CONTENT}` / `{CSS_CONTENT}` etc.

### Frontend: HTML fragment rendering for web_research/document

The web_research and document sub-agents emit HTML fragments (no `<html>` wrapper, just `<h1>...<section>...<table>...`). The old `looksLikeHtml` only matched `<!DOCTYPE html>` / `<html>` / `<body>`, so fragments fell through to a `<pre>` text dump.

**Fix**:
- `looksLikeHtml` now also matches fragment-indicative tags: `<h1>`, `<h2>`, `<h3>`, `<section>`, `<article>`, `<table>`, `<ul>`, `<ol>`, `<p>`, `<div>`, `<header>`, `<main>`, `<footer>`
- New `wrapHtmlFragment(html)` wraps fragments in a complete `<html>` document with **FRAGMENT_STYLES** (Inter font, 760px max-width, purple-accented headings, styled tables with hover, dark code blocks, blockquote styling) so the iframe preview reads like a real document

### WorkflowTheater visual tweaks

- **Middle sub-agent line**: when `n` is odd, the middle agent's x=0 made the Bezier control point `cx = x * 0.5 = 0` -> a degenerate vertical line that visually merged with the floor center axis. New code: `cx = x === 0 ? 16 : x * 0.5` -- gives the middle agent a visible arc.
- **Validator inspection beam**: path was `M 320 30 Q 200 90 10 160` which ended in the sub-agent strip area (below Builder's feet). Moved endpoint up to `M 320 30 Q 200 80 10 130` so the green beam lands between Builder's legs as designed.

### Admin Console additions (2026-05-12)

- `+ Credits` button per Member row, opens a modal with amount (cents) input, live $ preview, presets ($10/$100/$1k/$10k), optional reason field. Calls `POST /api/admin/users/:id/grant-credits`.
- `Cancel all active runs` button on the Overview tab, top of page. Confirms then calls `POST /api/admin/runs/cancel-active`. Reports the count.

Both calls go through the existing `RolesGuard` (ADMIN | SUPER_ADMIN) and write `AuditLog` entries.

### Auth: Google OAuth callback URL

[Memory: Google OAuth callback URL must include /api]. NestJS applies the `/api` global prefix to every controller; `auth/google/callback` becomes `/api/auth/google/callback`. **Both** `GOOGLE_CALLBACK_URL` in `.env` AND the Authorized redirect URI in Google Cloud Console MUST contain `/api`. The error "redirect_uri_mismatch (Error 400)" is always one of these two being missing.

### Login response shape

Backend wraps responses via `ResponseInterceptor` so `POST /api/auth/login` returns:
```json
{
  "success": true,
  "data": {
    "user": { "id", "email", "role" },
    "token": "<jwt>"  // field name is `token`, NOT `access_token`
  }
}
```
And sets two cookies: `token` (`HttpOnly`, `SameSite=Lax`, 15min) and `refresh_token` (path scoped to `/api/auth`, 30d).

### Railway Postgres pitfalls

The user runs against Railway-hosted Postgres. Two recurring gotchas:

1. **Internal vs public URL**: Railway exposes `DATABASE_URL` (internal `postgres.railway.internal:5432`) and `DATABASE_PUBLIC_URL` (public proxy `*.proxy.rlwy.net:<port>`). Local dev MUST use the public URL; the internal one only resolves inside Railway's network. The local `.env` `DATABASE_URL` should point at the **public** value.

2. **Pool exhaustion**: default Prisma connection pool is small. Bump via URL params: `?connection_limit=15&pool_timeout=20&connect_timeout=30`.

### Node.js 25 HTTP keep-alive gotcha (still present)

The [`AiProxyService`](apps/backend/src/runs/ai-proxy.service.ts) deliberately sets `Connection: close` on every fetch (ping AND openRunStream) to work around Node 25's built-in fetch reusing half-dead pooled sockets. Do not "optimize" this away -- it manifests as ERR_INTERNAL_ASSERTION in detachSocket / streams closing mid-event with no visible error. The 6-second timeout on `ping()` (vs the original 2s) is also part of this workaround.

### Stuck-run cleanup recipe

If the pipeline ever crashes leaving runs stuck (typical after a backend restart mid-stream, or after the SSE event-type bug above):

```powershell
# 1. log in as SUPER_ADMIN
$login = Invoke-WebRequest -Uri http://localhost:3000/api/auth/login -Method POST -ContentType 'application/json' -Body '{"email":"admin@agentforge.local","password":"Admin123!"}' -UseBasicParsing
$token = ($login.Content | ConvertFrom-Json).data.token

# 2. bulk-cancel all non-terminal runs
Invoke-WebRequest -Uri http://localhost:3000/api/admin/runs/cancel-active -Method POST -Headers @{Authorization="Bearer $token"} -UseBasicParsing
```

Or just click the **Cancel all active runs** button in Admin -> Overview.

### Endpoints added this session

| Method | Route | What it does |
|---|---|---|
| POST | `/api/admin/users/:id/grant-credits` | Admin-only positive credit grant (already existed; **wired to UI 2026-05-12**) |
| POST | `/api/admin/runs/cancel-active` | NEW 2026-05-12. Bulk-cancels every active run system-wide. |

### Files changed this session (for git context)

```
M  apps/backend/src/runs/run-stream.service.ts          (event: -> type: x6)
M  apps/backend/src/runs/runs.controller.ts             (Observable return type type:)
M  apps/backend/src/runs/runs.service.ts                (cancelAllActive method)
M  apps/backend/src/admin/monitoring/monitoring.controller.ts (POST /admin/runs/cancel-active)
M  apps/backend/src/admin/monitoring/monitoring.module.ts (imports RunsModule)
M  apps/ai/src/llm/llm.py                               (fallback max_tokens cap)
M  apps/ai/src/prompts/planner_prompt.py                (dynamic 2-7 agent count rule)
M  apps/frontend/src/pages/RunExecution.tsx             (role names, fragment wrapping, JSON var extraction)
M  apps/frontend/src/pages/Admin.tsx                    (+ Credits modal, Cancel-all button)
M  apps/frontend/src/components/WorkflowTheater.tsx     (spacing, middle arc, validator beam endpoint)
M  apps/frontend/src/api/admin.ts                       (grantCredits + cancelAllActiveRuns)
M  .gitignore                                           (probe-script patterns)
M  MEMORY.md                                            (this update)
```

---

## 20.6 New hard rules / patterns from this session (additions to section 17)

### NestJS SSE: use `type` not `event`

When emitting via `subscriber.next(...)` to an `@Sse()`-decorated route, the field name is `type` -- `event` is ignored. `MessageEvent` in `@nestjs/common` is `{ data, id?, type?, retry? }`. The corresponding output line on the wire is `event: <type>\n`. Get this wrong and every event arrives on the browser's default `message` listener.

### LLM fallback works regardless of `provider=` arg

`call_llm` reads `LLM_FALLBACK_PROVIDER` from env on every call. Sub-agents that pass `provider="gemini"` still benefit from the fallback. Do NOT add a separate fallback mechanism in sub_agent.py -- it's already there one layer up.

### Cap fallback output budget per provider

When falling back to a provider with a smaller context window (groq's llama-3.1-8b -- 8k vs gemini-3-flash's 1M), cap `max_tokens` for the fallback call. The current cap is **2000** for `groq`/`minimax`/`kimi`. Without the cap, heavy steps (step_5 final CSS @ 4000 tokens) blow the groq context and every fallback fails silently.

### Recovery: bulk-cancel stuck runs

When `ConcurrencyGuard` returns 429 `CONCURRENT_LIMIT` and new runs are blocked, the cause is stuck non-terminal runs from previous crashes -- not actual concurrent activity. Use `POST /api/admin/runs/cancel-active` (or the UI button). Don't try to "fix" the concurrency cap as a workaround.

### Frontend artifact extraction priority

Pull from `HTML_CONTENT`/`CONTENT`/`CSV_CONTENT`/etc. (JSON-encoded var assignments) FIRST; the `"""..."""` triple-quoted scan is a legacy fallback that gets confused by f-string templates containing literal `{HTML_CONTENT}` placeholders.

### Render web_research/document outputs as styled HTML pages

These domains produce HTML fragments (no `<html>` wrapper). Detect via tag-prefix regex, wrap in a styled `<html><head><style>FRAGMENT_STYLES</style></head><body>{fragment}</body></html>` before passing to `<iframe srcDoc>`. Plain `<pre>` text dump is unacceptable -- the user explicitly called this out.

### Don't argue with `inline-style` linter warnings

`apps/frontend` is intentionally an inline-style codebase (`const s: Record<string, React.CSSProperties> = { ... }` per file). The linter warns on every `style={...}` -- those warnings are pre-existing and ignored. Don't refactor to CSS files / CSS modules / Tailwind classes. **Confirmed again this session by the user.**

### Both `.env` and Google Cloud Console need `/api` in the callback URL

NestJS global `/api` prefix means the OAuth callback route is `/api/auth/google/callback`. Set BOTH `GOOGLE_CALLBACK_URL` env AND the Authorized redirect URI in Google Cloud Console to include `/api`. "redirect_uri_mismatch" is always this.

### Local `DATABASE_URL` -> Railway PUBLIC URL

Railway gives two URLs in its Postgres Variables tab: internal (`postgres.railway.internal`) and public (`*.proxy.rlwy.net`). Local `.env` `DATABASE_URL` MUST be the public one + `?connection_limit=15&pool_timeout=20&connect_timeout=30` for stability.

---

## 21. Final operating instruction

If you're a new AI picking up this project: **read sections 0, 17, and 19 first.** They tell you how to behave. Then skim the rest as needed. Verify against current code before acting on any specific recommendation here -- this document reflects 2026-05-11 state.

If two parts of the system disagree about a contract -> **shared types win.**

If two parts of this document disagree -> **the user's most recent stated preference wins.** When in doubt, ask one focused question up front before starting work.

Default to action once given a green light. Stay surgical. Don't make up numbers. Probe before wiring. Don't recreate what was just deleted. Restart uvicorn after `pip install`. Leave verification artifacts in place. Generate complete artifacts, not scaffolds.
