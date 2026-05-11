import { Injectable, Logger } from '@nestjs/common';
import { Prisma, UsageType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface UsageEntry {
  userId: string;
  runId?: string | null;
  type: UsageType;
  tokensInput?: number;
  tokensOutput?: number;
  durationMs?: number;
  filesGenerated?: number;
  storageBytes?: number;
  creditsConsumed?: number;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class UsageService {
  private readonly logger = new Logger(UsageService.name);

  constructor(private prisma: PrismaService) {}

  async record(entry: UsageEntry) {
    try {
      await this.prisma.usageLog.create({
        data: {
          userId: entry.userId,
          runId: entry.runId ?? null,
          type: entry.type,
          tokensInput: entry.tokensInput ?? 0,
          tokensOutput: entry.tokensOutput ?? 0,
          durationMs: entry.durationMs ?? 0,
          filesGenerated: entry.filesGenerated ?? 0,
          storageBytes: entry.storageBytes ?? 0,
          creditsConsumed: entry.creditsConsumed ?? 0,
          metadata: entry.metadata ?? Prisma.JsonNull,
        },
      });
      // Credit decrement now lives in CreditsService (single ledger of truth);
      // this method is purely an analytics breadcrumb.
    } catch (err) {
      this.logger.error('Failed to record usage', err as Error);
    }
  }

  /**
   * Caller's usage in a rolling N-day window.
   */
  async forUser(userId: string, days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [totals, recent] = await this.prisma.$transaction([
      this.prisma.usageLog.aggregate({
        where: { userId, createdAt: { gte: since } },
        _sum: {
          tokensInput: true,
          tokensOutput: true,
          durationMs: true,
          filesGenerated: true,
          storageBytes: true,
          creditsConsumed: true,
        },
        _count: { _all: true },
      }),
      this.prisma.usageLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    return {
      windowDays: days,
      totals: totals._sum,
      eventCount: totals._count._all,
      recent,
    };
  }

  /**
   * Counts how many runs the user kicked off in the current calendar month.
   */
  async runsThisMonth(userId: string): Promise<number> {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);

    return this.prisma.usageLog.count({
      where: { userId, type: UsageType.RUN, createdAt: { gte: start } },
    });
  }
}
