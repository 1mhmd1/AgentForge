# FilesModule

Multi-tenant file uploads. Closes the dev-only gap in the AI service's
`/upload` endpoint (which writes to `apps/ai/uploads/` with no per-user
namespacing — see BACKEND_INTEGRATION.md §1).

## Endpoints

| Method | Route | Notes |
|---|---|---|
| POST | `/api/files` | `multipart/form-data` with `file`. Returns the `Attachment` row. |
| GET | `/api/files` | List the caller's attachments. |
| GET | `/api/files/:id` | Metadata. |
| GET | `/api/files/:id/raw` | Download the raw file body. |
| DELETE | `/api/files/:id` | Delete the file + DB row. |

## Storage

- Layout: `STORAGE_ROOT/users/<userId>/<uuid>/<original-name>`
- Per-file size cap: `MAX_UPLOAD_BYTES` (default 5 MB)
- Per-user storage cap: `Plan.maxStoredMB`, falls back to 50 MB when no plan

## MIME allowlist

| MIME | Behavior |
|---|---|
| `text/plain`, `text/markdown`, `text/csv`, `application/json` | Stored + extracted to UTF-8 |
| `application/pdf` | Stored, extraction TODO (PDF text not parsed yet) |
| Anything else | 400 `UNSUPPORTED_MIME` |

## Prompt addendum

When a `POST /api/runs` request includes `attachmentIds`, the controller
calls `FilesService.buildPromptAddendum(userId, attachmentIds)` to produce:

```
<file path="report.txt">
…contents…
</file>

<file path="data.csv">
…contents…
</file>
```

…which is appended to the user's prompt before the AI service is called.
The AI service has no concept of attachments — it just sees a longer prompt.

## Database touch-points

`Attachment`, `AttachmentRef`. Storage quota is computed by aggregating
`Attachment.sizeBytes` for the user.
