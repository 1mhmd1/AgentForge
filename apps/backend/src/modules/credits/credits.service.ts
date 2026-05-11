import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreditReason, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

interface DebitInput {
  promptTokens: number;
  completionTokens: number;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class CreditsService {
  private readonly logger = new Logger(CreditsService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  /**
   * Returns the user's current balance + lifetime tally.
   * `overdraft: true` when balance < 0 — caller (RunsModule) uses this to
   * block new runs while still letting existing ones complete.
   */
  async balance(userId: string) {
    const [agg, breakdown] = await Promise.all([
      this.prisma.creditEntry.aggregate({
        where: { userId },
        _sum: { amount: true },
      }),
      this.prisma.creditEntry.groupBy({
        by: ['reason'],
        where: { userId },
        _sum: { amount: true },
      }),
    ]);
    const balance = agg._sum.amount ?? 0;

    return {
      balance,
      overdraft: balance < 0,
      breakdown: breakdown.map((row) => ({
        reason: row.reason,
        amount: row._sum.amount ?? 0,
      })),
    };
  }

  async listEntries(userId: string, opts: { page?: number; perPage?: number } = {}) {
    const page = opts.page ?? 1;
    const perPage = Math.min(opts.perPage ?? 50, 200);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.creditEntry.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.creditEntry.count({ where: { userId } }),
    ]);
    return { items, total, page, perPage };
  }

  /**
   * Idempotent per (runId, reason) thanks to the unique index on
   * `credit_entries`. A duplicate debit (e.g. from a retried terminal event)
   * is silently skipped.
   *
   * Allowed to drive balance negative — the LLM tokens were already spent.
   */
  async debitForRun(userId: string, runId: string, input: DebitInput) {
    const inputCost =
      (input.promptTokens / 1000) *
      (this.config.get<{ inputPer1k: number }>('pricing')?.inputPer1k ?? 0);
    const outputCost =
      (input.completionTokens / 1000) *
      (this.config.get<{ outputPer1k: number }>('pricing')?.outputPer1k ?? 0);
    const totalCost = inputCost + outputCost;
    if (totalCost <= 0) return null;

    // Stored as integer "credit cents" (1 credit = 1 USD cent).
    const amount = -Math.ceil(totalCost * 100);

    try {
      return await this.prisma.creditEntry.create({
        data: {
          userId,
          runId,
          amount,
          reason: CreditReason.LLM_USAGE,
          metadata: {
            ...(typeof input.metadata === 'object' && input.metadata
              ? (input.metadata as Record<string, unknown>)
              : {}),
            promptTokens: input.promptTokens,
            completionTokens: input.completionTokens,
            inputCostUsd: Number(inputCost.toFixed(6)),
            outputCostUsd: Number(outputCost.toFixed(6)),
          },
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        this.logger.debug(`Credit debit already recorded for run=${runId}`);
        return null;
      }
      throw err;
    }
  }

  async grant(
    userId: string,
    amount: number,
    reason: CreditReason = CreditReason.ADMIN_GRANT,
    metadata?: Prisma.InputJsonValue,
  ) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('grant amount must be a positive integer');
    }
    return this.prisma.creditEntry.create({
      data: { userId, amount: Math.floor(amount), reason, metadata },
    });
  }
}
