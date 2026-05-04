# AgentForge

AI agent platform — monorepo.

## Structure

- `apps/frontend` — React (Vite) UI
- `apps/backend` — Node.js API
- `apps/ai` — LangGraph-style AI engine (planner / builder / validator)
- `packages/shared` — TypeScript types shared across apps
- `infra/` — Docker, nginx, k8s configs
- `docs/` — architecture and API docs
- `scripts/` — build/setup scripts
- `.github/` — workflows and issue templates

## Quick Start

```bash
npm install
cp .env.example .env
docker-compose up -d postgres
npm run dev:backend
npm run dev:ai
npm run dev:frontend
```

## Branches

- `main` — production
- `dev` — development integration
