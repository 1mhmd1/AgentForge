import { apiBaseUrl, client, getAccessToken, unwrap } from './client';

export type Domain = 'website_builder' | 'document' | 'web_research' | 'data_transform';

export type RunStatus =
  | 'STARTED'
  | 'PLANNING'
  | 'BUILDING'
  | 'VALIDATING'
  | 'COMPLETED'
  | 'FAILED'
  | 'INTERRUPTED'
  | 'CANCELLED';

export interface RunSummary {
  id: string;
  prompt: string;
  domain: Domain;
  status: RunStatus;
  currentStage?: string | null;
  validationScore?: number | null;
  buildDurationSec?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface RunDetail extends RunSummary {
  spec?: unknown;
  validationReport?: unknown;
  runAudit?: unknown;
  generatedCode?: string | null;
  outputPath?: string | null;
  finalError?: string | null;
  errorStage?: string | null;
}

export interface CreateRunInput {
  prompt: string;
  domain: Domain;
  sessionId?: string;
  templateId?: string;
  attachmentIds?: string[];
}

export interface CreateRunResponse {
  runId: string;
  streamUrl: string;
  status: RunStatus;
}

export async function createRun(input: CreateRunInput): Promise<CreateRunResponse> {
  return unwrap<CreateRunResponse>(client.post('/runs', input));
}

export interface ListRunsParams {
  page?: number;
  perPage?: number;
  domain?: Domain;
  status?: RunStatus;
}

export interface PagedRuns {
  items: RunSummary[];
  page: number;
  perPage: number;
  total: number;
}

export async function listRuns(params: ListRunsParams = {}): Promise<PagedRuns> {
  return unwrap<PagedRuns>(client.get('/runs', { params }));
}

export async function getRun(id: string): Promise<RunDetail> {
  return unwrap<RunDetail>(client.get(`/runs/${id}`));
}

export async function getRunCode(id: string): Promise<string> {
  const res = await client.get<string>(`/runs/${id}/code`, {
    responseType: 'text',
    transformResponse: (v) => v,
  });
  return typeof res.data === 'string' ? res.data : '';
}

export async function cancelRun(id: string): Promise<void> {
  await client.post(`/runs/${id}/cancel`);
}

export async function replayRun(id: string): Promise<CreateRunResponse> {
  return unwrap<CreateRunResponse>(client.post(`/runs/${id}/replay`));
}

/**
 * SSE event names emitted by the backend (proxied from the Python AI service).
 *
 *   started  | run_id, prompt, mcp_enabled
 *   stage    | stage, status, duration, ... (per-node payload)
 *   spec     | spec (planner output)
 *   success  | output_path, code?, run_audit, validation_status, validation_score, validation_report
 *   failed   | final_error, error_stage, details?, run_audit?
 *   snapshot | (only on read-after-completion) { status, run }
 */
export type RunStreamEventName =
  | 'started'
  | 'stage'
  | 'spec'
  | 'success'
  | 'failed'
  | 'snapshot';

export interface RunStreamEvent {
  event: RunStreamEventName;
  data: any;
}

export interface RunStreamHandle {
  close: () => void;
}

/**
 * Opens an SSE stream on `GET /runs/:id/stream`. We use the native
 * EventSource where possible so the browser handles reconnects and parsing
 * for us.
 *
 * EventSource limitations:
 *   - Can't set Authorization headers
 *   - Sends cookies only on same-origin OR when `withCredentials: true` AND
 *     the server returns `Access-Control-Allow-Credentials: true` (our
 *     backend does)
 *
 * In dev (frontend on :5173, backend on :3000) the cookie is cross-origin
 * but the CORS config allows credentials, so EventSource works as long as
 * the user logged in via the same backend origin (cookie was issued for it).
 *
 * For belt-and-suspenders we also append `?access_token=<jwt>` to the URL
 * as a fallback for environments where cookies are stripped. The backend
 * currently ignores query-string tokens, so this is purely future-proofing
 * — if you need it, add a query-string auth strategy on the backend.
 */
export function openRunStream(
  runId: string,
  handlers: {
    onEvent?: (ev: RunStreamEvent) => void;
    onError?: (err: Event) => void;
    onOpen?: () => void;
  },
): RunStreamHandle {
  const token = getAccessToken();
  const tokenQuery = token ? `?access_token=${encodeURIComponent(token)}` : '';
  const url = `${apiBaseUrl()}/runs/${runId}/stream${tokenQuery}`;

  const es = new EventSource(url, { withCredentials: true });
  const dispatch = (name: RunStreamEventName, raw: MessageEvent) => {
    try {
      const data = raw.data ? JSON.parse(raw.data) : {};
      handlers.onEvent?.({ event: name, data });
    } catch (err) {
      handlers.onEvent?.({ event: name, data: { _parseError: String(err), raw: raw.data } });
    }
  };

  es.addEventListener('open', () => handlers.onOpen?.());
  es.addEventListener('started', (e) => dispatch('started', e as MessageEvent));
  es.addEventListener('stage', (e) => dispatch('stage', e as MessageEvent));
  es.addEventListener('spec', (e) => dispatch('spec', e as MessageEvent));
  es.addEventListener('success', (e) => dispatch('success', e as MessageEvent));
  es.addEventListener('failed', (e) => dispatch('failed', e as MessageEvent));
  es.addEventListener('snapshot', (e) => dispatch('snapshot', e as MessageEvent));
  es.addEventListener('error', (e) => handlers.onError?.(e));

  return {
    close: () => {
      try { es.close(); } catch { /* noop */ }
    },
  };
}
