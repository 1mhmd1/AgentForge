# CreditsModule

Append-only credit ledger. Single source of truth for "how much does this
user owe / have left". Replaces the per-User `credits` field that earlier
revisions kept on the `User` table.

## Endpoints

| Method | Route | Notes |
|---|---|---|
| GET | `/api/credits/balance` | `{balance, overdraft, breakdown}`. Balance is the sum of every `CreditEntry.amount` (signed integer cents). |
| GET | `/api/credits/entries` | Paginated ledger. |
| POST | `/api/credits/topup` | Returns 501 `TOPUP_NOT_IMPLEMENTED` until billing is wired. |
| POST | `/api/admin/users/:id/grant-credits` | Admin-only positive grant. |

## How runs charge credits

`RunStreamService` calls `CreditsService.debitForRun(userId, runId, {
promptTokens, completionTokens })` at the terminal `success` or `failed`
event. The amount is computed from the real audit tokens × pricing env
vars:

```
inputCost  = promptTokens     / 1000 * LLM_PRICE_INPUT_PER_1K
outputCost = completionTokens / 1000 * LLM_PRICE_OUTPUT_PER_1K
amount     = -ceil((inputCost + outputCost) * 100)   // negative cents
```

A `CreditEntry` row is written even when balance goes negative — the LLM
tokens were already consumed. `RunsController.create` checks the balance
**before** allowing a NEW run; existing runs are not interrupted.

## Database touch-points

Writes/reads `CreditEntry`. Indirectly reads `Run` for normalized token
totals (those are persisted by `RunsService.markSuccess` /
`markFailed`).
