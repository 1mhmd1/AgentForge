import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RunsService } from './runs.service';

const DEFAULT_MAX_CONCURRENT = 1;

/**
 * Enforces per-user `maxConcurrentRuns`, derived from the user's plan.
 * Uses the Run table as the source of truth for active counts (works without
 * Redis). When a Redis-backed counter is available it can be plugged in here
 * via `redis.incr` / `redis.decr`.
 */
@Injectable()
export class ConcurrencyGuard implements CanActivate {
  private readonly logger = new Logger(ConcurrencyGuard.name);

  constructor(
    private prisma: PrismaService,
    private runs: RunsService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user as { sub?: string } | undefined;
    if (!user?.sub) return true; // let JwtAuthGuard reject first

    const userPlan = await this.prisma.userPlan.findUnique({
      where: { userId: user.sub },
      include: { plan: true },
    });
    const cap = userPlan?.plan?.maxConcurrentRuns ?? DEFAULT_MAX_CONCURRENT;

    const active = await this.runs.countActiveForUser(user.sub);
    if (active >= cap) {
      throw new HttpException(
        {
          message: `Concurrent run limit reached (${cap})`,
          errorCode: 'CONCURRENT_LIMIT',
          details: { active, cap },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
