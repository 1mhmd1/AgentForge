# AgentForge Backend Audit

Date: 2026-05-10
Scope: every module/route/DTO/Prisma model in `apps/backend` vs the canonical
spec ("Production NestJS Backend for AgentForge").

Legend:
- ❌ MUST FIX — violates the canonical contract (refactor in this pass)
- ⚠️ GAP — feature missing entirely, must be added
- 🟢 OK — already satisfies the spec
- 🟡 REWORK — exists but with diverging shape; refactor to match

---

## 1. AI service contract

| Concern | Built | Canonical | Status |
|---|---|---|---|
| Request body to `POST /run` | `{prompt, sessionId, domain, runId}` | `{prompt, domain?}` only | ❌ — strip `sessionId`/`runId` |
| AI response | SSE | SSE | 🟢 |
| Ai-side run id | locally generated, sent to AI | server-side `ui_<8hex>` returned in `started` event | ❌ — capture `run_id` from `started`, persist as `aiRunId` |
| Domain validation | accepts any string normalised to UPPER_SNAKE | reject anything not in closed set BEFORE forwarding | 🟡 — re-add hard rejection |
| `/upload` endpoint | not used | dev-only, do not call | 🟢 |

## 2. SSE event shapes

The built handler only knew about `started/stage/spec/success/failed/log`
with synthetic stage values `PLANNING/BUILDING/VALIDATING/COMPLETED/FAILED`.

Per spec, the real stages emitted are:

- `PROMPT_OPTIMIZER`, `PLANNER`, `VALIDATOR` (uppercase, top-level pipeline phases)
- `Spec Validation`, `Execution Planning`, `Template Loading`, `Template Rendering`,
  `Code Injection`, `Quality Validation`, `Syntax Validation`, `File Writing`
  (mixed case, builder sub-phases)

❌ MUST FIX — backend rewrites these stage names; the current schema only
allowed `PLANNING/BUILDING/VALIDATING/COMPLETED/FAILED`. We need to:
- store the **status** independently from the **stage label**
- accept the canonical stage strings as opaque labels (string column, not enum)
- map `success`/`failed` events to terminal `RunStatus` values

## 3. RunStatus / Stage enums

| Built | Canonical |
|---|---|
| `RunStatus = QUEUED, RUNNING, COMPLETED, FAILED, CANCELLED` | `RunStatus = STARTED, PLANNING, BUILDING, VALIDATING, COMPLETED, FAILED, INTERRUPTED` |
| `Stage = PLANNING, BUILDING, VALIDATING, EXECUTING, COMPLETED, FAILED` | (no enum — phase strings persisted as `errorStage`/log lines) |

❌ MUST FIX — replace `RunStatus` with the spec set, drop `Stage` enum, add
`INTERRUPTED` for upstream-disconnect. Keep `CANCELLED` as a soft alias mapped to `INTERRUPTED` so the user-cancel route still works. Drop `EXECUTING`.

## 4. Domain enum casing

| Built | Canonical |
|---|---|
| `WEB_RESEARCH, DOCUMENT, DATA_TRANSFORM, WEBSITE_BUILDER` | `web_research, document, data_transform, website_builder` |

❌ MUST FIX — Prisma enum values must equal the strings the AI service sends.

## 5. Run model

| Field | Built | Canonical | Action |
|---|---|---|---|
| `aiRunId` | ❌ missing | `ui_xxxx` from AI | add column + unique index |
| `prompt` | `userPrompt` | `prompt` | rename |
| `userId` | optional FK | required FK | tighten to required |
| `validationStatus` | derived from `agentRun.isValid` | `'passed' \| 'failed'` text | add column |
| `validationScore` | only on `agentRun` | int 0-100 on Run | mirror to Run |
| `totalTokens / promptTokens / completionTokens` | ❌ | required cols | add |
| `buildDurationSec` | only `durationMs` | float seconds | derive from durationMs (keep both) |
| `runAudit` | ❌ | full audit JSON | add column |
| `validationReport` | ❌ | full report JSON | add column |
| `generatedCode` | ❌ | text copy of generated file | add column |
| `outputPath` | ❌ | AI service path | add column |
| `attachments` | ❌ | many-to-many via `AttachmentRef` | add |
| `templateId` | ❌ | optional FK | add |
| `deletedAt` | ❌ | soft delete | add |
| `interruptedAt` | ❌ | mid-stream upstream drop timestamp | add |
| `idempotencyKey` | ❌ | optional, unique within 24h | add |

## 6. Sessions

The canonical spec does not mention sessions. The built backend has a full
`Session` model with continuation/expiry semantics.

🟡 REWORK — keep the model (frontend may already rely on it for "workspaces"),
but make `Run.userId` the source of truth and make `Run.sessionId` optional.
Drop the `assertWritable` precondition in the create-run path; sessions become
purely a presentation grouping.

## 7. Modules — coverage matrix

| Module | Built | Canonical | Action |
|---|---|---|---|
| AuthModule | JWT + Google + cookies | + refresh rotation, /api/keys | ⚠️ add refresh tokens, move keys to /api/keys |
| RunsModule | single SSE POST that does both create+stream | split: POST creates, GET /:id/stream proxies | ❌ refactor |
| FilesModule | none | full attachment system, per-user storage, quota, MIME allowlist | ⚠️ build |
| TemplatesModule | basic CRUD + admin approve/reject | fromRunId, instantiate /:id/runs, defaultPrompt, forkedFromId, isPublic | 🟡 extend |
| CreditsModule | none (UsageLog covers usage but not a ledger) | CreditEntry ledger + balance + topup stub | ⚠️ build |
| UsageModule | exists | spec subsumes into CreditsModule | 🟡 keep as analytics, debit happens in CreditsModule |
| PlansModule | full CRUD with maxRuns/maxAgents/etc. | rename: monthlyCredits, maxStoredMB, maxRunsPerDay, priceUSDCents; add UserPlan model | 🟡 refactor field names |
| SubscriptionsModule | exists with stripe stub | spec replaces with UserPlan | 🟡 keep stripe stub but pivot to UserPlan storage |
| AdminModule | users/monitoring | + /api/admin/runs (system-wide), /api/admin/metrics, /api/admin/users/:id/grant-credits | 🟡 add metrics + grant-credits |
| MemoryModule | none | Qdrant per-user vector index, /api/memory/search, embed on success | ⚠️ build (scaffold + interface) |
| HealthModule | basic /health, /health/ready | /health/live + /health/ready with per-dep JSON | 🟡 rename + add Qdrant dep |
| ObservabilityModule | Nest Logger + simple LoggingInterceptor | Pino structured (runId/userId/requestId), OTel traces, /metrics Prometheus | ⚠️ build |
| ApiKeysModule | exists at /apikeys | move to /api/keys | 🟡 prefix change |
| AuditModule | exists | not in spec but useful | 🟢 keep |
| AnalyticsModule | exists | spec collapses into AdminModule + ObservabilityModule | 🟢 keep, treat as admin analytics |
| AgentsModule | exists | spec doesn't mention; AgentRun is purely a join from Run | 🟢 keep for back-compat reads, but mark as legacy |

## 8. Cross-cutting concerns

| Concern | Built | Canonical | Action |
|---|---|---|---|
| Global URL prefix | none | `/api` | ❌ add `app.setGlobalPrefix('api')` (with `excludePrefixes` for `/health`) |
| Multi-tenant isolation | per-route checks | mandatory; Prisma middleware injecting `userId` | ⚠️ add Prisma middleware or interceptor |
| Concurrency limit | counted from DB | Redis-backed counter, 429 (no queue) | ⚠️ add `ConcurrencyGuard` (Redis preferred, DB fallback) |
| SSE proxy lifecycle | combined POST+stream, fetch-based, no heartbeat, no synthetic failed on disconnect | split, lazy upstream open on `/stream`, 15s heartbeat, synthetic `failed: ai_service_disconnected` on drop | ❌ refactor |
| Idempotency | none | `Idempotency-Key` header → unique within 24h | ⚠️ add |
| Cost accounting | UsageLog decrements `User.credits` immediately | wait for terminal event, debit from `run_audit.total_tokens` × pricing, allow negative balance | ❌ refactor |
| AI service health | implicit | `POST /api/runs` returns 503 fast when AI down | ⚠️ add upstream pre-check |
| File ownership | n/a (no files) | NestJS owns; reads AI's generated file at `success`, copies into `Run.generatedCode`, optional cleanup | ⚠️ add |
| Error taxonomy | passes raw upstream string | map `INVALID_SPEC:*` → 400 BAD_SPEC, `sub_agent_failed_*` → 502 LLM_FAILURE, etc. | ⚠️ add `mapAiError` |
| Config validation | nullable env reads | Zod/Joi schema, refuse boot on missing required env | ❌ add zod boot-time validation |
| Logging | Nest default + custom LoggingInterceptor | Pino structured JSON, runId/userId/requestId, prompt/code truncated to 200 chars at INFO | ⚠️ swap to nestjs-pino |
| Tests | none | unit per service + SSE fixtures + integration with testcontainers + e2e against stubbed AI | ⚠️ add |
| OpenAPI | none | annotations on every method + Swagger UI at /api/docs | ⚠️ add |

## 9. Decisions adopted in this audit pass

These mention spec ambiguity vs existing reality. Decisions, not invented behaviour:

1. **Sessions kept** as a workspace concept; runs are owned by `User` directly via `userId`. `Run.sessionId` becomes optional. Frontend can keep using `/sessions/*`.
2. **Refresh tokens** stored in cookies (sliding rotation) — same cookie infrastructure already used for the access token.
3. **Memory module** ships with a clean Qdrant client interface and a no-op fallback when `QDRANT_URL` is unset, so dev environments still boot.
4. **Pino** swapped in via `nestjs-pino` (smallest possible diff). Console output remains pretty in dev.
5. **/api global prefix** applied; `/health/*` excluded so external probes still hit the bare URL.
6. **CANCELLED** kept as a separate `RunStatus` value for explicit user-cancel actions; **INTERRUPTED** is reserved for upstream-disconnect failures, distinct from an explicit cancel.
7. **CreditsModule** is the new ledger; `UsageModule` stays as a per-user **analytics** view that reads from `CreditEntry` and `Run` rather than maintaining its own counters.
8. **AdminAction**, **AuditLog** kept (non-canonical) — they don't conflict with the spec and they back the admin observability requirement.

## 10. Open questions deferred

These are flagged but not blocking:

- **Refresh token revocation list** — currently stateless rotation by cookie; spec doesn't mandate a revocation table. Can be added when needed.
- **OpenTelemetry** — added as scaffold (request id propagation + structured logs). A live OTel exporter is plumbing-only and not implemented in this pass.
- **Stripe payment flow** — left as stub (501 on `/api/credits/topup`) per spec.

---

## Definition of "done" for this audit pass

- Schema migration produced (additive + safe renames where possible).
- Runs SSE proxy split + persistence + heartbeat + synthetic failed.
- Files, Credits, Memory, Observability scaffolding modules merged.
- All routes prefixed with `/api`.
- Config refuses boot on missing required env.
- `tsc --noEmit` and `nest build` clean.
- BACKEND_INTEGRATION.md, .env.example, docker-compose updates committed.
