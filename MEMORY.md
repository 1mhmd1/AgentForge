# AgentForge -- Full Project Hand-Off Document

This file is the single hand-off document for AgentForge. Give it to any new AI/dev so they fully understand the project, the user, decisions made, conventions to follow, corrections already burned-in, and what NOT to do.

Last updated: 2026-05-10. Owner: Mhmd Salim (rabih@chipatech.com).

---

## 0. Quick-start: if you read nothing else

1. **Project**: AgentForge takes a user prompt -> AI plans + builds + validates a runnable Python agent -> returns it. Monorepo with `apps/ai` (Python, this is the live one), `apps/backend` (NestJS, in development by a friend), `apps/frontend` (React, mostly done, mocked).
2. **Pipeline**: `prompt_optimizer -> planner -> builder -> validator`. Sub-agents inside builder run SEQUENTIALLY (plain for-loop, no parallel, no async).
3. **Code-gen approach**: SafeCodeInjector + `json.dumps`. NO Jinja2, NO f-strings, NO marker replacement.
4. **User style**: terse, action-biased. When user says "continue" or "ok go" or "do all of them", EXECUTE -- do not ask another question. Surgical patches only. No fabricated metrics. No new abstractions.
5. **Hard rules**: Python source must be ASCII only (no em-dashes, no smart quotes). Never put `"""` inside a `"""` docstring. Always unpack `text, usage = call_llm(...)`.
6. **Don't commit unless explicitly asked.** User owns commit decisions.

---

## 1. Repo layout (verified)

```
AgentForge/
  apps/
    ai/                              # Python AI service (FastAPI + LangGraph). LIVE.
      server.py                      # FastAPI + SSE entrypoint
      src/
        graph/graph.py               # LangGraph StateGraph wiring
        state/State.py               # AgentForgeState TypedDict + require_state_keys()
        nodes/
          prompt_optimizer.py        # NEW 2026-05-10
          planner.py
          builder.py                 # sequential sub-agents, last-only merge for text domains
          sub_agent.py               # one LLM call per step
          validator.py               # calls services/validator_engine
        services/
          safe_injector.py           # 4 hardcoded domain skeletons
          code_serializer.py         # json.dumps wrappers
          code_sanitizer.py
          file_writer.py
          errors.py                  # SUPPORTED_DOMAINS + ERROR_CODES
          snippet_validator.py       # score_quality()
          llm_parsing.py             # NEW 2026-05-10. parse_with_recovery()
          observability.py           # NEW 2026-05-10. log_event()
          tracer.py                  # NEW 2026-05-10. JSONL traces
          validator_engine.py        # state -> syntax -> file -> execution -> audit -> report
          syntax_checker.py          # ast.parse + check_unresolved_markers + check_triviality
          execution_checker.py       # subprocess sandbox (tempdir, clean env, 15s timeout)
          audit_checker.py           # accepts agents_executed as list OR int
          file_checker.py
          validation_report.py       # 0-100 score
        prompts/
          prompt_optimizer_prompt.py # NEW
          planner_prompt.py
          sub_agent_prompt.py        # 1-shot example added
        llm/
          llm.py                     # transient-error retry+backoff
          providers/
            groq_provider.py
            gemini_provider.py
            minimax_provider.py
            kimi_provider.py
        generated_agents/            # output dir (run_*.py, gitignored)
        tests/                       # pytest validator units + conftest.py
      test_comprehensive.py          # 9-case pipeline e2e (stubbed LLM)
      test_builder_audit.py          # 6-case builder audit
      test_prompt_optimizer.py       # 12-case optimizer
      test_validator_adversarial.py  # 19 adversarial probes
      test_phase1.py                 # manual smoke (real API)
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
  MEMORY.md                          # this file
```

---

## 2. AI service architecture (the active layer)

### Pipeline (verified end-to-end 2026-05-10)

```
START -> prompt_optimizer -> planner -> builder -> validator -> END
```

Both `graph.py` AND `server.py:stream_pipeline` wire all four nodes. Server.py used to BYPASS the graph (called planner_node + builder_node manually), which made prompt_optimizer + validator unreachable. Fixed AUDIT-3.

### Node responsibilities

- **prompt_optimizer** (`nodes/prompt_optimizer.py`) -- LLM rewrites raw user prompt into structured `optimized_prompt` + `prompt_analysis`. Failures non-fatal (passes raw prompt through to planner). Auto-sets `domain` from optimizer's detected_domain only if not already set.
- **planner** (`nodes/planner.py`) -- LLM produces `spec` + `execution_plan`. Uses `services/llm_parsing.parse_with_recovery()` for robust 3-tier JSON extraction. Required fields: `goal, domain, steps, tools, complexity, agents`. Raises if `goal` AND `steps` both missing after recovery.
- **builder** (`nodes/builder.py`) -- Validates spec, runs sub-agents in plain `for` loop (NOT parallel), calls SafeCodeInjector, writes `.py` file. Sets `status="completed"` on success. STOP-on-failure (no retries inside builder).
- **sub_agent** (`nodes/sub_agent.py`) -- One LLM call per step. Compresses previous output to last step's summary + truncated code (cap 800 chars). 2 retries + 1 raw-output fallback.
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
| `tracer.py` | Per-run JSONL traces. Off by default. `AGENTFORGE_TRACE=1` writes to `apps/ai/traces/{run_id}.jsonl`. Auto-truncates large values. `record_event()` and `trace_node()` context manager. |
| `validator_engine.py` | Orchestrates validator pipeline. Uses log_event for stage logs. |
| `syntax_checker.py` | `ast.parse` + `check_unresolved_markers` (catches BUILDER_INJECT, `{{ }}`, NotImplementedError) + `check_triviality` (imports-only, all-pass; conservative WARNING not failure). |
| `execution_checker.py` | Subprocess in tempdir with timeout=15s + `_build_clean_env()` strips PYTHONPATH, keeps PATH + Windows system vars (SYSTEMROOT, etc.). |
| `audit_checker.py` | Validates `run_audit` shape. Accepts `agents_executed` as INT or LIST (the AUDIT-1 contract bug fix). |
| `file_checker.py` | exists + readable + non-empty (size>0) + extension allowed. |
| `validation_report.py` | Aggregates checker results. Score = 100 - (50 syntax + 30 exec + 10 file + 10 audit). Adds `TRIVIAL_OUTPUT` warning when triviality detected (does NOT fail validation). |

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

---

## 5. SSE event contract (server.py /run)

| Event | Key fields |
|---|---|
| `started` | `run_id` (`ui_<8hex>`), `prompt` |
| `stage` PROMPT_OPTIMIZER | `status`, `optimized_prompt`, `detected_domain`, `complexity`, `detected_requirements`, `duration` |
| `stage` PLANNER | `status`, `duration`, `spec`, `execution_plan` |
| `spec` | echo of spec for convenience |
| `stage` (x8 builder phases) | Spec Validation, Execution Planning, Template Loading, Template Rendering, Code Injection, Quality Validation, Syntax Validation, File Writing |
| `stage` VALIDATOR | `status`, `validation_status`, `validation_score`, `errors`, `warnings`, `duration` |
| `success` | `build_duration`, `output_path`, `code`, `domain`, `quality_score`, `run_audit`, `validation_status`, `validation_score`, `validation_report`, `sub_agent_results`, `sub_agent_summary` |
| `failed` | `final_error`, `error_stage`, `details`, `build_duration?`, `run_audit?` |

`ui.html` handles unknown stages with default icon (line 527), so adding new stage names doesn't break the UI.

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
| `GROQ_API_KEY`, `GEMINI_API_KEY`, `MINIMAX_API_KEY`, `KIMI_API_KEY` | -- | Per-provider credentials |

---

## 10. Test inventory (post-2026-05-10)

| Suite | Path | Cases | Method | Run command |
|---|---|---|---|---|
| Pipeline e2e (stubbed LLM) | `apps/ai/test_comprehensive.py` | 9 | `planner_module.call_llm` + `sub_agent_module.call_llm` monkey-patched | `python apps/ai/test_comprehensive.py` |
| Builder audit | `apps/ai/test_builder_audit.py` | 6 | `builder_module.execute_sub_agent` monkey-patched (8-kwarg keyword-only signature) | `python apps/ai/test_builder_audit.py` |
| Prompt optimizer | `apps/ai/test_prompt_optimizer.py` | 12 | `optimizer_module.call_llm` + `planner_module.call_llm` monkey-patched | `python apps/ai/test_prompt_optimizer.py` |
| Validator units | `apps/ai/src/tests/test_*.py` (5 files) | 5 | uses `mock_builder_outputs.py`; `conftest.py` adds `apps/ai/src` to sys.path | `pytest apps/ai/src/tests/` |
| Validator adversarial | `apps/ai/test_validator_adversarial.py` | 19 probes | hand-crafted bad inputs, no LLM, writes to `$env:TEMP\adv_validator_*` | `python apps/ai/test_validator_adversarial.py` |
| Manual E2E (live LLM) | `apps/ai/test_phase1.py` | 1 | needs real `GROQ_API_KEY` etc. | `python apps/ai/test_phase1.py` (NOT in CI) |

**Status: 32/32 automated cases pass + 14 OK / 3 deferred-FAIL / 0 CRASH on adversarial probes.**

### Stub conventions (already-burned guidance)

- Stub `planner_module.call_llm` (NOT `nodes.planner.call_llm`) -- the import-time binding matters
- Stub `sub_agent_module.call_llm` (same reason)
- For builder tests, stub `builder_module.execute_sub_agent` with the EXACT 8-kwarg signature: `step_id, step_data, total_steps, previous_results, provider, max_tokens, domain, goal`
- Always restore originals in `finally`
- Stub return MUST be `(json_string, usage_dict)` tuple -- never just the string

### Invariants the tests verify

| Invariant | Suite |
|---|---|
| Builder marks status="completed" on success | comprehensive + builder_audit |
| Last-only output for text domains; concat for data_transform | builder_audit |
| Token audit reflects real usage (not max_tokens) | comprehensive |
| Planner exception surfaces final_error_details | comprehensive |
| Sub-agent failure stops pipeline | builder_audit |
| Validator catches BUILDER_INJECT marker | adversarial |
| Validator catches Jinja2 leak | adversarial |
| Audit accepts list `agents_executed` | adversarial |
| Validator preserves all input state keys | adversarial |
| Determinism: same input -> same output | adversarial |
| Subprocess isolation (host modules NOT importable) | adversarial |
| Broken syntax NEVER passes (silent-success guard) | adversarial |

---

## 11. Audit reports written across sessions

| File | When | Scope |
|---|---|---|
| `apps/ai/DIAGNOSTIC_REPORT.md` | 2026-05-09 | Pre-fix diagnosis: what's actually in the codebase vs the brief's premise. Identified that "f-string error" and "parallel sub-agents" claims were already resolved by the prior SafeCodeInjector refactor. |
| `apps/ai/OPTIMIZATION_REPORT.md` | 2026-05-09 | Surgical fixes summary: BUG-A through BUG-E. |
| `apps/ai/VALIDATOR_PRODUCTION_AUDIT_REPORT.md` | 2026-05-10 | Validator hardening: 19 adversarial probes, 6 found gaps, 3 fixed (audit contract bug, marker detection, env hardening), 3 deferred with documented reasons. |
| `apps/ai/AGENTFORGE_COMPLETE_SYSTEM_AUDIT.md` | 2026-05-10 | 17-phase system audit. 64 findings (4 critical / 15 high / 30 medium / 15 low). Prioritized roadmap. Phase 18 verdict: do NOT upgrade LLM yet -- engineering ROI dominates. |

These are deliverables for humans, not machine-readable specs. Verify against current code before acting on any specific recommendation.

---

## 12. Cumulative bug-fix history

### 2026-05-09 session (prior to validator)

- **BUG-A**: builder never set status="completed" -> fixed
- **BUG-B**: `_build_safe_agent` concatenated all outputs -> fixed (last-only for text domains, concat for data_transform)
- **BUG-C**: planner exceptions silently failed -> fixed (`final_error_details` captures exception_type+message)
- **BUG-D**: `serialize_html`/`serialize_css` had triple-quote-collision -> fixed (json.dumps everywhere)
- **BUG-E**: `_track_agent` summed `max_tokens` not real usage -> fixed (all providers now return `(text, usage)` tuple)

### 2026-05-10 session (validator audit + system audit)

- **AUDIT-1 (CRITICAL)**: `audit_checker` required `agents_executed: int`, builder writes list -> accept both
- **AUDIT-2 (HIGH)**: `syntax_checker` missed unresolved BUILDER_INJECT/Jinja markers -> added `check_unresolved_markers`
- **AUDIT-3 (CRITICAL)**: server.py bypassed graph (optimizer + validator unreachable) -> wired into `stream_pipeline`
- **AUDIT-4 (CRITICAL)**: server.py had `os.chdir` at import time (concurrency hazard under multi-worker uvicorn) -> removed; nothing actually depended on it
- **AUDIT-5 (CRITICAL)**: CORS hardcoded to `*` -> env-driven allowlist via `AI_CORS_ORIGINS`
- **AUDIT-6 (HIGH)**: subprocess inherited PYTHONPATH (host modules importable) -> `_build_clean_env()`
- **AUDIT-7 (HIGH)**: planner had weaker JSON recovery than sub_agent -> shared `services/llm_parsing.py`
- **AUDIT-8 (HIGH)**: no LLM retry on transient errors -> retry+backoff in `llm.py`
- **AUDIT-9 (HIGH)**: no structured logging -> `services/observability.py`
- **AUDIT-10 (HIGH)**: no per-run trace -> `services/tracer.py`
- **AUDIT-11 (HIGH)**: no prompt-injection defense -> `<user_input>` wrapper paragraph in planner_prompt + prompt_optimizer_prompt
- **AUDIT-12 (MEDIUM)**: `mock_builder_outputs` used wrong audit shape -> updated to list
- **AUDIT-13 (MEDIUM)**: triviality not detected -> conservative warning (imports-only, all-pass)
- **AUDIT-14 (MEDIUM)**: state contract not enforced at runtime -> `require_state_keys()` helper

### Deferred (still open)

- Conditional graph edges (#14)
- Domain plugin system (#16)
- LLM cache for dev (#20)
- AGENT_TEMPLATE format extraction (#22)
- Sanitizer indent normalization (#23)
- Domain skeleton parameterization (#24)

---

## 13. Cleanup state (2026-05-10)

Deleted in cleanup passes:
- 6 broken test files (test_phase3/4/5, test_quality, debug_builder, debug_pipeline, debug_step)
- 2 dead prompt files (`website_builder_prompt`, `builder_prompt`)
- All `__pycache__/` dirs (added to `.gitignore`)
- All `generated_agents/run_*.py` artifacts (added to `.gitignore`)
- `uploads/zip_sums.csv` and `uploads/monthly_sales (1).csv` stray data
- ~174 leaked tempdirs from adversarial test runs

`.gitignore` now covers: `__pycache__/`, `*.pyc`, `apps/ai/src/generated_agents/run_*.py`, `apps/ai/uploads/*` (with `.gitkeep` exception).

**Known leak**: `test_validator_adversarial.py` uses bare `tempfile.mkdtemp` (no auto-cleanup). Cleanup workaround: `Get-Item "$env:TEMP\adv_validator_*" | Remove-Item -Recurse -Force`. Not yet fixed because rewriting all 19 probes to use `TemporaryDirectory()` is a refactor and the user hasn't asked for it.

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

### Open frontend concerns

- Builder hidden during validating causes a static moment
- Sub-agent count random 5-9 for now
- Walk-in animation only re-fires on `runId` change
- Backend not live yet

---

## 15. Backend (NestJS, in dev by friend)

The user's friend is implementing the NestJS backend. The user asked for a prompt to hand to them; the prompt was authored as a one-shot deliverable in chat (no file written). It included accurate AI service contract details: SSE event names, payload shapes, run_id format, validation_status semantics, etc.

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

`packages/shared/run.ts`:
```ts
export interface Run {
  id: string;
  userPrompt: string;
  stage: Stage;
  status: RunStatus;
  domain?: Domain;
  spec?: AgentSpec;
  createdAt: string;
  updatedAt: string;
  finalError?: string;
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
- Prefers numbered lists when requesting multiple tasks
- Describes by visuals not pixels ("the sub-agent fan looks off")
- "live" = dynamic/cinematic, not literal real-time
- Often hands MASSIVE prescriptive prompts (audit specs with 17 phases, NestJS backend specs). Read carefully but don't take every claim at face value -- some refer to code that doesn't exist or use outdated diagrams.

### Working preferences

- Visual polish is top priority on the frontend
- Architecture must be backend-ready even while mocked
- Terse responses; no long narration
- No tests or lint cleanup unless asked
- Verifies in browser (`localhost:5173`)
- Don't run `git commit` unless asked
- User commits work themselves; user owns commit decisions
- When user collaborates with friend on backend and asks "write a prompt for my friends", the deliverable is JUST the prompt text -- no code execution, no extra tool calls

---

## 17. HARD RULES (do not violate)

These are corrections the user has explicitly given; each comes from a real failure or strong preference.

### 17.1 "Continue" / "ok go" means EXECUTE

When the user replies "continue", "ok go", "do all of them", or hands a prescriptive task spec -- EXECUTE. Do not ask another decision question. Asking again is friction.

- Decision-gate rule applies to the START of an open-ended task -- not to every batch within it.
- ASK up front (max 1 question) when: codebase doesn't match the task's premise; multiple sensible architectural paths exist; the work would touch shared resources.
- DON'T ask "Do you want me to also do X?" when X was already in the user's task list.

### 17.2 No fabricated metrics in audit reports

Never invent percentages ("+300% quality"), multipliers, or measurements you didn't measure. The user explicitly values intellectual honesty over impressive-sounding numbers.

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

- Writing `"""` inside a docstring terminates the string prematurely. Confusing SyntaxError points to a line far from the actual problem.
- Pattern: `# Why json.dumps and not a triple-quoted wrapper: ...`

### 17.7 call_llm returns a tuple

Always unpack: `text, usage = call_llm(...)`. Never assign to a single variable.

- Usage dict shape: `{prompt_tokens: int, completion_tokens: int, total_tokens: int, provider: str}`
- When writing test stubs for call_llm, return `(json_string, usage_dict)` -- never just the string

### 17.8 Test monkey-patching

Patch the attribute on the module that IMPORTS the function, not the original definition module.

- planner tests: patch `planner_module.call_llm`
- sub_agent tests: patch `sub_agent_module.call_llm`
- builder tests: patch `builder_module.execute_sub_agent` with EXACT 8-kwarg keyword-only signature: `step_id, step_data, total_steps, previous_results, provider, max_tokens, domain, goal`
- Always restore originals in `finally`

### 17.9 Merge conflict resolution

Read both sides carefully. Keep HEAD if HEAD contains a recent fix the user is currently working on; do not blindly accept theirs.

- 2026-05-10 example: builder.py merge -- HEAD had BUG-E fix (`agents_executed: list`, real per-step `usage` dict accumulation); other branch had old `agents_executed: int`, `max_tokens` summing. Kept HEAD; reverting would have re-broken the audit.
- Cite which side you kept and why in your summary
- Don't `git commit` after resolution unless the user asks

### 17.10 PowerShell vs bash PYTHONPATH separator

PowerShell uses semicolon `;`, bash uses colon `:`. On Windows, ALWAYS use semicolon regardless of shell -- even in Git Bash, because Python on Windows expects Windows-style separator.

- PowerShell: `$env:PYTHONPATH = "apps/ai/src;apps/ai/src/tests"`
- Bash on Windows: `export PYTHONPATH="apps/ai/src;apps/ai/src/tests"` (semicolon, NOT colon)
- Better yet: use `conftest.py` with `sys.path.insert(0, ...)` -- this is what `apps/ai/src/tests/conftest.py` does

### 17.11 tempfile.mkdtemp leaks

`tempfile.mkdtemp(prefix="...")` does NOT auto-clean. Use `tempfile.TemporaryDirectory()` as a context manager for tests. If you must use `mkdtemp`, register `atexit.register(shutil.rmtree, path, ignore_errors=True)`.

- 174 leaked dirs accumulated in `$env:TEMP\adv_validator_*` from running the adversarial suite. Manual cleanup: `Get-Item "$env:TEMP\adv_validator_*" | Remove-Item -Recurse -Force`

### 17.12 Architecture preservation (will reject)

The user will reject:
- Async / threading / multiprocessing
- New frameworks, DBs, queues, DI containers
- Shape changes to `AgentForgeState` TypedDict (additive runtime keys are OK)
- LangGraph wiring changes that break existing test stubs
- New stage constants without a clear reason

### 17.13 Documentation policy

No unsolicited docs (no `README.md`, `CHANGELOG.md`, etc.).

EXCEPTION: when the user explicitly asks for an audit/report/spec (DIAGNOSTIC_REPORT, OPTIMIZATION_REPORT, VALIDATOR_PRODUCTION_AUDIT_REPORT, AGENTFORGE_COMPLETE_SYSTEM_AUDIT) -- those are deliverables and should be substantial.

---

## 18. Anti-patterns to avoid

- Over-analyzing screenshots
- Adjusting magic numbers instead of root causes
- Treating bugs as separate when one root cause exists
- Acting on linter noise (inline styles etc.)
- Long narrative responses
- Asking permission for obvious related fixes
- Reading entire files unnecessarily
- Adding helpers / abstractions / plugins for hypothetical future callers
- Inventing quality percentages or speedup multipliers in audits
- Recommending model upgrades when engineering ROI hasn't been exhausted

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
- No async / threading / multiprocessing in AI service
- No model upgrade beyond `llama-3.1-8b-instant` until engineering wins are exhausted (Phase 18 verdict)

Reason throughout: premature complexity.

---

## 20. Memory system pointers

The user has a parallel memory system at `~/.claude/projects/c--Users-1mhmd-OneDrive-Desktop-Ai-Projects-AgentForge/memory/` with discrete files for project state, user style, and feedback rules. That index lives in `MEMORY.md` inside that directory and is auto-loaded each session. This root-level `MEMORY.md` (the file you're reading) is the consolidated hand-off; the per-rule files in the memory system are the authoritative source of each individual rule.

If you (a future AI) are running with that auto-memory system loaded, you'll see those individual files. If not, this single document covers everything.

---

## 21. Final operating instruction

If you're a new AI picking up this project: **read sections 0, 17, and 19 first.** They tell you how to behave. Then skim the rest as needed. Verify against current code before acting on any specific recommendation here -- this document reflects 2026-05-10 state.

If two parts of the system disagree about a contract -> **shared types win.**

If two parts of this document disagree -> **the user's most recent stated preference wins.** When in doubt, ask one focused question up front before starting work.
