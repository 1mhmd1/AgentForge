import { Injectable } from '@nestjs/common';
import { Domain, Prisma, RunStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

interface ListParams {
  domain?: Domain;
  status?: RunStatus;
  page?: number;
  perPage?: number;
}

@Injectable()
export class MonitoringService {
  constructor(private prisma: PrismaService) {}

  async listRuns({ domain, status, page = 1, perPage = 25 }: ListParams) {
    const where: Prisma.RunWhereInput = {};
    if (domain) where.domain = domain;
    if (status) where.status = status;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.run.findMany({
        where,
        skip: (page - 1) * perPage,
        take: Math.min(perPage, 200),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          sessionId: true,
          userId: true,
          prompt: true,
          currentStage: true,
          status: true,
          domain: true,
          finalError: true,
          startedAt: true,
          completedAt: true,
          durationMs: true,
          createdAt: true,
          updatedAt: true,
          session: {
            select: {
              id: true,
              userId: true,
              user: { select: { email: true, name: true } },
              createdAt: true,
            },
          },
          agentRun: {
            select: {
              id: true,
              status: true,
              spec: true,
              semanticScore: true,
              validationScore: true,
              error: true,
              repairAttempts: true,
              templateUsed: true,
              templateId: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      }),
      this.prisma.run.count({ where }),
    ]);

    return { items, total, page, perPage };
  }

  failedRuns(days = 7) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return this.prisma.run.findMany({
      where: { status: RunStatus.FAILED, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      include: { agentRun: true, session: { select: { userId: true } } },
    });
  }
}
