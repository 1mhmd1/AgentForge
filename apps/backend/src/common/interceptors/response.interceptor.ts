import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, map } from 'rxjs';

export interface ApiResponse<T> {
  success: true;
  data: T;
}

const SSE_METADATA_KEY = 'sse';

@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T> | T>
{
  constructor(private reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T> | T> {
    // SSE handlers carry the `sse` metadata set by Nest's `@Sse()` decorator.
    // Their Observable emits one event PER message — we must not wrap each
    // emission with `{success:true,data:...}` or the EventSource client breaks.
    const isSse = !!this.reflector.get<string | boolean>(
      SSE_METADATA_KEY,
      context.getHandler(),
    );

    if (isSse) return next.handle();

    // Defensive header check covers the case where a controller calls @Res()
    // and writes its own response (we shouldn't wrap headers we didn't send).
    const response = context.switchToHttp().getResponse();
    const ctype = response?.getHeader?.('content-type')?.toString?.() ?? '';
    if (ctype.includes('text/event-stream') || ctype.includes('text/plain')) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => {
        if (data && typeof data === 'object' && 'success' in (data as any)) {
          return data;
        }
        return { success: true, data } as ApiResponse<T>;
      }),
    );
  }
}
