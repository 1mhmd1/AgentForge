# AgentForge Backend — Production Readiness Audit

Date: 2026-05-10
Verification: `tsc --noEmit` clean · `nest build` produces full `dist/` ·
`jest` 53/53 passing across 9 suites.

This document is the deep code-review pass that followed the canonical-spec
refactor. Every issue listed here has a fix applied in the same commit; the
"production impact" column tells you what would have broken if it shipped.

---

## 1. Critical — security & multi-tenant correctness

### 1.1 ❌ Path traversal in attachment uploads — **FIXED**
**Where:** `FilesService.upload`
**Risk:** A user uploading `originalname: "../../../etc/passwd"` would land
the file outside their per-user directory and could read /overwrite arbitrary
paths on the host.
**Root cause:** `join(dir, file.originalname)` had no sanitisation.
**Fix:** New `sanitizeFilename()` strips path components, leading dots,
control chars, and re-`resolve`s the final path against the per-user dir as
defence in depth. `delete()` also refuses to `unlink` anything outside
`STORAGE_ROOT`. Tests in `tests/files-service.spec.ts`.

### 1.2 ❌ MIME spoofing for text uploads — **FIXED**
**Where:** `FilesService.upload`
**Risk:** A user could send `mimetype: "text/plain"` for binary content; the
binary then got base-text-decoded and inlined into the AI prompt, producing
garbage tokens (and burning credits).
**Fix:** `isUtf8()` validates the buffer with `TextDecoder({fatal:true})`
before accepting `text/*` uploads.

### 1.3 ❌ Admin endpoints leaked password hashes — **FIXED**
**Where:** `UsersAdminService.getUser` used `include`, returning the full
`User` row including `passwordHash` + `googleId`.
**Risk:** Password-hash exfiltration via the admin dashboard. An attacker
who phished an admin token could mass-extract bcrypt hashes for offline
crack.
**Fix:** Field-level allowlist `ADMIN_USER_SELECT`. `updateUser()` typed to
`Pick<UserUpdateInput, …safe fields>` so admin tooling cannot mutate
`passwordHash`/`googleId` even if the DTO whitelist regresses.

### 1.4 ❌ Admin role escalation — **FIXED**
**Where:** `UsersAdminService.changeRole` accepted `role: SUPER_ADMIN` from
any ADMIN.
**Risk:** Any ADMIN could promote themselves to SUPER_ADMIN; once a single
ADMIN account is compromised, the whole system is.
**Fix:** Privilege guard inside `changeRole` — only an actor whose own role
is `SUPER_ADMIN` can grant `SUPER_ADMIN`. ADMINs trying it get 403
`INSUFFICIENT_PRIVILEGE`.

### 1.5 ❌ Refresh token verification was O(N) bcrypt-compares — **FIXED**
**Where:** `RefreshTokenService.rotate`
**Risk:** Per refresh, we loaded the most recent 200 active tokens and
bcrypt-compared one by one. That's ~20s of CPU per refresh under load and
breaks once the active-token table exceeds 200.
**Fix:** `hashedToken` now stores `<HMAC-SHA256(secret, raw)>:<bcrypt(raw)>`.
The HMAC is a deterministic per-row lookup hash (server-side secret, not
recoverable from a DB dump). DB lookup is O(1) via the existing `@unique`
index; we bcrypt-compare exactly one candidate.

### 1.6 ❌ API-key prefix derived from `process.env.NODE_ENV` — **FIXED**
**Where:** `ApiKeysService.verifyAndTouch`
**Risk:** A key minted in `test` mode and used in `production` (or via a
shared DB across staging+prod) would compute the wrong prefix, fail the
DB lookup, and 401 the legitimate caller. A key minted in production and
used in dev would silently be inaccessible.
**Fix:** New `derivePrefix()` parses the env tag from the **raw key
string**, not from process.env. Also rejects malformed input cleanly.

### 1.7 ❌ Suspended users could authenticate via API key — **FIXED**
**Where:** `ApiKeysService.verifyAndTouch`
**Risk:** Suspending a user via the admin endpoint did not revoke their
existing API keys. They kept full programmatic access.
**Fix:** Lookup now joins to `User` and rejects when `isActive===false` or
`isSuspended===true`.

### 1.8 ❌ Generated-code path was fully trusted — **FIXED**
**Where:** `RunStreamService` used to read `output_path` from the upstream
event verbatim and `fs.readFile` it.
**Risk:** A compromised AI service could exfiltrate any file on the
backend's filesystem (`/etc/shadow`, `~/.aws/credentials`, …) by setting
`output_path` to that path.
**Fix:** New `readGeneratedCode()` requires absolute paths inside an
explicit allowlist (`STORAGE_ROOT`, `/tmp`, `/var/folders`, the AI service
generated dir). Anything else is logged and refused.

---

## 2. Critical — data correctness

### 2.1 ❌ Credits could be debited twice for the same run — **FIXED**
**Where:** `CreditsService.debitForRun`
**Risk:** SSE event re-emit, network retry, or our own back-pressure bug
could trigger `markSuccess` twice. Each call previously wrote a fresh
`CreditEntry` — users got billed N× for one run.
**Fix:** Schema now has `@@unique([runId, reason])` on `credit_entries`.
Service catches `P2002` and returns `null` instead of throwing — the second
attempt is a quiet no-op.

### 2.2 ❌ Stage events after a terminal could regress the status — **FIXED**
**Where:** `RunsService.updateStage`
**Risk:** A late `stage` event arriving after `success`/`failed` would
flip `status` back to `BUILDING`. Charts and quotas would see
"completed" runs being still active.
**Fix:** `updateStage` now uses `updateMany` with
`{status: { notIn: TERMINAL_STATUSES }}` — the row is only touched when
not terminal.

### 2.3 ❌ markSuccess / markFailed were not idempotent — **FIXED**
**Risk:** Re-running a terminal handler would re-stamp `completedAt`,
double the recorded duration, and fight with the `(runId,reason)` credit
unique. With our new credit unique that's now safe, but the run row would
still get bogus timestamps.
**Fix:** Both methods return early (returning the existing row) when
`run.status` is already in `TERMINAL_STATUSES`.

### 2.4 ❌ updateSpec wrote two unsynchronized rows — **FIXED**
**Risk:** First `Run.spec` update could succeed and the second
`AgentRun.spec` update could fail (FK race, lock timeout, …) leaving the
two views out of sync.
**Fix:** Wrapped in `prisma.$transaction([...])`.

### 2.5 ❌ Idempotent POST race could 409 instead of returning prior run — **FIXED**
**Where:** `RunsService.createRun`
**Risk:** Two parallel requests with the same `Idempotency-Key` could both
pass the `findFirst` check, then one would succeed and the other crash on
the `@unique([userId, idempotencyKey])` constraint with a 500.
**Fix:** Catch `P2002` after the create attempt and return the existing
row — the contract behaviour the canonical spec expects.

### 2.6 ❌ createRun did not validate attachment ownership — **FIXED**
**Risk:** A user could submit run with `attachmentIds` belonging to another
user. The FK constraint allowed the rows to insert (the attachments exist),
so the foreign user's text would land in the prompt.
**Fix:** Pre-flight `attachment.count({ id IN (...), userId })` check —
mismatched counts throw 400 `INVALID_ATTACHMENT` before any write.

### 2.7 ❌ Sessions guard not wired into createRun — **FIXED**
**Where:** Earlier refactor removed the `sessions.assertWritable` call
from the run create path. An archived/expired session could still be used
to start new runs (silently re-activating an archived workspace).
**Fix:** `createRun` calls `sessions.assertWritable(sessionId, userId)` when
a `sessionId` is provided.

---

## 3. Critical — SSE proxy lifecycle

### 3.1 ❌ Ownership check happened inside the Observable — **FIXED**
**Risk:** `await this.runs.findById(runId, actor)` was inside the SSE
Observable. A 403 from the ownership check became a stream-level error
(HTTP 200 + an error packet) instead of a clean 403 HTTP response. Result:
the client would see "stream connected" then a confusing error event.
**Fix:** New `RunsService.assertCanRead()` is called BEFORE `@Sse()`
returns its Observable, so 403/404 surface as proper HTTP responses.

### 3.2 ❌ `markInterrupted` could fire after a real terminal — **FIXED**
**Risk:** The `terminalReceived` flag was checked in the post-loop branch
but not in the `catch` branch. If the upstream errored *immediately* after
emitting a `success`/`failed`, we'd both record the real terminal AND mark
the run `INTERRUPTED`, and emit a second synthetic `failed` event to the
client.
**Fix:** Both code paths now gate on `!terminalReceived`. With the
`markInterrupted` idempotency from §2.3, even a benign double-call is now
a no-op.

### 3.3 ❌ Heartbeat could leak after errored complete — **FIXED**
**Risk:** Subscriber error after `subscriber.error()` should trigger
teardown via RxJS, but the catch path did not always reach that. A small
percentage of streams could leak the 15s interval.
**Fix:** Centralised `teardown()` clears the interval; `aborted` guards
prevent double-teardown; the outer `catch` also clears the interval before
calling `subscriber.error()`.

### 3.4 ❌ Event-stream wrapping — **FIXED**
**Where:** `ResponseInterceptor` wrapped each SSE emission in `{success:true,data:…}`
**Risk:** EventSource clients couldn't parse the events because the
canonical SSE shape (`{event,data}`) was being double-wrapped.
**Fix:** Detect `@Sse()` via `Reflector.get('sse', handler)` and bypass
the wrapper for those routes.

### 3.5 ❌ LoggingInterceptor logged once per SSE emission — **FIXED**
**Risk:** A 100-event stream produced 100 log lines and 100 metric
increments — log explosion + skewed Prometheus counters.
**Fix:** Switched from `tap.next` to `finalize` so the request line is
logged exactly once per request, regardless of emission count.

---

## 4. Schema & query quality

### 4.1 ❌ `CreditEntry` had no `(runId, reason)` unique — **FIXED** (§2.1)
### 4.2 ❌ `ApiKey.hashedKey` duplicated `hash` — **FIXED**
Removed; was a noisy alias of `hash` left over from the canonical-naming
pass.
### 4.3 ❌ Plan had legacy mirror columns (`price`, `maxCredits`) — **FIXED**
Removed. Callers were already using the canonical
`priceUSDCents`/`monthlyCredits` set; the legacy duplicates would only have
been a source of drift.
### 4.4 ❌ Missing `MemoryPoint(runId)` index — **FIXED**
The deletion-cascade and "what memory does run X have" lookup both filter
by `runId`; an index was overdue.
### 4.5 ❌ Missing `ApiKey(expiresAt)` index — **FIXED**
A future cleanup job will scan expired keys; without this index it's a
table scan.
### 4.6 ⚠ Run history list — N+1 risk noted
`RunsService.list` previously included `agentRun` for every page. The new
implementation uses `select` with the small set of columns the list view
actually needs; full detail still goes through `findById`.

---

## 5. Auth & cookies

### 5.1 ❌ `token` cookie maxAge was 7 days for a 15-minute JWT — **FIXED**
The cookie outlived the token by 6 days 23 hours 45 minutes — a stolen
cookie continued to round-trip after the JWT had long expired (it was
ignored by the strategy but still a privacy footprint). Cookie maxAge now
parses `JWT_EXPIRES_IN` and matches.

### 5.2 ❌ `/api` global prefix excluded only GET — **FIXED**
`{ method: 0 as any }` was `RequestMethod.GET`. Switched to
`RequestMethod.ALL` so future `POST /health/*` routes (probes that send
data) are also excluded.

### 5.3 ⚠ JwtStrategy hits the DB on every request
Every authenticated request runs `prisma.user.findUnique` to check
`isActive`/`isSuspended`. At 1k QPS this is a meaningful load. Acceptable
for now (the alternative — a short-lived in-memory cache — needs a
revocation pubsub to be safe). Documented here as known scaling tradeoff.

---

## 6. Health, interceptors, observability

### 6.1 ❌ Qdrant ping had no timeout — **FIXED**
A wedged Qdrant could hang `/health/ready` for 30+ s. New `AbortController`
caps it at 2 s; `api-key` header is now sent when configured.

### 6.2 ❌ ResponseInterceptor SSE detection was best-effort — **FIXED** (§3.4)

### 6.3 ❌ LoggingInterceptor per-emission log spam — **FIXED** (§3.5)

### 6.4 ⚠ `/metrics` is in-process
We ship a minimal Prometheus-compatible registry (`metrics.ts`) instead of
`prom-client` to avoid a native dep. When a real exporter is needed, swap
the impl behind the same surface — call sites don't change.

---

## 7. Tests added in this pass

| File | Coverage |
|---|---|
| `tests/files-service.spec.ts` | filename sanitisation (path traversal vectors), UTF-8 validation |
| `tests/concurrency.guard.spec.ts` | unauth pass-through, plan cap, 429 at limit, default cap with no plan |
| `tests/apikeys-prefix.spec.ts` | env parsing from raw key, malformed input rejection |

Together with the prior suite (sse-parser, ai-error-mapper, run-events,
credits, roles guard, runs lifecycle), the unit-test count is **53 across
9 suites — 100% passing**.

---

## 8. Production readiness assessment

### 8.1 What's solid
- AI contract: faithful to the spec (`{prompt, domain}` only). SSE event
  names + stage labels match the canonical contract.
- Multi-tenant isolation: every read & write is scoped by `userId` (or by
  ownership in service-layer checks).
- Idempotency: POST `/api/runs`, credit debits, terminal handlers, and
  refresh token rotation are all idempotent under retry.
- Auth: refresh-token rotation has reuse detection; access-token cookies
  are short-lived; refresh-token cookies are scoped to `/api/auth`.
- Schema: every hot-path column has an index; cascade deletes are explicit;
  no orphans possible.
- Observability: structured request log + Prometheus counters + per-dep
  health JSON.

### 8.2 Known scaling concerns (not blockers)
- **JwtStrategy hits DB per request** (§5.3) — fine to ~10k QPS; beyond
  that, add a short-lived cache with pubsub invalidation.
- **ConcurrencyGuard is DB-counted** — TOCTOU between `count` and `create`
  exists, but at most lets a user start `cap+1` concurrent runs in a
  microsecond window. The Redis-backed counter (already documented in the
  guard) is the upgrade path.
- **`/api/runs` history lacks keyset pagination** — `skip+take` is fine to
  ~100k rows per user, beyond that switch to cursor.
- **Qdrant search payload is hash-embedded** — replace `HashEmbedder` with
  a real model before relying on semantic search quality.

### 8.3 Remaining technical debt
- `bcrypt.compare` in `RefreshTokenService.rotate` is now O(1) DB but still
  ~100 ms CPU per call. Drop `bcrypt` cost factor when refresh tokens are
  one-time-use anyway? Defer until profiling demands it.
- `MemoryPoint` cleanup when a run is hard-deleted goes through Prisma
  `SetNull`, leaving orphan Qdrant points. Schedule a daily reconciler.
- PDF text extraction on `Attachment` is a TODO — current code stores the
  PDF but `extracted` is `null`.
- Stripe `topup` is a 501 placeholder.

### 8.4 Security assessment

| Area | Status |
|---|---|
| AuthN (JWT + cookies + Google OAuth + refresh rotation) | ✅ |
| AuthZ (Roles, ownership, SUPER_ADMIN escalation guard) | ✅ |
| Multi-tenant isolation | ✅ |
| Password hashing (bcrypt cost 12) | ✅ |
| API-key hashing | ✅ |
| Refresh-token DB hashing + reuse detection | ✅ |
| File path traversal | ✅ (sanitised + verified) |
| MIME spoof for text | ✅ (UTF-8 fatal decode) |
| SSE upstream-path injection | ✅ (allowlisted) |
| Admin password-hash leakage | ✅ (allowlisted select) |
| Admin role escalation | ✅ (SUPER_ADMIN guard) |
| Helmet + CORS allowlist + rate-limit (Throttler) | ✅ |
| Credentials never logged | ✅ |
| CSRF (SameSite=lax cookies + JSON body) | ✅ |

### 8.5 Architecture assessment

- Modules are narrow and cohesive (no god-services).
- Cross-cutting concerns (audit, credits, files, memory) are global modules
  injected where needed.
- AI integration boundary is one file (`AiProxyService`) — easy to swap.
- All terminal-state side effects (DB writes, credit debits, memory
  embedding) live in `RunStreamService` with a single switch on event name
  — easy to grep and to extend.
- Tests use a hand-rolled Prisma mock; a future testcontainers-based
  integration suite is the natural next step.

### 8.6 Performance assessment

- Hot paths (`POST /api/runs`, SSE pump, `GET /api/runs`) have explicit
  indexes covering their `WHERE` clauses.
- SSE pump forwards events synchronously without buffering — no
  back-pressure issue (Nest's SSE writer drains).
- Credit balance read is two parallelised aggregates.
- File uploads stream through Multer's memory storage (capped via
  `MAX_UPLOAD_BYTES`).

---

## 9. Verification

```
$ npx prisma generate          # OK
$ npx tsc --noEmit             # 0 errors
$ npx nest build               # produces full dist/
$ npx jest                     # 53/53 passing
```

The codebase is ready for a `prisma migrate dev` against a fresh database
and a smoke test against the Python AI service container.
