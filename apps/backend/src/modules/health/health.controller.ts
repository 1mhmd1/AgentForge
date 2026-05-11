import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { AiProxyService } from '../../runs/ai-proxy.service';
import { MemoryService } from '../memory/memory.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private ai: AiProxyService,
    private memory: MemoryService,
  ) {}

  @Get('live')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Liveness — process is up' })
  liveness() {
    return {
      status: 'ok',
      env: this.config.get<string>('nodeEnv'),
      uptimeSeconds: Math.round(process.uptime()),
    };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  liveAlias() {
    return this.liveness();
  }

  @Get('ready')
  @ApiOperation({
    summary: 'Readiness — DB + AI service + Qdrant',
    description:
      'Returns 200 only when every required dependency is healthy. Optional dependencies (Qdrant when QDRANT_URL is unset) are reported as `skipped` but do not fail readiness.',
  })
  async readiness(@Res() res: Response) {
    const checks: Record<
      string,
      { status: 'ok' | 'fail' | 'skipped'; latencyMs?: number; details?: string }
    > = {};

    // DB
    {
      const start = Date.now();
      try {
        await this.prisma.$queryRaw`SELECT 1`;
        checks.database = { status: 'ok', latencyMs: Date.now() - start };
      } catch (err) {
        checks.database = {
          status: 'fail',
          latencyMs: Date.now() - start,
          details: (err as Error).message,
        };
      }
    }

    // AI service
    {
      const start = Date.now();
      const ok = await this.ai.ping();
      checks.aiService = {
        status: ok ? 'ok' : 'fail',
        latencyMs: Date.now() - start,
      };
    }

    // Qdrant — optional
    if (this.memory.isLive()) {
      const start = Date.now();
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 2_000);
      try {
        const cfg = this.config.get<{ url: string | null; apiKey: string | null }>('qdrant');
        const headers: Record<string, string> = {};
        if (cfg?.apiKey) headers['api-key'] = cfg.apiKey;
        const r = await fetch(`${cfg?.url}/collections`, {
          method: 'GET',
          headers,
          signal: ctrl.signal,
        });
        checks.qdrant = {
          status: r.ok ? 'ok' : 'fail',
          latencyMs: Date.now() - start,
        };
      } catch (err) {
        checks.qdrant = {
          status: 'fail',
          latencyMs: Date.now() - start,
          details: (err as Error).message,
        };
      } finally {
        clearTimeout(timer);
      }
    } else {
      checks.qdrant = { status: 'skipped', details: 'QDRANT_URL not set' };
    }

    const failed = Object.values(checks).some((c) => c.status === 'fail');
    res.status(failed ? HttpStatus.SERVICE_UNAVAILABLE : HttpStatus.OK).json({
      status: failed ? 'degraded' : 'ready',
      checks,
    });
  }
}
