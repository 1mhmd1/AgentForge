# AgentForge -- Full Project Hand-Off Document

This file is the single hand-off document for AgentForge. Give it to any new AI/dev so they fully understand the project, the user, decisions made, conventions to follow, corrections already burned-in, and what NOT to do.

Last updated: 2026-05-10 (post MCP integration + test deletion). Owner: Mhmd Salim (rabih@chipatech.com).

---

## 0. Quick-start: if you read nothing else

1. **Project**: AgentForge takes a user prompt -> AI plans + builds + validates a runnable Python agent -> returns it. Monorepo with `apps/ai` (Python, this is the live one), `apps/backend` (NestJS, in development by a friend), `apps/frontend` (React, mostly done, mocked).
2. **Pipeline**: `prompt_optimizer -> planner -> builder -> validator`. Sub-agents inside builder run SEQUENTIALLY (plain for-loop, no parallel, no async).
3. **Code-gen approach**: SafeCodeInjector + `json.dumps`. NO Jinja2, NO f-strings, NO marker replacement.
4. **MCP doc tools**: 3 connectors wired (Microsoft Learn + Context7 + Exa). Off by default behind `AGENTFORGE_MCP_DOCS=1`. Step_1 only. Single file: `apps/ai/src/services/mcp_tools.py`.
5. **User style**: terse, action-biased. When user says "continue" or "ok go" or "do all of them", EXECUTE -- do not ask another question. Surgical patches only. No fabricated metrics. No new abstractions.
6. **Hard rules**: Python source must be ASCII only (no em-dashes, no smart quotes). Never put `"""` inside a `"""` docstring. Always unpack `text, usage = call_llm(...)`. Probe external endpoints before coding against them. Never recreate patterns the user just deleted (especially tests).
7. **Don't commit unless explicitly asked.** User owns commit decisions.

---

## 1. Repo layout (verified 2026-05-10)

```
AgentForge/
  apps/
    ai/                              # Python AI service (FastAPI + LangGraph). LIVE.
      server.py                      # FastAPI + SSE entrypoint. Emits mcp_enabled flag in started event.
      src/
        graph/graph.py               # LangGraph StateGraph wiring
        state/State.py               # AgentForgeState TypedDict + require_state_keys()
        nodes/
          prompt_optimizer.py        # 2026-05-10
          planner.py
          builder.py                 # sequential sub-agents, last-only merge for text domains, MCP fetch before loop
          sub_agent.py               # one LLM call per step. Accepts docs_context kwarg.
          validator.py               # calls services/validator_engine
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
          mcp_tools.py               # NEW 2026-05-10. Microsoft Learn + Context7 + Exa MCP connectors
          validator_engine.py        # state -> syntax -> file -> execution -> audit -> report
          syntax_checker.py          # ast.parse + check_unresolved_markers + check_triviality
          execution_checker.py       # subprocess sandbox (tempdir, clean env, 15s timeout)
          audit_checker.py           # accepts agents_executed as list OR int
          file_checker.py
          validation_report.py      # 0-100 score
        prompts/
          prompt_optimizer_prompt.py
          planner_prompt.py
          sub_agent_prompt.py        # 1-shot example added
        llm/
          llm.py                     # transient-error retry+backoff
          providers/
            groq_provider.py
            gemini_provider.py
            minimax_provider.py
            kimi_provider.py
        generated_agents/            # output dir (run_*.py, gitignored). file_writer auto-creates.
      DIAGNOSTIC_REPORT.md
      OPTIMIZATION_REPORT.md
      VALIDATOR_PRODUCTION_AUDIT_REPORT.md
      AGENTFORGE_COMPLETE_SYSTEM_AUDIT.md
      traces/                        # AGENTFORGE_TRACE=1 writes here
      uploads/.gitkeep
    backend/                         # NestJS (in dev by friend; see apps/ai backend brief)
    frontend/                        # React 18 + Vite + TS, inline-style design system
  packages/
    shared/                          # SOURCE OF TRUTH for cross-language types
  node_modules/.bin/tsc.cmd          # at monorepo root (NOT in apps/frontend)
  .env                               # gitignored. Contains LLM keys + AGENTFORGE_MCP_DOCS=1 + EXA_API_KEY
  .env.example                       # tracked. Placeholders only. NEVER commit real keys here.
  Requirements.txt                   # UTF-8 no-BOM. Includes mcp==1.27.1.
  MEMORY.md                          # this file
```

**Notable removals this session (2026-05-10)**: All test files deleted at user's explicit request. Specifically: `apps/ai/test_comprehensive.py`, `apps/ai/test_builder_audit.py`, `apps/ai/test_prompt_optimizer.py`, `apps/ai/test_validator_adversarial.py`, `apps/ai/test_phase1.py`, and `apps/ai/src/tests/` directory (including `conftest.py` and `mock_builder_outputs.py`). DO NOT recreate these or any test files under different names without confirming.

---

## 2. AI service architecture (the active layer)

### Pipeline (verified end-to-end 2026-05-10)

```
START -> prompt_optimizer -> planner -> builder -> validator -> END
                                          |
                                          +-- MCP doc fetch (one-shot, before sub-agent loop)
                                          +-- sub_agents step_1 receives docs_context
```

Both `graph.py` AND `server.py:stream_pipeline` wire all four nodes. Server.py used to BYPASS the graph (called planner_node + builder_node manually), which made prompt_optimizer + validator unreachable. Fixed AUDIT-3.

### Node responsibilities

- **prompt_optimizer** (`nodes/prompt_optimizer.py`) -- LLM rewrites raw user prompt into structured `optimized_prompt` + `prompt_analysis`. Failures non-fatal (passes raw prompt through to planner). Auto-sets `domain` from optimizer's detected_domain only if not already set.
- **planner** (`nodes/planner.py`) -- LLM produces `spec` + `execution_plan`. Uses `services/llm_parsing.parse_with_recovery()` for robust 3-tier JSON extraction. Required fields: `goal, domain, steps, tools, complexity, agents`. Raises if `goal` AND `steps` both missing after recovery.
- **builder** (`nodes/builder.py`) -- Validates spec, fetches MCP docs once if enabled, runs sub-agents in plain `for` loop (NOT parallel), calls SafeCodeInjector, writes `.py` file. Sets `status="completed"` on success. STOP-on-failure (no retries inside builder).
- **sub_agent** (`nodes/sub_agent.py`) -- One LLM call per step. Accepts `docs_context: str = ""` kwarg. When non-empty, prepends `"Reference docs (from MCP tools, treat as authoritative API/library facts):\n{docs_context}\n\n"` to its prompt. Compresses previous output to last step's summary + truncated code (cap 800 chars). 2 retries + 1 raw-output fallback.
- **validator** (`nodes/validator.py`) -- Calls `services/validator_engine.run_validation`. Runs state -> syntax -> file -> execution(subprocess+timeout=15s) -> audit -> report.

### Output

- File at `apps/ai/src/generated_agents/run_{run_id}.py`
- `file_writer.py` uses `output_dir.mkdir(parents=True, exist_ok=True)` so the dir auto-recreates if deleted.
- `run_id` format: `ui_<8hex>` (e.g. `ui_4e33546b`).

### Output merge strategy (decided 2026-05-09)

In `_build_safe_agent()` in builder.py:
- `website_builder`, `document`, `web_research`: **LAST sub-agent output only** (chained pipeline; concat duplicates content)
- `data_transform`: **ALL steps concatenated** (additive pipeline)

### Key architectural facts (verified, do not "improve" without asking)

- **Sequential sub-agents**: plain `for` loop in `builder.py`. NOT parallel. NO async. NO threading.
- **`asyncio.run()` is allowed inside individual sync functions** (the no-async rule is about pipeline architecture, not banning event loops in helpers). MCP code uses isolated `asyncio.run()` per call.
- **SafeCodeInjector** (`services/safe_injector.py`) replaced the old Jinja2 templates. AGENT_TEMPLATE is a hardcoded Python string constant. Per-domain skeletons in `build_website_agent`, `build_research_agent`, `build_document_agent`, `build_data_agent`.
- **All content serialized via `json.dumps`** (`services/code_serializer.py`) -- no marker replacement. Eliminates triple-quote-collision bugs by construction.
- **call_llm signature**: `tuple[str, dict[str, Any]]`. Usage dict: `{prompt_tokens, completion_tokens, total_tokens, provider}`. ALWAYS unpack both: `text, usage = call_llm(...)`.
- **State**: `AgentForgeState` TypedDict in `state/State.py`. Compile-time only -- runtime checks via `require_state_keys(state, keys, where)` helper added 2026-05-10.

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
| `llm_parsing.py` | `parse_with_recovery()` -- strip_invisible -> clean_response (markdown fences) -> extract_json (first { to last }, fix trailing commas) -> extract_fields_fallback (regex). Used by planner. |
| `observability.py` | `log_event(event, **fields)` -- JSON-to-stderr structured logging. `AGENTFORGE_PLAIN_LOGS=1` for human format. |
| `tracer.py` | Per-run JSONL traces. Off by default. `AGENTFORGE_TRACE=1` writes to `apps/ai/traces/{run_id}.jsonl`. Auto-truncates large values. |
| `mcp_tools.py` | **NEW 2026-05-10.** MCP connectors: Microsoft Learn + Context7 + Exa. `is_enabled()`, `fetch_docs_context(domain, goal, max_chars=1500)`. Off by default behind `AGENTFORGE_MCP_DOCS=1`. |
| `validator_engine.py` | Orchestrates validator pipeline. Uses log_event for stage logs. |
| `syntax_checker.py` | `ast.parse` + `check_unresolved_markers` + `check_triviality`. |
| `execution_checker.py` | Subprocess in tempdir with timeout=15s + `_build_clean_env()` strips PYTHONPATH, keeps PATH + Windows system vars. |
| `audit_checker.py` | Validates `run_audit` shape. Accepts `agents_executed` as INT or LIST. |
| `file_checker.py` | exists + readable + non-empty + extension allowed. |
| `validation_report.py` | Aggregates checker results. Score = 100 - (50 syntax + 30 exec + 10 file + 10 audit). Adds `TRIVIAL_OUTPUT` warning when triviality detected. |

---

## 4. LLM providers

Configured via `LLM_PROVIDER` env, default `groq`. All return `(text, usage)`:

| Provider | Model | Notes |
|---|---|---|
| groq | `llama-3.1-8b-instant` | PRIMARY. temperature=0. structured JSON. |
| gemini | (free tier) | Fallback. Returns zero usage. |
| minimax | (REST) | Fallback. |
| kimi | (REST) | Fallback. |

`call_llm()` retries transient HTTP errors (429, 5xx, timeout, conn-reset) with exponential backoff. Configurable via `LLM_MAX_RETRIES` (default 3) and `LLM_RETRY_BASE_DELAY` (default 1.0s). Retry detection is provider-agnostic string matching against `_TRANSIENT_MARKERS`.

**Phase 18 verdict (still standing)**: Do NOT upgrade the model until engineering wins are exhausted. Quality issues at this stage are pipeline/prompt issues, not model issues.

---

## 5. SSE event contract (server.py /run)

| Event | Key fields |
|---|---|
| `started` | `run_id` (`ui_<8hex>`), `prompt`, `mcp_enabled` (bool, NEW 2026-05-10) |
| `stage` PROMPT_OPTIMIZER | `status`, `optimized_prompt`, `detected_domain`, `complexity`, `detected_requirements`, `duration` |
| `stage` PLANNER | `status`, `duration`, `spec`, `execution_plan` |
| `spec` | echo of spec for convenience |
| `stage` (x8 builder phases) | Spec Validation, Execution Planning, Template Loading, Template Rendering, Code Injection, Quality Validation, Syntax Validation, File Writing |
| `stage` VALIDATOR | `status`, `validation_status`, `validation_score`, `errors`, `warnings`, `duration` |
| `success` | `build_duration`, `output_path`, `code`, `domain`, `quality_score`, `run_audit`, `validation_status`, `validation_score`, `validation_report`, `sub_agent_results`, `sub_agent_summary` |
| `failed` | `final_error`, `error_stage`, `details`, `build_duration?`, `run_audit?` |

`ui.html` handles unknown stages with default icon (line 527), so adding new stage names doesn't break the UI. When `started.mcp_enabled === true`, status text shows " · docs MCP" suffix.

---

## 6. Token audit shape

```python
{
  "total_tokens": int,
  "prompt_tokens": int,
  "completion_tokens": int,
  "agents_executed": list[str],     # ["step_1", "step_2"] -- LIST, not int
  "provider_usage": {"groq": int},
  "per_agent_tokens": {agent_id: {prompt_tokens, completion_tokens, total_tokens, provider}},
  "failed_step": str | None,
}
```

`per_agent_tokens["planner"]` is also folded in. `agents_executed: list[str]` is the post-BUG-E format; `audit_checker.py` was updated 2026-05-10 to accept both int (legacy) and list (current).

---

## 7. Validation report shape

```python
{
  "validation_status": "passed" | "failed",
  "syntax_valid": bool,
  "file_valid": bool,
  "execution_valid": bool,
  "audit_valid": bool,
  "score": int,                    # 0-100
  "errors": list[str],             # prefixed "CRITICAL:" or "AUDIT:"
  "warnings": list[str],           # may include "TRIVIAL_OUTPUT: ..."
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
| `LLM_PROVIDER` | `groq` | Default provider |
| `LLM_MAX_RETRIES` | `3` | Total attempts on transient errors |
| `LLM_RETRY_BASE_DELAY` | `1.0` | Seconds; doubled per attempt |
| `AGENTFORGE_TRACE` | `0` | When `1`, writes per-run JSONL traces |
| `AGENTFORGE_PLAIN_LOGS` | `0` | When `1`, observability uses human format |
| `AGENTFORGE_MCP_DOCS` | `0` | **NEW 2026-05-10.** When `1`, builder fetches MCP doc context for step_1 |
| `EXA_API_KEY` | (unset) | **NEW 2026-05-10.** When set, enables Exa web search MCP for `web_research` domain |
| `GROQ_API_KEY`, `GEMINI_API_KEY`, `MINIMAX_API_KEY`, `KIMI_API_KEY` | -- | Per-provider credentials |

`.env` is gitignored (contains real keys). `.env.example` is tracked (placeholders only, never real values).

---

## 10. Tests (DELETED 2026-05-10)

**All test files were deleted at the user's explicit request: "DELETE ALL THE TESTED FILES BUT ALSO WITHOUT AFFECTING THE PROJECT".**

Removed: `test_comprehensive.py`, `test_builder_audit.py`, `test_prompt_optimizer.py`, `test_validator_adversarial.py`, `test_phase1.py`, and the entire `apps/ai/src/tests/` directory.

**Hard rule**: do NOT recreate test files under any name (`test_*.py`, `*_spec.py`, `_probe.py` for repeated runs, etc.) without explicit user confirmation. If a brief asks for new tests, surface the conflict before acting. See section 17.16.

If verification is needed, run a one-shot probe script at the repo root with a `_` prefix (e.g. `_probe.py`), READ the output, and DELETE the script and any artifacts before finishing. See section 17.15.

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
- **Per-source budget**: total `max_chars` is split equally across MCPs that returned content (`max_chars // n_sources`, floor 200). MS Learn routinely returns 20k+ chars; without per-source budget it would drown out Context7 + Exa under simple total-cap truncation.
- **Cache**: 5-minute process-local TTL dict keyed on `(domain, goal)`. Both successful AND empty fetches are cached so a flaky day doesn't get retried per-build. Cleared on process restart.
- **Timeouts**: 12s per MCP call. No total timeout (each call is independently bounded). On any failure, `fetch_docs_context()` returns `""` and the build proceeds normally.
- **SSE event**: `mcp_enabled: bool` on the `started` event. UI shows " · docs MCP" suffix when on.
- **Sync architecture preserved**: `asyncio.run()` is wrapped inside `fetch_docs_context()`. Builder loop is still a plain for-loop.

### Design choices that go beyond the code

- **Library detection is keyword-substring match, not LLM extraction.** Adding an LLM call to extract a library name would cost a round-trip per build. `_LIB_HINTS` lives in `mcp_tools.py` -- keep it conservative; false positives fire a slow Context7 lookup for nothing.
- **Step_1 only, not per-step.** Per-step injection would multiply MCP latency by the step count. Step_1 sees the docs; subsequent steps see the resulting code, which already reflects the docs.
- **No quality bonus in validator.** A brief proposed +2 points per MCP call; rejected as fabricated metric (rule 17.2). Validation score reflects actual code correctness, not tool-use ceremony.
- **No AGENT_TEMPLATE injection.** Generated agent files don't carry an MCP runtime. MCP is a build-time tool, not a runtime dependency of the generated artifact.
- **No observability MCPs (Slack/Linear/Figma/Supabase).** Different concern from doc quality; re-evaluate on its own merits if/when needed.
- **Goodnotes was rejected.** Brief described it as "diagram generator"; probe revealed it's a *renderer* (takes raw mermaidCode/svgCode as input). Different use-case from "improve doc quality of the build".

### Endpoint quirks worth remembering

- Context7 `resolve-library-id` requires BOTH `libraryName` AND `query` arguments (the brief showed only one).
- Context7 `query-docs` requires `libraryId` (the `/org/project` form returned by resolve), not the bare library name.
- MS Learn search returns 15k-25k chars routinely. Without per-source budget it floods the output cap.
- First MCP call after process start needs ~10-12s due to TLS warmup. Warm calls are 3-7s.
- The `mcp` SDK's streamable-HTTP transport prints "Error parsing SSE message" + ClosedResourceError to stderr during cleanup. Non-fatal SDK noise -- result is already returned.
- All three endpoints have transient empty responses on bad days; graceful degradation is critical.

### Verified behavior (2026-05-10)

End-to-end probe with all three MCPs active across all four domains: each MCP returned real content (MS Learn ~21k chars raw, Context7 ~1.6k, Exa ~8k), per-source budget produced ~1500-char balanced output mixing all sources, full pipeline completed `validation_status=passed score=100`. Cache hit on repeat call: sub-millisecond.

### Dependencies

- `mcp==1.27.1` in `Requirements.txt` (file is now UTF-8 no-BOM since 2026-05-10).
- Uses `mcp.client.streamable_http.streamablehttp_client` for all three endpoints.

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

- **MCP-1**: Wired Microsoft Learn + Context7 + Exa as a single-file connector. Off by default. Step_1 only.
- **MCP-2**: Initial brief had wrong API surfaces (REST vs MCP/JSON-RPC) -- diagnosed before coding, used surgical Phase 1 instead.
- **MCP-3**: Brief proposed validator quality bonus (+2 per MCP call) -- rejected as fabricated metric.
- **MCP-4**: Brief asked for `test_mcp_tools.py` -- skipped because user just deleted all tests.
- **MCP-5**: Brief showed wrong server.py shapes (async stream_pipeline) -- used real shapes (sync generator).
- **MCP-6**: Cold MCP call timed out at 14s -> bumped, then removed total timeout entirely.
- **MCP-7**: `asyncio.gather` caused all MCPs to return empty (SDK SSE cleanup race) -> reverted to sequential, then refactored each MCP to its own `asyncio.run()` via `_run_one()` helper.
- **MCP-8**: MS Learn flooded the 1500-char budget, truncating Context7 + Exa -> implemented per-source budget allocation.
- **MCP-9**: Context7 schema confusion -- probe revealed it requires BOTH `libraryName` AND `query` for resolve-library-id; brief showed only one.
- **MCP-10**: Goodnotes misclassified in the brief as a generator -- probe showed it's a renderer; asked user before wiring; user chose to skip.
- **MCP-11**: Real `EXA_API_KEY` ended up in `.env.example` (git-tracked) -- flagged, moved to `.env` (gitignored), blanked `.env.example`.
- **MCP-12**: `Requirements.txt` was UTF-16 LE (PowerShell `pip freeze` artifact) -> re-encoded UTF-8 no-BOM via `[System.IO.File]::WriteAllText`.
- **MCP-13**: JS `TypeError: Cannot read properties of null (reading 'value')` at ui.html:1194 -> `<select title="domain-select">` should be `id="domain-select"`. Fixed.

### Deferred (still open)

- Conditional graph edges (#14)
- Domain plugin system (#16)
- LLM cache for dev (#20)
- AGENT_TEMPLATE format extraction (#22)
- Sanitizer indent normalization (#23)
- Domain skeleton parameterization (#24)
- Observability MCPs (Slack/Linear/Figma/Supabase) -- different concern from doc quality

---

## 13. Cleanup state (2026-05-10)

Deleted in cleanup passes across sessions:
- 6 broken test files from earlier sessions (test_phase3/4/5, test_quality, debug_builder, debug_pipeline, debug_step)
- 2 dead prompt files (`website_builder_prompt`, `builder_prompt`)
- All `__pycache__/` dirs (in `.gitignore`)
- All `generated_agents/run_*.py` artifacts (in `.gitignore`; `file_writer.py` auto-recreates the dir)
- `uploads/zip_sums.csv` and `uploads/monthly_sales (1).csv` stray data
- ~174 leaked tempdirs from earlier adversarial test runs

**This-session deletions (2026-05-10)**:
- ALL test files (`apps/ai/test_*.py` + `apps/ai/src/tests/`) -- per user request "DELETE ALL THE TESTED FILES"
- One-shot MCP probe scripts (`_probe*.py`, `_trace_run.py`) deleted before final summary
- `EXA_API_KEY` value relocated from tracked `.env.example` to gitignored `.env`; example blanked

`.gitignore` covers: `__pycache__/`, `*.pyc`, `apps/ai/src/generated_agents/run_*.py`, `apps/ai/uploads/*` (with `.gitkeep` exception), `.env`. The `!.env.example` exception in `.gitignore` makes `.env.example` explicitly trackable -- so anything written there is published. NEVER write real keys to `.env.example`.

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

### Backend integration points (when backend goes live)

- `RunExecution.tsx`:
  - `planSubAgents()` -> real Builder output
  - `MOCK_LOGS` streamer -> SSE/WebSocket from server.py /run
  - `stageStates` driver -> live status from backend
- `Home.tsx`:
  - `MOCK_AGENTS` -> list endpoint
  - `handleRun` timeout -> POST a run
- `Runs.tsx`: `MOCK_RUNS` -> list endpoint with pagination
- `data/mockData.ts`: delete when backend is live

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

The user's friend is implementing the NestJS backend. The user previously asked for a hand-off prompt; that was authored in chat (no file written). It included accurate AI service contract details: SSE event names, payload shapes, run_id format, validation_status semantics, etc.

When backend is live, it will:
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
- **Environment**: Windows 11, Python 3.11.9, PowerShell default shell (bash also available via Git/WSL)

### Communication style

- Informal English with consistent typos (plzz, u, nb, fous, validater, hiddin, donot, prefernces). Don't correct them.
- Prefers numbered lists when requesting multiple tasks ("1- update the .env  2- test that all mcp are working").
- Describes by visuals/intent, not pixels ("the sub-agent fan looks off", "make it both", "the one that i really need")
- "live" = dynamic/cinematic, not literal real-time
- Often hands MASSIVE prescriptive prompts (audit specs with 17 phases, NestJS backend specs, MCP integration briefs with 8 connectors). Read carefully but don't take every claim at face value -- some refer to code that doesn't exist, use outdated diagrams, or have wrong API shapes. Diagnose first.

### Working preferences

- **Bias to action when given a green light.** "continue", "ok go", "make it both", "do all of them" mean EXECUTE -- not "ask me again".
- **Surgical patches.** No refactors. No new abstractions. No backwards-compat shims around dead code.
- **No fabricated metrics.** Cite real evidence (file:line, observed test results). Severity buckets and counts are fine because they're real.
- **Diagnose before coding.** Many briefs are written against an older codebase or have wrong API shapes. Read the relevant source FIRST, then propose.
- **No tests created without permission.** User deleted all tests 2026-05-10; do not recreate them or any test-shaped file under different names.
- **Verifies in browser** (`localhost:5173`).
- **Never `git commit` unless asked.** User owns commit decisions.
- **When asked to "write a prompt for my friend"**, deliverable is just the prompt text -- no code execution, no extra tool calls.
- **Architecture preservation matters.** Don't propose async/threading/multiprocessing in the AI service. Don't add LangGraph wiring that changes existing behavior. The no-async rule is about the pipeline, not banning event loops inside isolated sync functions.

---

## 17. HARD RULES (do not violate)

These are corrections the user has explicitly given; each comes from a real failure or strong preference. The auto-memory system has individual files for each rule -- the per-file copies in `~/.claude/projects/.../memory/` are authoritative; this list is the consolidated reference.

### 17.1 "Continue" / "ok go" / "make it both" means EXECUTE

When the user replies "continue", "ok go", "do all of them", "make it both", or hands a prescriptive task spec -- EXECUTE. Do not ask another decision question. Asking again is friction.

- Decision-gate rule applies to the START of an open-ended task -- not to every batch within it.
- ASK up front (max 1 question) when: codebase doesn't match the task's premise; multiple sensible architectural paths exist; the work would touch shared resources.
- DON'T ask "Do you want me to also do X?" when X was already in the user's task list.

### 17.2 No fabricated metrics in audit reports

Never invent percentages ("+300% quality", "+370% code richness"), multipliers, or measurements you didn't measure. The user explicitly values intellectual honesty over impressive-sounding numbers.

- Cite real file paths and line numbers (e.g. `server.py:13`)
- Mark estimates explicitly: "directional, not measured"
- Use real test results: "32/32 tests pass" beats "test coverage: high"
- Counts (errors found: 64) and severity buckets (Critical: 4 / High: 15) are FINE because they're real.
- A 6,500-word audit grounded in evidence beats a 25,000-word audit padded with fake numbers.

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
- Verify dead code has no live caller (grep for imports), then delete -- no stub replacements

### 17.5 Python source: ASCII only

NEVER use em-dashes, en-dashes, smart quotes, curly quotes, or any non-ASCII punctuation in Python source files (comments, docstrings, string literals -- everywhere).

- Windows Python 3.11.9 rejects non-ASCII even inside comments. Error: `SyntaxError: invalid character 'U+2014'`.
- Use `--` for em-dash, `-` for en-dash, straight quotes only, `*` or ALL-CAPS for emphasis.
- Sweep all `.py` files when adding prompt content.

### 17.6 Triple-quote docstring rule

Never put `"""` inside a `"""..."""` docstring -- use `#` line comments instead.

- Writing `"""` inside a docstring terminates the string prematurely.
- Pattern: `# Why json.dumps and not a triple-quoted wrapper: ...`

### 17.7 call_llm returns a tuple

Always unpack: `text, usage = call_llm(...)`. Never assign to a single variable.

- Usage dict shape: `{prompt_tokens: int, completion_tokens: int, total_tokens: int, provider: str}`
- When writing test stubs for call_llm, return `(json_string, usage_dict)` -- never just the string

### 17.8 Architecture preservation (will reject)

The user will reject:
- Async / threading / multiprocessing as a pipeline pattern (event loops inside individual sync functions are FINE -- e.g. `asyncio.run()` inside `fetch_docs_context()`)
- New frameworks, DBs, queues, DI containers
- Shape changes to `AgentForgeState` TypedDict (additive runtime keys are OK)
- LangGraph wiring changes that break existing test stubs
- New stage constants without a clear reason

### 17.9 Merge conflict resolution

Read both sides carefully. Keep HEAD if HEAD contains a recent fix the user is currently working on; do not blindly accept theirs.

- 2026-05-10 example: builder.py merge -- HEAD had BUG-E fix (`agents_executed: list`, real per-step `usage` dict); other branch had old `agents_executed: int`, `max_tokens` summing. Kept HEAD; reverting would have re-broken the audit.
- Cite which side you kept and why. Don't `git commit` after resolution unless asked.

### 17.10 PowerShell vs bash PYTHONPATH separator

PowerShell uses semicolon `;`, bash uses colon `:`. On Windows, ALWAYS use semicolon regardless of shell -- Python on Windows expects Windows-style separator.

- Better: use `conftest.py` with `sys.path.insert(0, ...)`.

### 17.11 Documentation policy

No unsolicited docs (no `README.md`, `CHANGELOG.md`, etc.).

EXCEPTION: when the user explicitly asks for an audit/report/spec (DIAGNOSTIC_REPORT, OPTIMIZATION_REPORT, VALIDATOR_PRODUCTION_AUDIT_REPORT, AGENTFORGE_COMPLETE_SYSTEM_AUDIT) -- those are deliverables and should be substantial.

### 17.12 Probe external endpoints before wiring (NEW 2026-05-10)

For any third-party API/MCP integration, run a one-shot probe that hits the real endpoint, lists capabilities, and verifies argument schemas BEFORE writing the connector code. Cost: ~1 minute. Saves: hours of debugging when the brief is wrong.

- 2026-05-10 catches via probe: Context7 requires BOTH `libraryName` AND `query` (brief showed one); Context7 returns IDs that need a SECOND call to `query-docs`; Context7 is authless not paid; Goodnotes is a renderer not generator; Exa wants `query`+`numResults` (brief had wrong shapes).
- Probe template (sync via asyncio.run):
  ```python
  async def probe(url, args=None):
      async with streamablehttp_client(url) as (r, w, _):
          async with ClientSession(r, w) as s:
              await s.initialize()
              tools = await s.list_tools()
              for t in tools.tools:
                  print(t.name, t.inputSchema)
              if args:
                  result = await s.call_tool(args["tool"], args["params"])
                  print(result.content[0].text[:500])
  ```
- Save probe at repo root with `_` prefix, run it once, READ the schemas (`inputSchema` is authoritative; description text is not), then DELETE.
- Cross-check against the brief: if the brief shows different arg names, the brief is wrong. Code against the schema.

### 17.13 Probe cleanup -- delete BEFORE wrapping up (NEW 2026-05-10)

When you write a one-shot script to verify behavior (live MCP probe, pipeline trace, cache test), delete BOTH the script AND any artifacts it generated, BEFORE writing the final summary.

- Probe scripts go at repo root or tmp paths, never inside `apps/ai/src/`. Naming: `_probe.py` / `_trace_run.py` / underscore-prefixed.
- Always verify cleanup at the end: `rm -f _*.py` and `rm -rf apps/ai/src/generated_agents` (file_writer.py auto-recreates).
- Confirm via `git status --short` -- the only `??` (untracked) entries should be actual deliverables.
- Do this BEFORE the summary, not after -- if the summary calls out clean state, the cleanup must already have happened.

### 17.14 Don't recreate patterns the user just deleted (NEW 2026-05-10)

If the user explicitly removed a category of files or pattern in the current session (or a recent one), DO NOT silently reintroduce it -- even if a brief asks for it under a different name. Stop and ask.

- 2026-05-10: user said "DELETE ALL THE TESTED FILES" and we removed 11 test files. One turn later, an MCP brief asked to create `apps/ai/test_mcp_tools.py`. Skipping that was correct; user thanked the catch.
- Track in working memory the file/category-level deletions the user has performed THIS session.
- Before creating any file, check whether it's part of a category (tests/, docs/, abstractions/) just removed.
- The right response: "You said DELETE ALL TESTED FILES. The brief asks for test_mcp_tools.py -- this directly reverses that decision. Want me to do it anyway, or skip?"
- Extends to abstractions/patterns historically rejected (async, threading, plugin registries, helper classes for hypothetical future callers).

### 17.15 Proactive security flag for real-looking secrets in tracked files (NEW 2026-05-10)

If you observe what looks like a real API key, token, or password in a file that is git-tracked (`.env.example`, READMEs, docs, source code), flag it explicitly. Do not silently fix; do not ignore.

- 2026-05-10: user pasted `EXA_API_KEY=836c8007-...` into `.env.example` (which IS tracked because of `!.env.example` exception). Even if intentional, real keys belong in `.env`. I flagged; user accepted; key moved to `.env`, example blanked.
- Verify whether a file is git-tracked: `git ls-files --error-unmatch <path>`
- In your reply: (1) name what's exposed, (2) cite file:line, (3) explain why it matters (file is tracked; key may be in remote/history), (4) offer concrete fix (move to gitignored `.env`, blank example, rotate).
- Placeholders (`your_key_here`, `xxxxx`, `<KEY>`) are fine -- don't bother user.
- "Looks real": UUIDs, `xoxb-...`, `gsk_...`, `sk_live_...`, `lin_api_...`, `exa_...`, base64-looking blobs > 20 chars.
- DO NOT echo the secret back. Reference its location only.
- "User is already aware" reminder applies to the EDIT, not to the SECURITY implication of where they put the value.

### 17.16 Brief inspection checklist (NEW 2026-05-10)

When given a prescriptive multi-step task spec, verify these 8 things before executing:

1. **Does the codebase match the brief's premise?** If brief says "X is broken", check current state. If already fixed, say so and redirect.
2. **Are the API shapes correct?** Sync vs async, signatures, return types. Briefs frequently show wrong shapes.
3. **Are the arg names/schemas correct?** Probe external endpoints (rule 17.12).
4. **Are there fabricated metrics?** Refuse to act on percentages, multipliers, or "ROI" numbers (rule 17.2).
5. **Does any task ask for a category the user just removed?** Tests, abstractions, registries, etc. (rule 17.14).
6. **Does any task introduce architecture the user has rejected?** Async pipeline, threading, plugin systems (rule 17.8).
7. **Are there real-looking secrets in tracked files?** Flag proactively (rule 17.15).
8. **Are there shadow asks** ("also create unit tests", "also write README") that aren't actually justified by the explicit goal? Surface them; default to skipping.

Surface skipped tasks in your reply with the reason, then execute the rest.

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
- No model upgrade beyond `llama-3.1-8b-instant` until engineering wins are exhausted (Phase 18 verdict)

Reason throughout: premature complexity.

---

## 20. Memory system pointers

The user has a parallel auto-memory system at `~/.claude/projects/c--Users-1mhmd-OneDrive-Desktop-Ai-Projects-AgentForge/memory/` with discrete files per rule. Index lives in `MEMORY.md` inside that directory and is auto-loaded each session. Authoritative individual feedback files (as of 2026-05-10):

- `user_work_style.md`
- `feedback_continue_means_execute.md`
- `feedback_no_fabricated_metrics.md`
- `feedback_diagnosis_first.md`
- `feedback_surgical_patches.md`
- `feedback_python_source_rules.md`
- `feedback_triple_quote_docstrings.md`
- `feedback_call_llm_signature.md`
- `feedback_merge_conflict_resolution.md`
- `feedback_powershell_pythonpath.md`
- `feedback_brief_inspection_checklist.md` (NEW 2026-05-10)
- `feedback_dont_recreate_deleted_patterns.md` (NEW 2026-05-10)
- `feedback_probe_endpoints_before_wiring.md` (NEW 2026-05-10)
- `feedback_probe_cleanup.md` (NEW 2026-05-10)
- `feedback_proactive_security_flag.md` (NEW 2026-05-10)
- `project_agentforge.md` (architecture snapshot)
- `project_mcp_integration.md` (NEW 2026-05-10)
- `reference_audit_reports.md`

This root-level `MEMORY.md` is the consolidated hand-off. If you (a future AI) are running with the auto-memory system loaded, prefer the per-rule files for canonical content. If not, this single document covers everything.

---

## 21. Final operating instruction

If you're a new AI picking up this project: **read sections 0, 17, and 19 first.** They tell you how to behave. Then skim the rest as needed. Verify against current code before acting on any specific recommendation here -- this document reflects 2026-05-10 state.

If two parts of the system disagree about a contract -> **shared types win.**

If two parts of this document disagree -> **the user's most recent stated preference wins.** When in doubt, ask one focused question up front before starting work.

Default to action once given a green light. Stay surgical. Don't make up numbers. Probe before wiring. Don't recreate what was just deleted.
