import { client, unwrap } from './client';

export interface UploadedAttachment {
  id: string;
  filename: string;
  mimetype: string;
  sizeBytes: number;
  createdAt: string;
}

/**
 * Uploads a single file to `POST /api/files` (multipart/form-data) and returns
 * the persisted Attachment record. The returned `id` is what `createRun()`
 * accepts inside `attachmentIds: string[]`.
 *
 * Backend MIME allowlist: text/plain, text/markdown, text/csv,
 * text/tab-separated-values, text/xml, application/xml, application/json,
 * application/x-ndjson, application/pdf,
 * application/vnd.openxmlformats-officedocument.spreadsheetml.sheet (xlsx).
 */
export async function uploadAttachment(file: File): Promise<UploadedAttachment> {
  const form = new FormData();
  form.append('file', file);
  return unwrap<UploadedAttachment>(
    client.post('/files', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  );
}

/**
 * Best-effort MIME normaliser. Browsers leave .csv/.tsv/.jsonl/.xml/.xlsx
 * with empty or odd MIME types on different OSes; we pick a known-good
 * canonical value before sending so the backend's allowlist accepts it.
 *
 * Falls back to `file.type` if the extension isn't recognised.
 */
export function inferUploadMime(file: File): string {
  const lower = (file.name || '').toLowerCase();
  if (lower.endsWith('.csv')) return 'text/csv';
  if (lower.endsWith('.tsv') || lower.endsWith('.tab')) return 'text/tab-separated-values';
  if (lower.endsWith('.jsonl') || lower.endsWith('.ndjson')) return 'application/x-ndjson';
  if (lower.endsWith('.json')) return 'application/json';
  if (lower.endsWith('.xml')) return 'application/xml';
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'text/markdown';
  if (lower.endsWith('.txt')) return 'text/plain';
  if (lower.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  return file.type || 'application/octet-stream';
}

export async function uploadAttachmentTyped(file: File): Promise<UploadedAttachment> {
  const mime = inferUploadMime(file);
  if (file.type === mime) return uploadAttachment(file);
  const retyped = new File([file], file.name, { type: mime });
  return uploadAttachment(retyped);
}
