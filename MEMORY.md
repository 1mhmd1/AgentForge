# AgentForge — Full Project Context & Working Agreement
> **Give this file to any new AI session. It is the single source of truth.**
> Last updated: 2026-05-08

---

## 1. What Is AgentForge

AgentForge is an AI-powered agent generation platform:

1. User submits a natural language prompt
2. **Planner** (LLM) converts it to a structured `AgentSpec`
3. **Builder** orchestrates sub-agents to generate code step by step
4. Output is a complete, runnable Python agent file
5. **Validator** — not yet implemented (planned next phase)

The system is a **monorepo**. The AI subsystem (`apps/ai`) is fully operational and the primary active development area.

---

## 2. Full Repository Layout

```
AgentForge/
├── MEMORY.md                     ← this file
├── .env                          ← GROQ_API_KEY, GEMINI_API_KEY (root level)
├── package.json                  ← monorepo workspace (pnpm)
├── packages/
│   └── shared/                   ← shared TypeScript types (source of truth)
│       ├── core.ts
│       ├── agent.ts
│       └── run.ts
├── apps/
│   ├── frontend/                 ← React 18 + Vite + TypeScript (localhost:5173)
│   ├── backend/                  ← NestJS (not yet fully connected)
│   └── ai/                       ← ACTIVE — Python AI pipeline (localhost:4000)
│       ├── server.py             ← FastAPI server — runs the pipeline, serves UI
│       ├── ui.html               ← Pipeline test UI (premium dark theme)
│       ├── test_builder_audit.py ← 12 unit/integration tests for builder
│       ├── test_quality.py       ← 15 tests for code injection & validation
│       ├── Requirements.txt
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── nodes/
│           │   ├── planner.py         ← calls LLM, parses spec JSON
│           │   ├── builder.py         ← 8-stage orchestration pipeline
│           │   └── sub_agent.py       ← generates code per step, selects prompt
│           ├── prompts/
│           │   ├── planner_prompt.py
│           │   ├── sub_agent_prompt.py        ← general prompt (strict, no placeholders)
│           │   └── website_builder_prompt.py  ← domain-specific prompt
│           ├── services/
│           │   ├── code_injector.py    ← indentation-aware injection
│           │   ├── snippet_validator.py← placeholder/import/quality scoring
│           │   ├── template_loader.py
│           │   ├── template_renderer.py (Jinja2)
│           │   ├── file_writer.py
│           │   └── errors.py           ← centralized error codes
│           ├── state/
│           │   └── State.py            ← AgentForgeState TypedDict + initial_state()
│           ├── graph/
│           │   └── graph.py            ← LangGraph: planner → builder → END
│           ├── llm/
│           │   ├── llm.py              ← provider selector
│           │   └── providers/
│           │       ├── groq_provider.py   ← primary (GROQ_API_KEY)
│           │       └── gemini_provider.py ← fallback (GEMINI_API_KEY)
│           ├── templates/
│           │   └── website-builder/
│           │       └── base.j2         ← Jinja2 template with BUILDER_INJECT markers
│           └── generated_agents/       ← output Python files (run_ui_*.py)
```

---

## 3. How to Run

```powershell
# Start the pipeline UI server (from apps/ai):
python server.py
# → http://localhost:4000

# Run audit tests:
python test_builder_audit.py

# Run quality tests:
python test_quality.py
```

**The server is the primary development interface.** It streams pipeline stages via SSE.

---

## 4. Shared Types (Contract — Source of Truth)

All layers must agree with these. If conflict → **shared types win**.

```ts
// core.ts
export type Domain = "web_research" | "document" | "data_transform" | "website_builder";
export type Stage = "planning" | "building" | "validating" | "completed";
export type RunStatus = "queued" | "running" | "completed" | "failed";
export type Complexity = "simple" | "medium";

// agent.ts
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

### Mapping Rules

| Layer   | Example       |
|---------|---------------|
| Shared  | web_research  |
| Prisma  | WEB_RESEARCH  |
| Python  | web_research  |

Backend must map between layers. Python always uses lowercase with underscores.

---

## 5. AI Pipeline — State

```python
class AgentForgeState(TypedDict):
    run_id: str
    user_prompt: str

    stage: Stage
    status: RunStatus

    spec: Optional[AgentSpec]
    domain: Optional[Domain]

    step_map: Optional[dict[str, Any]]
    execution_order: Optional[list[str]]
    sub_agent_results: Optional[dict[str, Any]]

    template_path: Optional[str]
    generated_code: Optional[str]
    output_path: Optional[str]

    current_stage: Optional[str]
    completed_stages: list[str]
    error_stage: Optional[str]

    validation_errors: list[str]
    repair_attempts: int

    final_error: Optional[str]
    final_error_details: Optional[dict[str, Any]]
    quality_score: Optional[dict[str, Any]]  # ← added in quality upgrade

    created_at: str
    started_at: Optional[float]
    completed_at: Optional[float]
    build_duration_seconds: Optional[float]
```

---

## 6. Builder Pipeline — 8 Stages (in order)

All new stages MUST use `_run_stage()` helper in `builder.py`.

| # | Stage Constant | What it does |
|---|---|---|
| 1 | `STAGE_VALIDATION` | Validates spec dict (domain, goal, steps) |
| 2 | `STAGE_EXECUTION_PLANNING` | Builds step_map, runs sub-agents, collects results |
| 3 | `STAGE_TEMPLATE_LOADING` | Loads Jinja2 template from domain folder |
| 4 | `STAGE_TEMPLATE_RENDERING` | Renders template with context |
| 5 | `STAGE_CODE_INJECTION` | Injects sub-agent code at BUILDER_INJECT markers (indent-aware) |
| 6 | `STAGE_QUALITY_VALIDATION` | Scores quality, detects placeholders/missing imports (warn only) |
| 7 | `STAGE_SYNTAX_VALIDATION` | `ast.parse()` the final code |
| 8 | `STAGE_FILE_WRITING` | Writes to `src/generated_agents/run_<id>.py` |

### Error Codes (errors.py)

```python
ERROR_CODES = {
    "INVALID_SPEC": "builder_invalid_spec",
    "TEMPLATE_EMPTY": "template_empty",
    "TEMPLATE_NOT_FOUND": "template_not_found",
    "RENDER_ERROR": "template_render_error",
    "MARKER_MISSING": "marker_not_found",
    "SYNTAX_ERROR": "syntax_validation_failed",
    "FILE_WRITE_ERROR": "file_write_failed",
    "PLACEHOLDER_DETECTED": "placeholder_code_detected",
    "IMPORT_MISSING": "missing_required_import",
    "QUALITY_TOO_LOW": "quality_score_too_low",
}
```

### Supported Domains

```python
SUPPORTED_DOMAINS = {"web_research", "document", "data_transform", "website_builder"}
```

---

## 7. Code Injection — How It Works

**File:** `src/services/code_injector.py`

Template markers look like:
```python
def execute_step_1():
    """Step 1"""

    """BUILDER_INJECT:step_1"""
```

The injector:
1. Detects the indent of the marker line (e.g., `    `)
2. `textwrap.dedent()` strips leading whitespace from the AI snippet
3. Re-indents every non-blank line to match the marker's indent
4. Empty snippets become `pass` (prevents empty function body syntax errors)

**This eliminates all `IndentationError` / `SyntaxError` from injection.**

---

## 8. Sub-Agent Prompt System

**File:** `src/prompts/sub_agent_prompt.py` — general prompt for all domains  
**File:** `src/prompts/website_builder_prompt.py` — domain-specific for `website_builder`

`sub_agent.py` selects the prompt based on `domain`:
```python
def _select_prompt(domain):
    if domain == "website_builder":
        return WEBSITE_BUILDER_PROMPT
    return SUB_AGENT_PROMPT
```

Both prompts accept: `step_number`, `total_steps`, `step_id`, `step_text`, `tools`, `previous_results`, `domain`, `goal`

### Strict Rules Enforced in Both Prompts

**BANNED (causes automatic rejection):**
- `create_*()`, `build_*()`, `implement_*()` calls to undefined functions
- `TODO` / `FIXME` comments
- `pass` as the only statement
- `...` (ellipsis)
- `placeholder` / `dummy` / `mock`

**REQUIRED:**
- All imports present in the snippet
- Real, complete, executable code
- No stubs or pseudo-code

---

## 9. Snippet Validator

**File:** `src/services/snippet_validator.py`

Three functions:
- `detect_placeholders(code)` → list of violations (checks if called funcs are defined)
- `detect_missing_imports(code)` → list of missing modules (requests, pandas, numpy, bs4, flask, fastapi)
- `score_quality(code, domain)` → dict with:
  - `implementation_quality` (float 0–1)
  - `semantic_completeness` (float 0–1, domain-specific)
  - `has_placeholders` (bool)
  - `has_missing_imports` (bool)
  - `placeholder_violations` (list)
  - `missing_imports` (list)

**Quality validation is currently WARN-only** (logs warnings but doesn't fail the pipeline). Will be hardened when output quality is consistently high.

---

## 10. Pipeline UI (server.py + ui.html)

**Port:** `localhost:4000`  
**Protocol:** SSE (Server-Sent Events)  
**Endpoint:** `POST /run` with `{ prompt, domain }`

### UI Features
- Dark premium theme (purple/green/blue accent palette, JetBrains Mono + Inter)
- Prompt textarea with 4 example chips (click to pre-fill)
- Domain selector dropdown (or auto-detect)
- Stage-by-stage progress tracker (all 9 stages including Planner)
- Spec card shows: goal, domain, complexity, tools, steps
- Success card shows: quality scores (color-coded), sub-agent summaries, generated code viewer + copy button
- Failure card shows: error stage badge, error code, details

### Quality Score Colors in UI
- ≥ 0.7 → green
- ≥ 0.4 → yellow
- < 0.4 → red

---

## 11. Tests

### test_builder_audit.py (12 tests)
All tests use monkey-patching of `builder.execute_sub_agent` and `builder.load_template`.

`fake_execute` signature: `(step_id, step_data, total_steps, previous_results, domain=None, goal=None)`

**Test coverage:**
- Valid website spec (success path)
- Invalid domain → TEMPLATE_NOT_FOUND error
- Empty template → TEMPLATE_EMPTY error
- Missing injection marker → MARKER_MISSING error
- Invalid Python after injection → SYNTAX_ERROR (completed_stages includes QUALITY_VALIDATION)
- Malformed planner output
- Template loading failure
- Timing preserved on failure
- Timing valid on success
- Logging no-crash on both paths
- Deterministic failure state fields

### test_quality.py (15 tests)
- `test_indent_detection` — `_detect_indent()` function
- `test_reindent_basic` — basic re-indent to 4 spaces
- `test_reindent_with_existing_indent` — strips then re-indents
- `test_reindent_blank_lines` — blank lines not indented
- `test_injection_indentation` — full injector, AST must parse
- `test_injection_multiline_indent` — nested for-loop indentation
- `test_injection_empty_code` — empty snippet → `pass`
- `test_placeholder_detection` — `create_hero_section()` flagged
- `test_placeholder_with_definition` — defined functions not flagged
- `test_todo_detection` — `# TODO` detected
- `test_pass_only_detection` — `pass`-only body detected
- `test_missing_import_detection` — `requests` usage without import
- `test_quality_scoring_high` — real code scores ≥ 0.5
- `test_quality_scoring_low` — `pass` scores < 0.5
- `test_website_quality_scoring` — HTML content scores semantic ≥ 0.5

---

## 12. Frontend (React)

**Port:** `localhost:5173`  
**TypeScript check:**
```powershell
& "C:\Users\1mhmd\OneDrive\Desktop\Ai Projects\AgentForge\node_modules\.bin\tsc.cmd" --noEmit -p "apps\frontend\tsconfig.json"
```

### Conventions
- Inline styles only: `const s: Record<string, React.CSSProperties> = { ... }`
- All keyframes in `index.css`
- CSS custom properties for tokens (`var(--accent-purple)`, etc.)
- Sub-components co-located in same file
- No comments unless the *why* is non-obvious
- No emojis in code/UI text except existing ✓ marks
- Do NOT introduce `react-router-dom`
- No Tailwind / new styling systems

### WorkflowTheater — Critical Rules (don't break these)
- Perspective: `1100px`, origin `50% 30%`
- World: `rotateX(26deg)` + `preserve-3d`
- Agents at x = `-310, 0, 310`
- Sub-agent fan: `left: 50%; bottom: 50px; height: 175px`
- Energy beams at `top: 49%`
- `humanoidBob` keyframe must be Y-only (no translateX/translate3d)
- Body div must NOT have `marginLeft: -40`
- Builder is conditionally rendered (building + completed only)
- Walk-in and bob are separate animation wrappers

---

## 13. Database (Prisma)

DB = storage representation. Not the contract.

```prisma
model Run {
    id          String    @id @default(cuid())
    userPrompt  String
    stage       Stage      @default(PLANNING)
    status      RunStatus  @default(RUNNING)
    domain      Domain?
    spec        Json?
    finalError  String?
    createdAt   DateTime   @default(now())
    updatedAt   DateTime   @updatedAt
}

enum Domain { WEB_RESEARCH DOCUMENT DATA_TRANSFORM WEBSITE_BUILDER }
enum Stage { PLANNING BUILDING VALIDATING COMPLETED }
enum RunStatus { QUEUED RUNNING COMPLETED FAILED }
```

---

## 14. Environment Variables

```
# Root .env (AgentForge/.env)
GROQ_API_KEY=...       ← primary LLM (used by planner + sub-agents)
GEMINI_API_KEY=...     ← fallback LLM

# apps/ai/.env (also checked by server.py)
```

`server.py` loads env with: `load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))`

---

## 15. Next Steps (what comes after current state)

1. **Validator node** — validate generated agent output semantically
2. **Harder quality gating** — fail pipeline if quality score is critically low (currently warn-only)
3. **More domain templates** — `web_research`, `data_transform`, `document` base.j2 files
4. **Backend connection** — NestJS ↔ AI pipeline via HTTP/WebSocket
5. **Frontend integration** — replace mock data with real API calls

---

## 16. User Preferences & Working Style

**User:** Mhmd (informal English, consistent shorthand: "u", "plzz", "nb", "validater")

### Communication
- Short, direct responses — no long narration
- Numbered lists for multi-task requests
- Describes by feel/visual, not pixels
- "live" = dynamic/animated, not literal real-time

### Decision Making
- User approves implementation plans before execution (show plan → wait for approval)
- User says "Continue" to proceed after seeing directory listings or partial work
- User may say "Continue" to resume mid-task after being interrupted

### What User Values Most
1. **Working code that actually runs** — no stubs, no placeholders
2. **Visual polish** (UI must look premium, dark theme, gradients, animations)
3. **Clean architecture** (no premature complexity, no rewrites)
4. **Terse feedback** — show output, not explanations

### What NOT to Do
- Do NOT run `git commit` unless asked
- Do NOT rewrite the Builder or add async/distributed/DB layers
- Do NOT add Tailwind or new styling systems to frontend
- Do NOT add JSDoc/TSDoc or verbose comments
- Do NOT add Validator node yet (planned for next phase)
- Do NOT ask permission for obvious related fixes
- Do NOT over-analyze screenshots
- Do NOT adjust magic numbers instead of fixing root causes
- Do NOT treat lint warnings as errors (Pyrefly false positives on server.py are expected)

---

## 17. Architectural Decisions (Don't Undo)

1. **`_run_stage()` helper in builder.py** — all 8 stages use it. Do not inline stages.
2. **Quality validation is warn-only** — attaches `quality_score` to state but does not fail
3. **Domain-specific prompts** — `website_builder` uses its own prompt; others use general prompt
4. **Indentation-aware injection** — `textwrap.dedent()` + target indent. Do not remove this.
5. **`pass` fallback for empty snippets** — empty generated_code becomes `pass`, never empty body
6. **Shared types win** over Prisma, backend DTOs, and AI state if there's ever a conflict

---

## 18. Things Intentionally NOT Done

- No API client yet
- No utils package
- No validation package
- No logs table
- No microservices split
- No sandbox execution
- No auto-repair systems
- No validator node (planned Phase 3)

Reason: **premature complexity**.

---

## 19. Known Issues / Open Concerns

- Builder hidden during validating will cause a static moment in frontend animation
- Sub-agent count is random 5–9 (mock) in WorkflowTheater — needs real data later
- Walk-in animation only re-fires on `runId` change
- Backend not yet live — frontend uses mock data
- Groq API rate-limits hard when running multiple test domains sequentially (add 10s delay between)
- Pyrefly lint warnings on `server.py` for `fastapi`, `uvicorn`, `state.State` etc. are expected false positives — `sys.path.insert` is runtime-only

---

## 20. Corrections Already Applied (Do Not Reintroduce)

### Frontend
1. Dropdown overlap fixed by `promptWrap` zIndex
2. Sub-agent fan origin aligned via `bottom: 50px` + `height: 175px`
3. Energy beams at `top: 49%`
4. Agents spacing to ±310, beam ends inset ±40
5. `humanoidBob` keyframe Y-only
6. Removed body `marginLeft: -40`
7. Builder hidden during planning/validating
8. Walk-ins separated from bob animation, keyed on `runId`
9. Sub-agent count random 5–9

### AI Pipeline
10. `State.py` `initial_state()` indentation fixed (consistent 8-space indent in dict)
11. `FILE_WRITE_ERROR` error code added to errors.py
12. `builder.py` refactored with `_run_stage()` helper — do not flatten back
13. `code_injector.py` — marker line indent detection + `textwrap.dedent()` + re-indent
14. `sub_agent_prompt.py` — rewrote to ban placeholders, require imports, real examples
15. `website_builder_prompt.py` — new file, domain-specific quality requirements
16. `snippet_validator.py` — new file, `detect_placeholders()` / `detect_missing_imports()` / `score_quality()`
17. `STAGE_QUALITY_VALIDATION` added between CODE_INJECTION and SYNTAX_VALIDATION
18. `sub_agent.py` now accepts `domain` and `goal` params, selects prompt by domain
19. TODO/FIXME regex fixed: pattern is `#\s*TODO\b` not `\b#\s*TODO\b` (`#` is not a word char)
20. `invalid_python_after_injection` audit test: `QUALITY_VALIDATION` is in completed_stages before SYNTAX_VALIDATION fails
21. Old test files deleted: `debug_builder.py`, `debug_pipeline.py`, `test_phase1/3/4/5.py`, `test_pipeline_full.py`
