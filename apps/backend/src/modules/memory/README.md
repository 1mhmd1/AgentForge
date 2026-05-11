# MemoryModule

Per-user vector memory backed by Qdrant. The ONLY module that talks to
Qdrant — keep it isolated. The AI service has no Qdrant integration.

## Endpoints

| Method | Route | Notes |
|---|---|---|
| POST | `/api/memory/search` | `{query, limit?}` → semantic search across the caller's history. Returns `{backend, items[]}`. |

## Behavior

- When `QDRANT_URL` is set → search is a real Qdrant `points/search` filtered
  by `userId`.
- When `QDRANT_URL` is missing → falls back to a SQL `LIKE` over `Run.prompt`
  so dev environments still get useful results.

`backend` field on the response is `'qdrant'` or `'fallback'` so the
frontend can flag low-fidelity results.

## Population

`RunStreamService.applyEvent('success')` calls `MemoryService.recordSuccessfulRun(runId)`,
which embeds `prompt + spec.goal` and upserts into Qdrant + `MemoryPoint`.

## Embeddings

Ships with a deterministic, zero-dependency `HashEmbedder` so the module
boots without an external model. Replace with sentence-transformers /
OpenAI / fastembed in production.

## Database touch-points

Writes `MemoryPoint`, reads `Run`. Qdrant writes are best-effort — failures
are logged but do not break the run pipeline.
