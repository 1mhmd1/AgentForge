import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MonitoringService {
  constructor(private prisma: PrismaService) {}

  async listRuns(filter: { domain?: string; status?: string } = {}) {
    const where: any = {};
    if (filter.domain) where.domain = filter.domain.trim().toUpperCase();
    if (filter.status) where.status = filter.status.trim().toUpperCase();

    return this.prisma.run.findMany({
      where,
      select: {
        id: true,
        sessionId: true,
        userPrompt: true,
        stage: true,
        status: true,
        domain: true,
        finalError: true,
        createdAt: true,
        updatedAt: true,
        session: {
          select: {
            id: true,
            userId: true,
            createdAt: true,
          },
        },
        agentRun: {
          select: {
            id: true,
            domain: true,
            status: true,
            spec: true,
            semanticScore: true,
            error: true,
            repairAttempts: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
