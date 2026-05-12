# AgentForge

**AgentForge** is a full-stack AI platform that turns a plain English prompt into a working, validated Python agent — live-streamed to the browser as it builds.

Describe what you want, pick a domain, and AgentForge runs a multi-stage AI pipeline (Prompt Optimizer → Planner → Builder → Validator) to produce a real, executable `.py` file. The entire build streams in real time. Successful runs are persisted to a vector database for retrieval and reuse.

---

## What It Can Build

| Domain | What you get |
|---|---|
| **Website Builder** | Complete HTML + CSS single-page site, rendered live in the browser |
| **Document Generation** | Structured reports, whitepapers, specs — in markdown or plain text |
| **Web Research** | Multi-angle research report synthesized by the AI pipeline |
| **Data Transform** | Upload a CSV / Excel / JSON / XML file and transform it — output as JSON, CSV, or text |

---

## The Pipeline

Every run goes through 5 stages, all streamed live:

```
Prompt Optimizer → Planner → Builder (sub-agents) → Validator → Qdrant Persistence
```

1. **Prompt Optimizer** — rewrites your prompt into a structured, unambiguous task
2. **Planner** — produces a step-by-step execution plan (2–7 sub-agents based on complexity)
3. **Builder** — runs each sub-agent sequentially; each one builds on the last (rewrite-the-whole contract)
4. **Validator** — 7-stage quality check: syntax, execution sandbox (15s timeout), file integrity, audit shape, triviality, and optional Playwright browser validation
5. **Persistence** — passes validation? Saved to Qdrant with semantic deduplication

---

## Architecture

```
Browser (localhost:5173)
        │
        ▼
  NestJS Backend (localhost:3000/api)
  ├── PostgreSQL (auth, runs, users, audit)
  ├── Qdrant Cloud (memory / semantic search)
  └── proxies SSE ──►
                    Python AI Service (localhost:4000)
                    ├── LangGraph pipeline
                    ├── Gemini (primary LLM) / Groq (fallback)
                    ├── MCP: MS Learn + Context7 + Exa (optional)
                    └── Qdrant (direct persistence write)
```

### Apps

- `apps/frontend` — React + Vite SPA, port **5173**
- `apps/backend` — NestJS REST API, port **3000** (global `/api` prefix)
- `apps/ai` — Python FastAPI + LangGraph pipeline, port **4000**
- `packages/shared` — TypeScript types shared across apps
- `scripts/` — dev launchers, integration test suites

---

## Features

- **Live streaming** — every pipeline stage streams to the browser over SSE; nothing waits for the full build
- **3D cinematic UI** — Three.js / React Three Fiber office scene on the landing page
- **File upload** — drag-and-drop CSV, TSV, JSON, JSONL, XML, XLSX for the data transform domain
- **MCP doc tools** — optionally inject real API documentation (Microsoft Learn, Context7, Exa) into the builder before any code is generated, eliminating hallucinated method signatures
- **Playwright validation** — optional headless browser QA for generated websites
- **Vector memory** — Qdrant stores successful runs; similar future prompts can retrieve and upgrade prior templates
- **Admin dashboard** — user management, analytics, audit logs, role-based access (USER / ADMIN / SUPER_ADMIN)
- **Google OAuth** — sign in with Google alongside email/password
- **Gemini → Groq fallback** — hard quota on Gemini? Automatically falls back to Groq with no user interruption
- **Responsive** — full mobile and tablet layout via a `useViewport()` breakpoint hook

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Three.js / R3F, Axios, native EventSource |
| Backend | NestJS, Prisma, PostgreSQL, Passport JWT + Google OAuth |
| AI service | Python 3.11, FastAPI, LangGraph, google-genai, groq, sentence-transformers |
| Vector DB | Qdrant Cloud (384-dim cosine, `all-MiniLM-L6-v2`) |
| MCP | `mcp==1.27.1` — MS Learn, Context7, Exa, Playwright |
| Infrastructure | Railway (Postgres), Qdrant Cloud (EU) |

---

## Prerequisites

- **Node.js ≥ 20** with **npm ≥ 10** (this repo uses npm workspaces)
- **Python ≥ 3.11** (the AI service uses `google-genai`, `sentence-transformers`, FastAPI, etc.)
- A PostgreSQL database — local Docker is easiest, or a hosted URL (Railway, Supabase, Neon)
- Optional: a Qdrant cluster (cloud or `docker run -p 6333:6333 qdrant/qdrant`)

---

## First-Time Setup

```bash
# 1. Install JS workspaces (frontend + backend + shared stub)
npm install

# 2. Create + activate a Python venv at the REPO ROOT (not under apps/ai)
python -m venv venv

# Windows:
.\venv\Scripts\activate
# macOS / Linux:
source venv/bin/activate

# 3. Install Python deps for the AI service
pip install -r Requirements.txt

# 4. Create your .env from the template
cp .env.example .env
# Fill in: DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET,
# GEMINI_API_KEY (or GROQ_API_KEY), and optionally QDRANT_URL + QDRANT_API_KEY

# 5. Frontend env (Vite reads VITE_* at build time)
echo "VITE_API_BASE_URL=http://localhost:3000/api" > apps/frontend/.env.local

# 6. Run database migrations
cd apps/backend
npx prisma generate
npx prisma migrate dev
cd ../..
```

### Bootstrap an admin (optional)

Set `ADMIN_EMAIL=you@example.com` in `.env`. The first user who registers with that exact email is auto-promoted to `SUPER_ADMIN` and gets the Admin entry in the navbar. After that, manage roles from the Admin console (`/admin → Members → role dropdown`).

---

## Running the Stack

### Option A — one command (Windows, recommended)

From the repo root in `cmd` (or double-click in Explorer):

```bat
scripts\dev.bat
```

Spawns three console windows — one each for the AI service, backend, and frontend — so logs stay readable. Wait ~10–20 seconds, then open http://localhost:5173.

To stop everything at once:

```bat
scripts\dev-stop.bat
```

### Option B — three terminals (any OS)

**Terminal 1 — AI service (Python)**
```bash
.\venv\Scripts\activate   # Windows
# source venv/bin/activate  # macOS / Linux

cd apps/ai
python server.py
```
Binds to `http://localhost:4000`. Wait for `Uvicorn running on http://0.0.0.0:4000`.

**Terminal 2 — Backend (NestJS)**
```bash
cd apps/backend
npm run dev
```
Starts with `--watch` on `http://localhost:3000`. Routes are under `/api/*`; health is at `/health` and `/health/ready`.

**Terminal 3 — Frontend (Vite)**
```bash
cd apps/frontend
npm run dev
```
Serves `http://localhost:5173` with HMR.

Then open http://localhost:5173, register an account, and start a run.

---

## Verifying the Stack

```bash
curl http://localhost:4000/              # AI service root
curl http://localhost:3000/health        # backend liveness
curl http://localhost:3000/health/ready  # backend + db + ai + qdrant latencies
curl http://localhost:5173/             # frontend
```

`/health/ready` returns a JSON body with per-dependency latency. Expect `database`, `aiService`, and `qdrant` all `"ok"` when properly configured.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | 48-byte hex signing key |
| `JWT_REFRESH_SECRET` | Yes | 48-byte hex refresh signing key |
| `BACKEND_PORT` | No (3000) | NestJS port |
| `FRONTEND_URL` | No | CORS allowlist origin |
| `AI_PORT` | No (4000) | FastAPI port |
| `VITE_API_URL` | Yes (frontend) | Backend base URL |
| `LLM_PROVIDER` | No (gemini) | Primary LLM: `gemini`, `groq`, `minimax`, `kimi` |
| `LLM_FALLBACK_PROVIDER` | No (groq) | Fallback LLM provider |
| `GEMINI_API_KEY` | Yes (if using Gemini) | Google Gemini API key |
| `GROQ_API_KEY` | Yes (if using Groq) | Groq API key |
| `QDRANT_URL` | No | Qdrant cluster URL (enables vector persistence) |
| `QDRANT_API_KEY` | No | Qdrant JWT auth token |
| `EXA_API_KEY` | No | Exa.ai key (MCP web search for `web_research` domain) |
| `ADMIN_EMAIL` | No | Email auto-promoted to SUPER_ADMIN on first register |
| `GOOGLE_CLIENT_ID` | No | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | No | Must include `/api` prefix (e.g. `http://localhost:3000/api/auth/google/callback`) |
| `AGENTFORGE_MCP_DOCS` | No (0) | Set `1` to enable doc MCP (MS Learn + Context7 + Exa) |
| `AGENTFORGE_MCP_BROWSER` | No (0) | Set `1` to enable Playwright visual validation |
| `AGENTFORGE_TRACE` | No (0) | Set `1` to write per-run JSONL traces to `apps/ai/traces/` |
| `SANDBOX_TIMEOUT_MS` | No (15000) | Max execution time for generated agents |

See `.env.example` for a full template.

---

## Optional Features

### MCP Doc Grounding (`AGENTFORGE_MCP_DOCS=1`)

Before the builder starts, the system fetches real documentation and injects it into the first sub-agent:
- **Microsoft Learn** — web standards, .NET, Azure, TypeScript references (always queried)
- **Context7** — library-specific docs (React, pandas, FastAPI, etc.) when detected in the goal
- **Exa** — live web search results for `web_research` domain runs (requires `EXA_API_KEY`)

Adds 3–15s per run. Leave off for fast iteration; turn on for production-quality output.

### Playwright Browser Validation (`AGENTFORGE_MCP_BROWSER=1`)

After a `website_builder` run passes execution validation, Playwright opens the generated HTML headlessly and captures console errors + accessibility snapshots. Issues appear as warnings — never fail the run.

### Per-Run Tracing (`AGENTFORGE_TRACE=1`)

Writes a JSONL trace file per run to `apps/ai/traces/<run_id>.jsonl`. Useful for debugging specific pipeline failures without tailing live logs.

---

## Common Gotchas

- **Python venv path**: the venv must be at `<repo>/venv/`, NOT `apps/ai/venv/`. The AI service resolves `.env` relative to the repo root.
- **First Qdrant request is slow**: `/health/ready` can return 503 on the very first hit while the connection warms up. Re-curl after a second.
- **`.py` files must be ASCII**: no em-dashes or smart quotes. If the AI service crashes on import after you edit a prompt file, that's usually the cause.
- **Backend won't pick up new modules**: Nest's `--watch` mode occasionally misses new file imports. Kill `npm run dev` and restart if you hit a stale "module not found".
- **Stale `node_modules` after pulling**: if `npm install` fails after a branch switch, delete `package-lock.json` and reinstall.
- **Node 25 keep-alive bug**: the backend applies a `Connection: close` workaround for an `ERR_INTERNAL_ASSERTION` in Node.js 25's HTTP agent. Do not remove it.
- **Gemini 429 errors**: the pipeline fast-fails hard quota errors and falls back to Groq automatically. If you see repeated 429s, check `GROQ_API_KEY` is set as the fallback.
- **Google OAuth callback**: `GOOGLE_CALLBACK_URL` AND the URI in Google Cloud Console must both include `/api` (e.g. `.../api/auth/google/callback`) due to NestJS's global prefix.

---

## Production Builds

```bash
npm run build    # builds frontend + backend TypeScript

# AI service has no build step — run server.py directly under a supervisor
# (systemd, pm2, Docker). It uses uvicorn internally.
```

---

## Branches

- `main` — production
- `frontend` — current working branch (frontend + all integration commits)
- `backend` — backend integration track

---

## Scripts

| Script | Description |
|---|---|
| `scripts\dev.bat` | Windows one-command launcher — opens AI, backend, frontend in 3 console windows |
| `scripts\dev-stop.bat` | Kills whatever owns ports 3000, 4000, and 5173 |
| `scripts/test-backend.sh` | 27-case integration suite (auth, runs CRUD, admin guards, SSE) |
| `scripts/test-qdrant.sh` | 15-case Qdrant suite (cluster, collections, memory search, similarity) |

---

## Deep Dive

See [PRESENTATION.md](PRESENTATION.md) for a full breakdown of the pipeline stages, all 4 domain scenarios with examples, MCP architecture details, LLM fallback chain, validation scoring, and every design decision.
