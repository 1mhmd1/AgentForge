# RunsModule

Owns the lifecycle of a single AI orchestration execution.

## Endpoints

| Method | Route | Auth | Notes |
|---|---|---|---|
| POST | `/api/runs` | JWT + Concurrency | Validates plan + balance + concurrency, persists `Run` (`STARTED`), returns `{runId, streamUrl}`. Honors `Idempotency-Key` header within 24h. |
| GET (SSE) | `/api/runs/:id/stream` | JWT | Lazily opens upstream AI stream and pipes events. 15s heartbeat. Synthesizes `failed: ai_service_disconnected` on upstream drop. |
| GET | `/api/runs` | JWT | Paginated history filtered by `domain`, `status`, `from`, `to`. |
| GET | `/api/runs/:id` | JWT | Detail (spec, validation report, generated code, audit). |
| GET | `/api/runs/:id/code` | JWT | `text/plain` download of generated Python source. |
| GET | `/api/sessions/:sessionId/runs` | JWT | Runs for a session. |
| POST | `/api/runs/:id/cancel` | JWT | Sets `status = CANCELLED`. |
| POST | `/api/runs/:id/replay` | JWT + Concurrency | Re-create with same prompt/domain/template/attachments. |
| DELETE | `/api/runs/:id` | JWT | Soft delete (`deletedAt`). |

## Database touch-points

- Writes: `Run`, `AgentRun`, `AttachmentRef` (on create), `MemoryPoint` (on success), `CreditEntry` (on success/failure).
- Reads: `Run`, `User`, `UserPlan`, `Attachment`.

## External dependencies

- **AI service** via `AiProxyService` (`POST {AI_SERVICE_URL}/run`). Only sends `{prompt, domain}` per the contract.
- **CreditsService** for token-based debits at terminal events.
- **MemoryService** for Qdrant embedding on success.
- **FilesService** for attachment text extraction.
- **AuditService** for `RUN_CREATE` / `RUN_CANCEL` log entries.

## Concurrency

`ConcurrencyGuard` enforces `Plan.maxConcurrentRuns` per user. Counts
in-flight runs from the `Run` table (`status` ∈ STARTED|PLANNING|BUILDING|VALIDATING).
Replace with a Redis counter for higher throughput when `REDIS_URL` is set.

## SSE proxy lifecycle

See [BACKEND_INTEGRATION.md](../../../BACKEND_INTEGRATION.md) for the full event contract.

```
client GET /api/runs/:id/stream
  ↓
RunStreamService.stream()
  ├─ ownership check
  ├─ if terminal → snapshot + complete
  └─ else AiProxyService.openRunStream({prompt, domain})
       ├─ heartbeat every 15s
       ├─ for each event: forward to client THEN persist
       │    started → setAiRunId
       │    stage   → updateStage (coarse RunStatus + currentStage label)
       │    spec    → updateSpec
       │    success → markSuccess + Credits.debit + Memory.upsert
       │    failed  → markFailed + Credits.debit
       └─ on upstream close without terminal:
            markInterrupted + emit synthetic `failed`
       └─ on client disconnect: abort upstream
```
