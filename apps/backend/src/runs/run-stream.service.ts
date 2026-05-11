import { Injectable, Logger } from '@nestjs/common';
import { Domain, Role, RunStatus } from '@prisma/client';
import { Observable } from 'rxjs';
import { promises as fs } from 'fs';
import { resolve, isAbsolute } from 'path';
import { AiProxyService, AiStreamHandle } from './ai-proxy.service';
import { RunsService } from './runs.service';
import { CreditsService } from '../modules/credits/credits.service';
import { MemoryService } from '../modules/memory/memory.service';
import { parseDomain, statusFromStage } from './run-events';
import { SseEvent } from './sse-parser';
import { metrics } from '../modules/observability/metrics';

/**
 * Lazily opens the upstream SSE stream when the client connects to
 * `GET /api/runs/:id/stream`. Forwards events 1:1 with the AI service's
 * shape, persists side effects to the DB, and emits a 15s heartbeat.
 *
 * Design notes:
 *   - Ownership is checked OUTSIDE the Observable (in the controller) so a
 *     403 returns a clean HTTP response, not an SSE error packet.
 *   - The `terminalReceived` flag protects against double-write of credits +
 *     against synthesizing `failed: ai_service_disconnected` after a real
 *     `success`/`failed` was already processed.
 *   - All terminal-state writers (RunsService.markSuccess/markFailed/
 *     markInterrupted) are themselves idempotent — this service is the
 *     belt-and-suspenders second line of defence.
 */
@Injectable()
export class RunStreamService {
  private readonly logger = new Logger(RunStreamService.name);
  private readonly heartbeatMs = 15_000;

  constructor(
    private runs: RunsService,
    private aiProxy: AiProxyService,
    private credits: CreditsService,
    private memory: MemoryService,
  ) {}

  stream(
    runId: string,
    actor: { sub: string; role: Role },
    initialRun: { id: string; userId: string; status: RunStatus },
  ): Observable<{ event?: string; data: any; comment?: string }> {
    return new Observable((subscriber) => {
      let aborted = false;
      let upstreamHandle: AiStreamHandle | null = null;
      let terminalReceived = false;
      let heartbeat: NodeJS.Timeout | null = null;

      const teardown = () => {
        if (aborted) return;
        aborted = true;
        if (heartbeat) clearInterval(heartbeat);
        try {
          upstreamHandle?.abort();
        } catch {
          /* noop */
        }
      };

      // 15s SSE heartbeat — comment-only event keeps proxies/load balancers
      // from killing the socket without polluting the event stream.
      heartbeat = setInterval(() => {
        if (!aborted) subscriber.next({ data: '', comment: 'keep-alive' });
      }, this.heartbeatMs);

      (async () => {
        // Snapshot path: terminal runs are read-only.
        if (
          initialRun.status === RunStatus.COMPLETED ||
          initialRun.status === RunStatus.FAILED ||
          initialRun.status === RunStatus.INTERRUPTED ||
          initialRun.status === RunStatus.CANCELLED
        ) {
          const full = await this.runs.findById(runId, actor);
          subscriber.next({ event: 'snapshot', data: { status: full.status, run: full } });
          subscriber.complete();
          return;
        }

        const run = await this.runs.findById(runId, actor);

        // Open upstream
        try {
          upstreamHandle = await this.aiProxy.openRunStream({
            prompt: run.prompt,
            domain: run.domain as Domain,
          });
          metrics.inc(metrics.aiRequests, { outcome: 'opened' });
        } catch (err: any) {
          metrics.inc(metrics.aiRequests, { outcome: 'failed_to_open' });
          await this.handleTerminalFailure(run.id, run.userId, {
            finalError: 'ai_service_unavailable',
            errorStage: 'connect',
          });
          subscriber.next({
            event: 'failed',
            data: { final_error: 'ai_service_unavailable', error_stage: 'connect' },
          });
          terminalReceived = true;
          subscriber.complete();
          return;
        }

        // Pump events
        try {
          for await (const ev of upstreamHandle.events) {
            if (aborted) break;
            // Forward verbatim FIRST so the client sees events in real time;
            // persistence is the second-class concern.
            subscriber.next({ event: ev.event, data: ev.data });

            try {
              const isTerminal = await this.applyEvent(run.id, run.userId, ev);
              if (isTerminal) {
                terminalReceived = true;
                metrics.inc(metrics.runsTerminated, { status: ev.event ?? 'unknown' });
              }
            } catch (err) {
              this.logger.error(
                `Failed to persist event ${ev.event} for run=${run.id}: ${(err as Error).message}`,
              );
            }
          }

          // Upstream closed cleanly — synthesize a `failed` only if we never
          // saw a terminal AND we haven't been aborted by the client.
          if (!terminalReceived && !aborted) {
            await this.runs.markInterrupted(run.id);
            subscriber.next({
              event: 'failed',
              data: {
                final_error: 'ai_service_disconnected',
                error_stage: 'mid_stream',
              },
            });
          }
          subscriber.complete();
        } catch (err: any) {
          if (aborted) {
            subscriber.complete();
            return;
          }
          // Upstream errored mid-stream.
          if (!terminalReceived) {
            await this.runs.markInterrupted(run.id);
            subscriber.next({
              event: 'failed',
              data: {
                final_error: 'ai_service_disconnected',
                error_stage: 'mid_stream',
                details: err?.message,
              },
            });
          }
          subscriber.complete();
        }
      })().catch((err) => {
        // Anything unexpected — make sure heartbeat dies and we surface as
        // an Observable error (the client gets a stream-level error, not a
        // half-baked event).
        if (heartbeat) clearInterval(heartbeat);
        try {
          upstreamHandle?.abort();
        } catch {
          /* noop */
        }
        subscriber.error(err);
      });

      // RxJS calls this teardown on unsubscribe (client disconnect) AND
      // immediately after subscriber.complete()/error(). It is idempotent.
      return teardown;
    });
  }

  /**
   * Persist DB side effects for a single SSE event. Returns true when the
   * event was a terminal (success/failed) one.
   */
  private async applyEvent(
    runId: string,
    userId: string,
    ev: SseEvent,
  ): Promise<boolean> {
    const evName = ev.event;
    const data = ev.data ?? {};

    if (!evName) return false;

    switch (evName) {
      case 'started': {
        const aiRunId =
          (typeof data.run_id === 'string' && data.run_id) ||
          (typeof data.runId === 'string' && data.runId) ||
          null;
        if (aiRunId) await this.runs.setAiRunId(runId, aiRunId);
        return false;
      }

      case 'stage': {
        const stageName =
          data.stage ?? data.name ?? data.phase ?? data.status ?? '';
        if (!stageName) return false;
        const coarse = statusFromStage(String(stageName));
        await this.runs.updateStage(runId, {
          status: coarse ?? undefined,
          currentStage: String(stageName),
        });
        return false;
      }

      case 'spec': {
        const spec = data.spec ?? data;
        const domain = parseDomain(spec?.domain);
        await this.runs.updateSpec(runId, spec, domain ?? undefined);
        return false;
      }

      case 'success': {
        const generatedCode = await this.readGeneratedCode(data);
        const updated = await this.runs.markSuccess(runId, {
          generatedCode,
          outputPath: data.output_path ?? null,
          runAudit: data.run_audit,
          validationReport: data.validation_report,
          validationStatus: data.validation_status ?? null,
          validationScore:
            typeof data.validation_score === 'number'
              ? Math.round(data.validation_score)
              : null,
          buildDurationSec:
            typeof data.build_duration === 'number' ? data.build_duration : null,
        });

        if (updated && updated.status === RunStatus.COMPLETED) {
          await this.charge(updated, 'success');
          await this.memory.recordSuccessfulRun(updated.id).catch((err) => {
            this.logger.warn(`Memory upsert failed: ${err?.message}`);
          });
        }
        return true;
      }

      case 'failed': {
        const updated = await this.runs.markFailed(runId, {
          finalError: String(
            data.final_error ?? data.error ?? data.message ?? 'pipeline_failed',
          ),
          errorStage: data.error_stage ?? null,
          runAudit: data.run_audit,
          buildDurationSec:
            typeof data.build_duration === 'number' ? data.build_duration : null,
        });
        if (updated && updated.status === RunStatus.FAILED) {
          await this.charge(updated, 'failed');
        }
        return true;
      }

      default:
        return false;
    }
  }

  /**
   * Wraps markFailed for the connect-failure path so we can also charge any
   * tokens that the AI service reported (none, in the connect case, but the
   * codepath is symmetrical with the mid-stream failure handler).
   */
  private async handleTerminalFailure(
    runId: string,
    _userId: string,
    payload: { finalError: string; errorStage: string },
  ) {
    await this.runs.markFailed(runId, payload);
  }

  private async charge(
    updated: { id: string; userId: string; promptTokens: number; completionTokens: number; domain: Domain },
    outcome: 'success' | 'failed',
  ) {
    try {
      await this.credits.debitForRun(updated.userId, updated.id, {
        promptTokens: updated.promptTokens,
        completionTokens: updated.completionTokens,
        metadata: { domain: updated.domain, status: outcome },
      });
    } catch (err) {
      // CreditEntry has @@unique([runId, reason]) — duplicate debits are
      // expected and benign on retry.
      this.logger.debug(
        `Credit debit skipped for run=${updated.id}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Best-effort read of the AI service's generated file. We REFUSE absolute
   * paths that aren't under STORAGE_ROOT or the AI service's known generated
   * dir — the upstream service path is fully untrusted from a security POV.
   */
  private async readGeneratedCode(data: any): Promise<string | null> {
    if (typeof data.code === 'string' && data.code) return data.code;

    const path = data.output_path;
    if (typeof path !== 'string' || !path) return null;

    if (!isAbsolute(path)) {
      this.logger.warn(`Refusing relative output_path: ${path}`);
      return null;
    }
    const normalized = resolve(path);

    // Keep an explicit allow-prefix list. Operators wire the AI service
    // generated dir into here at deploy time (env or config). For now we
    // accept anything inside common locations and refuse the rest with a
    // log so nobody silently exfiltrates /etc/passwd via a malicious
    // upstream output_path.
    const allowedPrefixes = [
      resolve(process.cwd(), 'storage'),
      '/tmp',
      '/var/folders',
      '/app/apps/ai/src/generated_agents',
      'C:\\Users',
    ];
    if (!allowedPrefixes.some((p) => normalized.startsWith(p))) {
      this.logger.warn(`Refusing output_path outside allowlist: ${normalized}`);
      return null;
    }

    try {
      return await fs.readFile(normalized, 'utf-8');
    } catch (err) {
      this.logger.warn(
        `Could not read generated file ${normalized}: ${(err as Error).message}`,
      );
      return null;
    }
  }
}
