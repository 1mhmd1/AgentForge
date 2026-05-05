# AgentForge — Full Project Context & Working Agreement

## Purpose

This file is the single hand-off document for AgentForge. Give it to any new AI/dev so they fully understand the project, decisions, conventions, corrections, and the user’s working style.

---

## Project Overview

AgentForge is an AI-powered system that:

1.  Takes a user prompt
2.  Uses AI (LangGraph) to plan, build, and validate an agent
3.  Returns a working output

---

## Core Architecture

```
Frontend (UI)
		↓
Shared Types (SOURCE OF TRUTH)
		↓
Backend (NestJS)
		↓
Prisma (PostgreSQL)
		↓
AI System (LangGraph - Python)
		↓
Vector DB (Qdrant)
```

---

## System Responsibilities

### Frontend

- UI only
- Displays runs, stages, logs
- Converts steps → SubTasks (UI only)

### Backend (NestJS)

- API layer
- Maps:
  - Prisma ↔ Shared Types
  - Shared Types ↔ AI (Python)
- Handles persistence (PostgreSQL)

### AI (LangGraph)

- Executes pipeline: Planner → Builder → Validator
- Uses `AgentForgeState`
- Produces `AgentSpec`

### Database

- PostgreSQL via Prisma
- Stores run + lightweight execution state

### Vector DB (Qdrant)

- Stores embeddings + memory
- Linked via `run_id`

---

## Core Design Principle

**Shared Types are the source of truth.**
Not Prisma, not backend DTOs, not AI state — only `packages/shared`.

---

## Shared Types (Final Contract)

### `core.ts`

```ts
export type Domain =
  | "web_research"
  | "document"
  | "data_transform"
  | "website_builder";

export type Stage = "planning" | "building" | "validating" | "completed";

export type RunStatus = "queued" | "running" | "completed" | "failed";

export type Complexity = "simple" | "medium";
```

### `agent.ts`

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

### `run.ts`

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

---

## Prisma (DB Layer)

**DB ≠ Contract. DB = storage representation.**

### Final Schema

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

enum Domain {
	 WEB_RESEARCH
	 DOCUMENT
	 DATA_TRANSFORM
	 WEBSITE_BUILDER
}

enum Stage {
	 PLANNING
	 BUILDING
	 VALIDATING
	 COMPLETED
}

enum RunStatus {
	 QUEUED
	 RUNNING
	 COMPLETED
	 FAILED
}
```

---

## Mapping Rules (Critical)

| Layer  | Example      |
| ------ | ------------ |
| Shared | web_research |
| Prisma | WEB_RESEARCH |
| Python | web_research |

Backend must map between them.

---

## AI State (LangGraph)

### Final `state.py`

Stage vs Status is split and consistent across system.

```python
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
```

### State Structure

```python
class AgentForgeState(TypedDict):
		 run_id: str
		 user_prompt: str

		 stage: Stage
		 status: RunStatus

		 spec: Optional[AgentSpec]
		 domain: Optional[Domain]

		 template_path: Optional[str]
		 generated_code: Optional[str]
		 output_path: Optional[str]

		 validation_errors: list[str]
		 repair_attempts: int

		 sandbox_output: Optional[str]
		 sandbox_exit_code: Optional[int]

		 semantic_score: Optional[float]

		 final_error: Optional[str]

		 created_at: str
		 completed_at: Optional[str]
```

---

## Pipeline Flow

```
User Prompt
		↓
Planner
		→ fills spec
		→ sets stage = planning

Router
		→ sets domain

Builder
		→ generates code
		→ stage = building

Validator
		→ validates output
		→ stage = validating

Final
		→ status = completed / failed
		→ stage = completed
```

---

## Critical Decisions Made

1.  Stage vs Status separation
2.  Use “completed” not “done”
3.  Shared types first (not Prisma-first)
4.  Keep system minimal (avoid early abstraction)
5.  Backend is a mapper layer (not business logic owner)

---

## Things Intentionally NOT Done

- No API client yet
- No utils package
- No validation package
- No logs table
- No microservices split

Reason: premature complexity.

---

## What Should Be Done Differently Next Time

If restarting:

1.  Start with shared types
2.  Then AI state
3.  Then backend
4.  Then database

---

## Next Steps (Project)

1.  Implement shared types
2.  Update Prisma schema
3.  Update state.py
4.  Build NestJS mapper layer
5.  Connect AI ↔ Backend
6.  Connect Frontend

---

## Final Rule

If two parts of the system disagree → **shared types win**.

---

# Project Context & Working Brief

## Repo Layout

- Monorepo (pnpm/npm workspace)
- `apps/frontend` — React 18 + Vite + TypeScript, inline-style design system
- `apps/backend` — NestJS scaffold
- `node_modules/.bin/tsc.cmd` lives at monorepo root, not frontend

### Frontend Structure

```
apps/frontend/src/
	 App.tsx                    # state-machine router
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

---

## Conventions to Match

- Inline styles only (`const s: Record<string, React.CSSProperties> = { ... }`)
- All keyframes live in `index.css`
- CSS custom properties for tokens (`var(--accent-purple)`, etc.)
- Sub-components co-located in same file
- No comments unless the _why_ is non-obvious
- No emojis in code/UI text except existing ✓ marks
- Do not introduce `react-router-dom`

### Frontend Type Check (PowerShell)

```powershell
& "C:\Users\1mhmd\OneDrive\Desktop\Ai Projects\AgentForge\node_modules\.bin\tsc.cmd" --noEmit -p "apps\frontend\tsconfig.json"
```

### Dev Server

`npm run dev:frontend` from repo root → `localhost:5173`

---

## WorkflowTheater — Critical Rules

- Perspective: `1100px`, origin `50% 30%`
- World: `rotateX(26deg)` + `preserve-3d`
- Agents at x = `-310, 0, 310`
- Sub-agent fan centered at `left: 50%; bottom: 50px; height: 175px`
- Energy beams at `top: 49%`
- `humanoidBob` keyframe must be Y-only (no translateX/translate3d)
- Body div must NOT have `marginLeft: -40`
- `backdrop-filter` creates stacking context → `promptWrap` uses `position: relative; zIndex: 10`
- Builder is conditionally rendered (building + completed)
- Walk-in and bob are separate wrappers

---

## Backend Integration Points

- `RunExecution.tsx`:
  - `planSubAgents()` → real Builder output
  - `MOCK_LOGS` streamer → SSE/WebSocket
  - `stageStates` driver → live status from backend
- `Home.tsx`:
  - `MOCK_AGENTS` → list endpoint
  - `handleRun` timeout → POST a run
- `Runs.tsx`: `MOCK_RUNS` → list endpoint with pagination
- `data/mockData.ts`: delete when backend is live

---

## User: Mhmd Salim (rabih@chipatech.com)

### Communication Style

- Informal English with consistent typos (plzz, u, nb, fous, validater, hiddin)
- Prefers numbered lists when requesting multiple tasks
- Describes by visuals vs pixels
- “live” = dynamic/cinematic, not literal real-time

### Working Preferences

- Visual polish is top priority
- Architecture must be backend-ready even while mocked
- Terse responses; no long narration
- No tests or lint cleanup unless asked
- Verifies in browser (`localhost:5173`)
- Don’t run `git commit` unless asked

---

## Corrections & Fixes Already Applied (Don’t Reintroduce)

1.  Dropdown overlap fixed by `promptWrap` zIndex
2.  Sub-agent fan origin aligned via `bottom: 50px` + `height: 175px`
3.  Energy beams at `top: 49%`
4.  Agents spacing to ±310, beam ends inset ±40
5.  `humanoidBob` keyframe Y-only
6.  Removed body `marginLeft: -40`
7.  Builder hidden during planning/validating
8.  Walk-ins separated from bob animation, keyed on `runId`
9.  Sub-agent count random 5–9 with backend swap marker

---

## Anti-patterns to Avoid

- Over-analyzing screenshots
- Adjusting magic numbers instead of root causes
- Treating bugs as separate when one root cause exists
- Acting on linter noise (inline styles etc.)
- Long narrative responses
- Asking permission for obvious related fixes
- Reading entire files unnecessarily

---

## Do NOT Do

- No Tailwind / new styling systems
- No `react-router-dom`
- No JSDoc/TSDoc or verbose comments
- No compatibility shims around mocks
- No emojis in code/UI text
- No bypassing hooks

---

## Open Concerns

- Builder hidden during validating causes a static moment
- Sub-agent count random 5–9 for now
- Walk-in animation only re-fires on `runId` change
- Backend not live yet
