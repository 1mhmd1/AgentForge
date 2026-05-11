import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Optional Redis abstraction. Two backends:
 *
 *   USE_REDIS=true + REDIS_URL set -> tries to load `ioredis` dynamically. If
 *     the package is installed and a connection succeeds, real Redis is used.
 *     If `ioredis` is NOT installed (it isn't a hard dependency) OR the
 *     connection fails on boot, we log a warning and fall through to the
 *     in-memory backend so the process still starts.
 *
 *   Otherwise -> a tiny in-memory Map-backed implementation that supports the
 *     subset of operations the rest of the codebase uses (get/set with TTL,
 *     incr, del). This is process-local: it does NOT distribute state across
 *     workers, but it lets every consumer call the same interface regardless
 *     of whether Redis is wired up.
 *
 * Core AI pipeline never imports this directly — it stays usable as a
 * future plug point for rate limiting, distributed concurrency counters,
 * SSE fan-out, etc.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: any = null;
  private readonly mem = new Map<string, { value: string; expiresAt: number | null }>();
  private sweeper: NodeJS.Timeout | null = null;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const cfg = this.config.get<{ url: string | null; enabled: boolean }>('redis');
    if (!cfg?.enabled || !cfg.url) {
      this.logger.log('Redis disabled (USE_REDIS!=true or REDIS_URL unset) - using in-memory fallback');
      this.startMemSweeper();
      return;
    }

    try {
      // Dynamic import so the backend boots even if `ioredis` isn't installed.
      // We bounce through `Function` so the TypeScript compiler doesn't try to
      // resolve the module path at build time — ioredis is intentionally an
      // optional runtime dependency.
      const dynImport = new Function('p', 'return import(p)') as (p: string) => Promise<any>;
      const mod = await dynImport('ioredis').catch(() => null);
      const IORedis = mod?.default ?? mod?.Redis ?? mod;
      if (!IORedis) {
        this.logger.warn('USE_REDIS=true but `ioredis` is not installed - falling back to in-memory store. Run `pnpm add ioredis` in apps/backend to enable real Redis.');
        this.startMemSweeper();
        return;
      }
      this.client = new IORedis(cfg.url, {
        lazyConnect: true,
        maxRetriesPerRequest: 2,
        enableReadyCheck: true,
      });
      this.client.on('error', (err: Error) => {
        this.logger.warn(`Redis error: ${err.message}`);
      });
      await this.client.connect();
      this.logger.log(`Redis connected: ${cfg.url}`);
    } catch (err) {
      this.logger.warn(
        `Redis connection failed (${(err as Error).message}) - falling back to in-memory store`,
      );
      this.client = null;
      this.startMemSweeper();
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.sweeper) clearInterval(this.sweeper);
    if (this.client) {
      try {
        await this.client.quit();
      } catch {
        /* noop */
      }
    }
  }

  isReady(): boolean {
    return !!this.client;
  }

  async get(key: string): Promise<string | null> {
    if (this.client) return (await this.client.get(key)) ?? null;
    const entry = this.mem.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt < Date.now()) {
      this.mem.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (this.client) {
      if (ttlSeconds && ttlSeconds > 0) {
        await this.client.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, value);
      }
      return;
    }
    this.mem.set(key, {
      value,
      expiresAt: ttlSeconds && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null,
    });
  }

  async del(key: string): Promise<void> {
    if (this.client) {
      await this.client.del(key);
      return;
    }
    this.mem.delete(key);
  }

  async incr(key: string): Promise<number> {
    if (this.client) return await this.client.incr(key);
    const cur = await this.get(key);
    const next = (cur ? parseInt(cur, 10) || 0 : 0) + 1;
    await this.set(key, String(next));
    return next;
  }

  private startMemSweeper(): void {
    if (this.sweeper) return;
    // Sweep expired keys every 60s. Cheap; bounded by number of keys this
    // process holds, which is small for the current usage (no real consumers
    // yet).
    this.sweeper = setInterval(() => {
      const now = Date.now();
      for (const [k, v] of this.mem) {
        if (v.expiresAt !== null && v.expiresAt < now) this.mem.delete(k);
      }
    }, 60_000);
    this.sweeper.unref?.();
  }
}
