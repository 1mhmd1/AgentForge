# AgentForge

AI agent platform — monorepo. Describe what you want, AgentForge generates a runnable agent (website / document / web research / data transform), executes it, and streams the build live.

## Structure

- `apps/frontend` — React (Vite) UI on **port 5173**
- `apps/backend` — NestJS API on **port 3000** (global `/api` prefix)
- `apps/ai` — Python FastAPI service (LangGraph pipeline) on **port 4000**
- `packages/shared` — TypeScript types shared across apps (stub for now)
- `infra/` — Docker, nginx, k8s configs
- `docs/` — architecture and API docs
- `scripts/` — build / setup / integration test scripts

The Python AI service does the actual agent generation. The Nest backend proxies its SSE stream, owns auth, persistence, and admin endpoints. The frontend hits the backend only.

## Prerequisites

- **Node.js ≥ 20** with **npm ≥ 10** (this repo uses npm workspaces)
- **Python ≥ 3.11** (the AI service uses `google-genai`, `sentence-transformers`, FastAPI, etc.)
- A PostgreSQL database — local docker is easiest, or a hosted URL (Railway, Supabase, Neon)
- Optional: a Qdrant cluster (cloud or `docker run -p 6333:6333 qdrant/qdrant`)

## First-time setup

```bash
# 1. Install JS workspaces (frontend + backend + ai stub)
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
# then edit .env and fill in: DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET,
# LLM provider key(s), QDRANT_URL/QDRANT_API_KEY if you have one.

# 5. Frontend env (Vite reads VITE_* at build time)
echo "VITE_API_BASE_URL=http://localhost:3000/api" > apps/frontend/.env.local

# 6. Run the database migrations
cd apps/backend
npx prisma generate
npx prisma migrate dev
cd ../..
```

### Bootstrap an admin (optional)

Set `ADMIN_EMAIL=you@example.com` in `.env`. The first user who registers with that exact email is auto-promoted to `SUPER_ADMIN` and gets the Admin entry in the navbar. After that, manage roles from the Admin console (`/admin → Members → role dropdown`).

## Run the whole stack

### Option A — one command (Windows, recommended)

From the repo root in `cmd` (or double-click in Explorer):

```bat
scripts\dev.bat
```

Spawns three console windows — one each for the AI service, backend, and frontend — so logs stay readable. Wait ~10-20 seconds, then open http://localhost:5173.

To stop everything at once:

```bat
scripts\dev-stop.bat
```

Or just close any of the three windows / Ctrl+C inside one to kill that service only.

### Option B — three terminals (manual, any OS)

### Terminal 1 — AI service (Python)

```bash
# from repo root
.\venv\Scripts\activate          # Windows
# source venv/bin/activate       # macOS / Linux

cd apps/ai
python server.py
```

It binds to `http://localhost:4000` and reads `.env` from the repo root. Wait for `Uvicorn running on http://0.0.0.0:4000`.

### Terminal 2 — Backend (NestJS)

```bash
# from repo root
cd apps/backend
npm run dev
```

Nest starts with `--watch`, prints `Nest application successfully started` on `http://localhost:3000`. Routes are under `/api/*`; health probes are `/health` and `/health/ready` (no `/api` prefix).

### Terminal 3 — Frontend (Vite)

```bash
# from repo root
cd apps/frontend
npm run dev
```

Vite serves `http://localhost:5173`. HMR is on.

### Open the app

http://localhost:5173 — register an account, then start a run from the home prompt.

## Verifying the stack is healthy

```bash
curl http://localhost:4000/                  # AI service root
curl http://localhost:3000/health            # backend liveness
curl http://localhost:3000/health/ready      # backend + db + ai + qdrant
curl http://localhost:5173/                  # frontend
```

`/health/ready` returns a JSON body with per-dependency latency. Expect `database`, `aiService`, and `qdrant` all `"ok"` when you've configured them.

## Common gotchas

- **Python venv path**: this repo expects the venv at `<repo>/venv/`, NOT `apps/ai/venv/`. The AI service reads `.env` via a relative path that assumes the repo-root location.
- **First Qdrant request is slow**: `/health/ready` sometimes returns 503 on the very first hit while the Qdrant connection warms up. Re-curl after a second — it'll be green.
- **`npm run dev:ai` from root** invokes a vestigial TypeScript AI stub. The real AI service is Python — always start it via `python server.py`.
- **`.py` files must be ASCII**: no em-dashes, no smart quotes. If you edit a prompt and the AI service crashes on import, that's usually the cause.
- **Backend won't pick up new modules**: Nest's `--watch` mode reloads existing files but occasionally misses new imports. If you hit a stale "module not found" after adding a file, kill `npm run dev` and restart.
- **Stale `node_modules` after pulling**: if `npm install` fails after a branch switch, delete `package-lock.json` and re-install.

## Production builds

```bash
npm run build                                # all workspaces (frontend + backend)

# AI service has no build step — run server.py directly under your supervisor
# (systemd, pm2, etc.). It uses uvicorn internally.
```

## Branches

- `main` — production
- `frontend` — current working branch (frontend + connection commits)
- `backend` — backend-track integration work

## Useful scripts

- `scripts\dev.bat` — Windows one-command launcher; opens AI + backend + frontend in three console windows
- `scripts\dev-stop.bat` — kills whatever owns ports 3000, 4000, and 5173
- `scripts/test-backend.sh` — 27-case integration suite (auth, runs CRUD, admin guards, SSE)
- `scripts/test-qdrant.sh` — 15-case Qdrant suite (cluster, collections, memory search)
