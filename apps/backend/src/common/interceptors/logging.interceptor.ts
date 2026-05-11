import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, finalize, tap } from 'rxjs';
import { metrics } from '../../modules/observability/metrics';

/**
 * Single structured log line per request, plus Prometheus counters.
 *
 * For SSE: the Observable emits many events; we log once on `finalize` so the
 * log volume is per-request, not per-event.
 *
 * Sensitive payloads (prompt, generated code) are NEVER captured here — the
 * controller-level audit log is the right place for that, and it truncates.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const req = ctx.switchToHttp().getRequest();
    const res = ctx.switchToHttp().getResponse();
    const start = Date.now();

    const method = req.method as string;
    const route = (req.route?.path as string | undefined) ?? req.originalUrl;
    const userId = req.user?.sub ?? '-';
    const requestId = req.id ?? '-';

    let errored = false;
    let errorMsg: string | undefined;

    return next.handle().pipe(
      tap({
        error: (err) => {
          errored = true;
          errorMsg = err?.message ?? String(err);
        },
      }),
      finalize(() => {
        const duration = Date.now() - start;
        const status = res.statusCode || (errored ? 500 : 200);

        const line = JSON.stringify({
          msg: errored ? 'request_error' : 'request',
          method,
          url: req.originalUrl,
          status,
          duration_ms: duration,
          userId,
          requestId,
          ...(errorMsg ? { error: errorMsg } : {}),
        });
        if (errored) this.logger.warn(line);
        else this.logger.log(line);

        metrics.inc(metrics.httpRequests, { method, route, status });
        metrics.observe(metrics.httpDuration, duration, { method, route });
      }),
    );
  }
}
