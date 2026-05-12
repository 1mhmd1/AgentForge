import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Domain } from '@prisma/client';
import { SseEvent, SseParser } from './sse-parser';

export interface AiRunRequest {
  prompt: string;
  domain: Domain;
  attachmentFilename?: string;
  attachmentMimetype?: string;
  /** Base64-encoded raw file bytes. Empty/undefined when no attachment. */
  attachmentContentB64?: string;
}

export interface AiStreamHandle {
  events: AsyncIterable<SseEvent>;
  abort: () => void;
}

/**
 * Thin wrapper around the Python AI service. Sends ONLY the contract fields
 * the service understands (`prompt`, `domain`) — never injects sessionId,
 * runId, or any other backend-internal value.
 */
@Injectable()
export class AiProxyService {
  private readonly logger = new Logger(AiProxyService.name);

  constructor(private config: ConfigService) {}

  baseUrl(): string {
    return (
      this.config.get<{ serviceUrl: string }>('ai')?.serviceUrl ??
      'http://localhost:4000'
    ).replace(/\/$/, '');
  }

  timeoutMs(): number {
    return this.config.get<{ timeoutMs: number }>('ai')?.timeoutMs ?? 120_000;
  }

  /**
   * Cheap up-check used by `POST /api/runs` and `/health/ready`. We hit
   * `GET /` rather than a deeper endpoint because the AI service exposes
   * its dev UI there and returns 200 quickly even when busy.
   */
  async ping(): Promise<boolean> {
    try {
      const controller = new AbortController();
      // 6s rather than 2s: Node 25's built-in fetch keeps a global keep-alive
      // pool. On the first ping after a quiet period the cached socket can be
      // half-dead and the abort fires before undici notices. A wider window
      // gives the dispatcher time to recycle the connection.
      const timer = setTimeout(() => controller.abort(), 6_000);
      try {
        const res = await fetch(this.baseUrl() + '/', {
          method: 'GET',
          // Force a fresh socket per ping so a stale pooled connection (Node 25
          // ERR_INTERNAL_ASSERTION / aborted-by-pool symptom) doesn't surface
          // here as a false negative.
          headers: { Connection: 'close' },
          signal: controller.signal,
        });
        return res.ok;
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      this.logger.warn(`AI service ping failed: ${(err as Error).message}`);
      return false;
    }
  }

  async openRunStream(req: AiRunRequest): Promise<AiStreamHandle> {
    const controller = new AbortController();
    const url = `${this.baseUrl()}/run`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          // Force a fresh socket per stream. Node 25's built-in fetch reuses
          // sockets from an undici keep-alive pool; a half-dead pooled socket
          // surfaces here as the stream closing mid-event with no visible
          // error. `Connection: close` only affects socket reuse AFTER the
          // response finishes — it does NOT close the long-lived SSE
          // response itself, so events keep flowing for the full run.
          Connection: 'close',
        },
        body: JSON.stringify({
          prompt: req.prompt,
          domain: req.domain,
          ...(req.attachmentContentB64
            ? {
                attachment_filename: req.attachmentFilename,
                attachment_mimetype: req.attachmentMimetype,
                attachment_content_b64: req.attachmentContentB64,
              }
            : {}),
        }),
        signal: controller.signal,
      });
    } catch (err) {
      throw new ServiceUnavailableException({
        message: 'AI service unavailable',
        errorCode: 'AI_SERVICE_UNAVAILABLE',
        details: { reason: (err as Error).message },
      });
    }

    if (!response.ok || !response.body) {
      const text = await response.text().catch(() => '');
      throw new ServiceUnavailableException({
        message: 'AI service rejected request',
        errorCode: 'AI_SERVICE_ERROR',
        details: { status: response.status, body: text.slice(0, 1000) },
      });
    }

    const events = this.iterateEvents(response.body as any);
    return { events, abort: () => controller.abort() };
  }

  private async *iterateEvents(
    body: ReadableStream<Uint8Array> | NodeJS.ReadableStream,
  ): AsyncGenerator<SseEvent> {
    const parser = new SseParser();

    if ((body as any).getReader) {
      const reader = (body as ReadableStream<Uint8Array>).getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = Buffer.from(value).toString('utf-8');
          for (const ev of parser.feed(chunk)) yield ev;
        }
      } finally {
        try {
          reader.releaseLock();
        } catch {
          /* noop */
        }
      }
      return;
    }

    for await (const chunk of body as NodeJS.ReadableStream) {
      const text =
        typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8');
      for (const ev of parser.feed(text)) yield ev;
    }
  }
}
