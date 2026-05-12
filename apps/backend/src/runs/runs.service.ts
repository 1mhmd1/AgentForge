import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AgentRunStatus,
  Domain,
  Prisma,
  Role,
  RunStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SessionsService } from '../sessions/sessions.service';
import { tokensFromAudit } from './run-events';

const IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1000;

const ACTIVE_STATUSES: RunStatus[] = [
  RunStatus.STARTED,
  RunStatus.PLANNING,
  RunStatus.BUILDING,
  RunStatus.VALIDATING,
];

const TERMINAL_STATUSES: RunStatus[] = [
  RunStatus.COMPLETED,
  RunStatus.FAILED,
  RunStatus.CANCELLED,
  RunStatus.INTERRUPTED,
];

interface CreateRunInput {
  userId: string;
  prompt: string;
  domain: Domain;
  sessionId?: string | null;
  templateId?: string | null;
  attachmentIds?: string[];
  idempotencyKey?: string | null;
}

@Injectable()
export class RunsService {
  private readonly logger = new Logger(RunsService.name);

  constructor(
    public prisma: PrismaService,
    private sessions: SessionsService,
  ) {}

  /**
   * Create the Run row in STARTED state. Caller is responsible for opening
   * the AI stream (via /:id/stream) and updating the row from there.
   *
   * Hardened against:
   *   - replay across users (idempotencyKey scoped to userId)
   *   - parallel idempotent submits (catches Prisma P2002 and re-fetches)
   *   - attachments belonging to other users (verified inside the tx)
   *   - sessions that are archived / expired
   */
  async createRun(input: CreateRunInput) {
    if (input.idempotencyKey) {
      const since = new Date(Date.now() - IDEMPOTENCY_WINDOW_MS);
      const existing = await this.prisma.run.findFirst({
        where: {
          userId: input.userId,
          idempotencyKey: input.idempotencyKey,
          createdAt: { gte: since },
        },
        include: { agentRun: true },
      });
      if (existing) return existing;
    }

    if (input.sessionId) {
      // Throws ForbiddenException on archived/expired/foreign sessions.
      await this.sessions.assertWritable(input.sessionId, input.userId);
    }

    if (input.attachmentIds?.length) {
      const own = await this.prisma.attachment.count({
        where: { id: { in: input.attachmentIds }, userId: input.userId },
      });
      if (own !== input.attachmentIds.length) {
        throw new BadRequestException({
          message: 'One or more attachments do not belong to the user',
          errorCode: 'INVALID_ATTACHMENT',
        });
      }
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.run.create({
          data: {
            userId: input.userId,
            sessionId: input.sessionId ?? undefined,
            templateId: input.templateId ?? undefined,
            prompt: input.prompt,
            domain: input.domain,
            status: RunStatus.STARTED,
            idempotencyKey: input.idempotencyKey ?? undefined,
          },
        });
        await tx.agentRun.create({
          data: {
            runId: created.id,
            domain: input.domain,
            status: AgentRunStatus.RUNNING,
          },
        });
        if (input.attachmentIds?.length) {
          await tx.attachmentRef.createMany({
            data: input.attachmentIds.map((attachmentId) => ({
              runId: created.id,
              attachmentId,
            })),
          });
        }
        return created;
      });
    } catch (err) {
      // Two parallel POSTs with the same idempotency key — return the
      // existing row instead of bubbling up the unique-constraint failure.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002' &&
        input.idempotencyKey
      ) {
        const existing = await this.prisma.run.findFirst({
          where: {
            userId: input.userId,
            idempotencyKey: input.idempotencyKey,
          },
          include: { agentRun: true },
        });
        if (existing) return existing;
      }
      throw err;
    }
  }

  /** Mark `aiRunId` once we receive the `started` event from the AI service. */
  async setAiRunId(runId: string, aiRunId: string) {
    // Don't rewrite once set — successive `started` re-emits would be a no-op.
    const r = await this.prisma.run.update({
      where: { id: runId },
      data: { aiRunId },
    });
    return r;
  }

  /**
   * Coarse status + currentStage label updates from `stage` events.
   * Refuses to regress a terminal run (a late stage event after success/failed
   * must NOT flip the status back to BUILDING).
   */
  async updateStage(
    runId: string,
    payload: { status?: RunStatus; currentStage: string },
  ) {
    const updated = await this.prisma.run.updateMany({
      where: {
        id: runId,
        status: { notIn: TERMINAL_STATUSES },
      },
      data: {
        status: payload.status,
        currentStage: payload.currentStage,
      },
    });
    return updated.count > 0;
  }

  /** `spec` event — store on Run + AgentRun in a single transaction. */
  async updateSpec(runId: string, spec: any, domain?: Domain) {
    await this.prisma.$transaction([
      this.prisma.run.update({
        where: { id: runId },
        data: { spec: spec ?? Prisma.JsonNull },
      }),
      this.prisma.agentRun.update({
        where: { runId },
        data: {
          spec: spec ?? Prisma.JsonNull,
          domain: domain ?? undefined,
        },
      }),
    ]);
  }

  /**
   * Terminal `success` event handler — IDEMPOTENT. Re-running on an already
   * terminal row is a no-op (returns the current row).
   */
  async markSuccess(
    runId: string,
    payload: {
      generatedCode?: string | null;
      outputPath?: string | null;
      runAudit?: any;
      validationReport?: any;
      validationStatus?: string | null;
      validationScore?: number | null;
      buildDurationSec?: number | null;
    },
  ) {
    const run = await this.prisma.run.findUnique({ where: { id: runId } });
    if (!run) return null;
    if (TERMINAL_STATUSES.includes(run.status)) return run;

    const completedAt = new Date();
    const durationMs = completedAt.getTime() - run.startedAt.getTime();
    const tokens = tokensFromAudit(payload.runAudit);

    const [updatedRun] = await this.prisma.$transaction([
      this.prisma.run.update({
        where: { id: runId },
        data: {
          status: RunStatus.COMPLETED,
          completedAt,
          durationMs,
          buildDurationSec: payload.buildDurationSec ?? durationMs / 1000,
          generatedCode: payload.generatedCode ?? undefined,
          outputPath: payload.outputPath ?? undefined,
          runAudit: payload.runAudit ?? Prisma.JsonNull,
          validationReport: payload.validationReport ?? Prisma.JsonNull,
          validationStatus: payload.validationStatus ?? undefined,
          validationScore: payload.validationScore ?? undefined,
          totalTokens: tokens.totalTokens,
          promptTokens: tokens.promptTokens,
          completionTokens: tokens.completionTokens,
        },
      }),
      this.prisma.agentRun.update({
        where: { runId },
        data: {
          status: AgentRunStatus.COMPLETED,
          isValid: (payload.validationStatus ?? '').toLowerCase() === 'passed',
          validationScore: payload.validationScore ?? undefined,
          result: payload.validationReport ?? Prisma.JsonNull,
        },
      }),
    ]);

    return updatedRun;
  }

  /** Terminal `failed` event handler — also IDEMPOTENT. */
  async markFailed(
    runId: string,
    payload: {
      finalError: string;
      errorStage?: string | null;
      runAudit?: any;
      buildDurationSec?: number | null;
    },
  ) {
    const run = await this.prisma.run.findUnique({ where: { id: runId } });
    if (!run) return null;
    if (TERMINAL_STATUSES.includes(run.status)) return run;

    const completedAt = new Date();
    const durationMs = completedAt.getTime() - run.startedAt.getTime();
    const tokens = tokensFromAudit(payload.runAudit);

    const [updatedRun] = await this.prisma.$transaction([
      this.prisma.run.update({
        where: { id: runId },
        data: {
          status: RunStatus.FAILED,
          completedAt,
          durationMs,
          buildDurationSec: payload.buildDurationSec ?? durationMs / 1000,
          finalError: payload.finalError,
          errorStage: payload.errorStage ?? undefined,
          runAudit: payload.runAudit ?? Prisma.JsonNull,
          totalTokens: tokens.totalTokens,
          promptTokens: tokens.promptTokens,
          completionTokens: tokens.completionTokens,
        },
      }),
      this.prisma.agentRun.update({
        where: { runId },
        data: {
          status: AgentRunStatus.FAILED,
          isValid: false,
          error: payload.finalError,
        },
      }),
    ]);

    return updatedRun;
  }

  /** Upstream connection died before terminal event. */
  async markInterrupted(runId: string) {
    const run = await this.prisma.run.findUnique({ where: { id: runId } });
    if (!run) return null;
    if (TERMINAL_STATUSES.includes(run.status)) return run;

    const interruptedAt = new Date();
    const durationMs = interruptedAt.getTime() - run.startedAt.getTime();

    const [updated] = await this.prisma.$transaction([
      this.prisma.run.update({
        where: { id: runId },
        data: {
          status: RunStatus.INTERRUPTED,
          completedAt: interruptedAt,
          interruptedAt,
          durationMs,
          finalError: 'ai_service_disconnected',
        },
      }),
      this.prisma.agentRun.update({
        where: { runId },
        data: {
          status: AgentRunStatus.FAILED,
          isValid: false,
          error: 'ai_service_disconnected',
        },
      }),
    ]);
    return updated;
  }

  /** Explicit user-cancel. */
  async cancel(runId: string, actor: { sub: string; role: Role }) {
    const run = await this.prisma.run.findUnique({ where: { id: runId } });
    if (!run || run.deletedAt) throw new NotFoundException('Run not found');
    this.assertOwnership(run, actor);

    if (!ACTIVE_STATUSES.includes(run.status)) {
      throw new ForbiddenException({
        message: `Run is ${run.status} — cannot cancel`,
        errorCode: 'RUN_NOT_CANCELABLE',
      });
    }

    const completedAt = new Date();
    const durationMs = completedAt.getTime() - run.startedAt.getTime();

    await this.prisma.$transaction([
      this.prisma.run.update({
        where: { id: runId },
        data: {
          status: RunStatus.CANCELLED,
          completedAt,
          durationMs,
          finalError: 'cancelled_by_user',
        },
      }),
      this.prisma.agentRun.update({
        where: { runId },
        data: { status: AgentRunStatus.CANCELLED, error: 'cancelled_by_user' },
      }),
    ]);

    return this.prisma.run.findUnique({
      where: { id: runId },
      include: { agentRun: true },
    });
  }

  /**
   * Bulk-cancel every non-terminal run (admin recovery tool). When `userId`
   * is provided, scope to a single user's runs; otherwise sweep system-wide.
   * Returns the number of runs that were transitioned to CANCELLED.
   */
  async cancelAllActive(userId?: string): Promise<{ cancelled: number }> {
    const where = {
      deletedAt: null,
      status: { in: ACTIVE_STATUSES },
      ...(userId ? { userId } : {}),
    };
    const active = await this.prisma.run.findMany({
      where,
      select: { id: true, startedAt: true },
    });
    if (active.length === 0) return { cancelled: 0 };

    const completedAt = new Date();
    const ids = active.map((r) => r.id);

    await this.prisma.$transaction([
      this.prisma.run.updateMany({
        where: { id: { in: ids } },
        data: {
          status: RunStatus.CANCELLED,
          completedAt,
          finalError: 'cancelled_by_admin_bulk',
        },
      }),
      this.prisma.agentRun.updateMany({
        where: { runId: { in: ids } },
        data: { status: AgentRunStatus.CANCELLED, error: 'cancelled_by_admin_bulk' },
      }),
    ]);
    return { cancelled: active.length };
  }

  /** Soft delete — keeps file path on AI service intact, hides from queries. */
  async softDelete(runId: string, actor: { sub: string; role: Role }) {
    const run = await this.prisma.run.findUnique({ where: { id: runId } });
    if (!run || run.deletedAt) throw new NotFoundException('Run not found');
    this.assertOwnership(run, actor);

    return this.prisma.run.update({
      where: { id: runId },
      data: { deletedAt: new Date() },
    });
  }

  // ─── Reads ─────────────────────────────────────────────
  async findById(id: string, actor: { sub: string; role: Role }) {
    const run = await this.prisma.run.findUnique({
      where: { id },
      include: {
        agentRun: true,
        attachments: { include: { attachment: true } },
        template: true,
      },
    });
    if (!run || run.deletedAt) throw new NotFoundException('Run not found');
    this.assertOwnership(run, actor);
    return run;
  }

  /**
   * Cheap ownership check — used by the SSE controller before opening the
   * Observable so a 403 lands as a clean HTTP response (instead of becoming
   * an Observable.error inside the SSE stream).
   */
  async assertCanRead(id: string, actor: { sub: string; role: Role }) {
    const run = await this.prisma.run.findUnique({
      where: { id },
      select: { id: true, userId: true, deletedAt: true, status: true },
    });
    if (!run || run.deletedAt) throw new NotFoundException('Run not found');
    this.assertOwnership(run, actor);
    return run;
  }

  /** Returns just the generated Python source — used by `/api/runs/:id/code`. */
  async findCode(
    id: string,
    actor: { sub: string; role: Role },
  ): Promise<string | null> {
    const run = await this.prisma.run.findUnique({
      where: { id },
      select: { userId: true, deletedAt: true, generatedCode: true },
    });
    if (!run || run.deletedAt) throw new NotFoundException('Run not found');
    this.assertOwnership({ userId: run.userId }, actor);
    return run.generatedCode;
  }

  async list(
    userId: string,
    filter: {
      domain?: Domain;
      status?: RunStatus;
      from?: Date;
      to?: Date;
      page?: number;
      perPage?: number;
    },
  ) {
    const page = filter.page ?? 1;
    const perPage = Math.min(filter.perPage ?? 20, 100);

    const where: Prisma.RunWhereInput = { userId, deletedAt: null };
    if (filter.domain) where.domain = filter.domain;
    if (filter.status) where.status = filter.status;
    if (filter.from || filter.to) {
      where.createdAt = {};
      if (filter.from) where.createdAt.gte = filter.from;
      if (filter.to) where.createdAt.lte = filter.to;
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.run.findMany({
        where,
        skip: (page - 1) * perPage,
        take: perPage,
        orderBy: { createdAt: 'desc' },
        // No agentRun include here — the list view doesn't need it and the
        // join is wasted work for /api/runs which can return hundreds of rows.
        select: {
          id: true,
          userId: true,
          sessionId: true,
          aiRunId: true,
          prompt: true,
          domain: true,
          status: true,
          currentStage: true,
          errorStage: true,
          finalError: true,
          validationStatus: true,
          validationScore: true,
          totalTokens: true,
          buildDurationSec: true,
          startedAt: true,
          completedAt: true,
          createdAt: true,
        },
      }),
      this.prisma.run.count({ where }),
    ]);

    return { items, total, page, perPage };
  }

  async listForSession(sessionId: string, actor: { sub: string; role: Role }) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true, userId: true },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (
      actor.role !== Role.ADMIN &&
      actor.role !== Role.SUPER_ADMIN &&
      session.userId !== actor.sub
    ) {
      throw new ForbiddenException('Not your session');
    }
    return this.prisma.run.findMany({
      where: { sessionId, deletedAt: null },
      include: { agentRun: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Replay = create a brand-new Run with the same prompt/domain/template.
   * Attachment ownership is re-checked because the user may have deleted some
   * since the original run.
   */
  async replay(runId: string, actor: { sub: string; role: Role }) {
    const original = await this.findById(runId, actor);
    const liveAttachmentIds = original.attachments
      .filter((r) => r.attachment && r.attachment.userId === actor.sub)
      .map((r) => r.attachmentId);

    return this.createRun({
      userId: actor.sub,
      prompt: original.prompt,
      domain: original.domain,
      sessionId: original.sessionId ?? null,
      templateId: original.templateId ?? null,
      attachmentIds: liveAttachmentIds,
    });
  }

  /** Per-user concurrency check — used by ConcurrencyGuard. */
  countActiveForUser(userId: string): Promise<number> {
    return this.prisma.run.count({
      where: { userId, deletedAt: null, status: { in: ACTIVE_STATUSES } },
    });
  }

  private assertOwnership(
    run: { userId: string },
    actor: { sub: string; role: Role },
  ) {
    if (
      actor.role !== Role.ADMIN &&
      actor.role !== Role.SUPER_ADMIN &&
      run.userId !== actor.sub
    ) {
      throw new ForbiddenException('Not your run');
    }
  }
}
