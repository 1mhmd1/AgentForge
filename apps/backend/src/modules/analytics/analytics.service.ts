import { Injectable } from '@nestjs/common';
import { AgentRunStatus, RunStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async overview() {
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const since1 = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      totalSessions,
      totalRuns,
      runsLast24h,
      runsLast30d,
      failedRunsLast30d,
      avgValidation,
      totalTemplates,
      activeSubscriptions,
    ] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: UserStatus.ACTIVE, isActive: true } }),
      this.prisma.user.count({ where: { isSuspended: true } }),
      this.prisma.session.count(),
      this.prisma.run.count(),
      this.prisma.run.count({ where: { createdAt: { gte: since1 } } }),
      this.prisma.run.count({ where: { createdAt: { gte: since30 } } }),
      this.prisma.run.count({
        where: { status: RunStatus.FAILED, createdAt: { gte: since30 } },
      }),
      this.prisma.agentRun.aggregate({
        _avg: { validationScore: true, semanticScore: true },
        where: { createdAt: { gte: since30 } },
      }),
      this.prisma.template.count(),
      this.prisma.subscription.count({ where: { status: 'ACTIVE' } }),
    ]);

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        suspended: suspendedUsers,
      },
      sessions: { total: totalSessions },
      runs: {
        total: totalRuns,
        last24h: runsLast24h,
        last30d: runsLast30d,
        failedLast30d: failedRunsLast30d,
        failureRateLast30d:
          runsLast30d > 0 ? failedRunsLast30d / runsLast30d : 0,
      },
      quality: {
        avgValidationScore: avgValidation._avg.validationScore ?? 0,
        avgSemanticScore: avgValidation._avg.semanticScore ?? 0,
      },
      templates: { total: totalTemplates },
      subscriptions: { active: activeSubscriptions },
    };
  }

  async runs(days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [byStatus, byDomain, perDay] = await Promise.all([
      this.prisma.run.groupBy({
        by: ['status'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      }),
      this.prisma.run.groupBy({
        by: ['domain'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      }),
      this.prisma.$queryRaw<{ day: Date; count: bigint }[]>`
        SELECT date_trunc('day', "createdAt") as day, COUNT(*)::bigint as count
        FROM "runs"
        WHERE "createdAt" >= ${since}
        GROUP BY 1
        ORDER BY 1 ASC
      `,
    ]);

    return {
      windowDays: days,
      byStatus: byStatus.map((row) => ({
        status: row.status,
        count: row._count._all,
      })),
      byDomain: byDomain.map((row) => ({
        domain: row.domain,
        count: row._count._all,
      })),
      perDay: perDay.map((row) => ({
        day: row.day,
        count: Number(row.count),
      })),
    };
  }

  async users(days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const [signupsPerDay, byRole, topUsers] = await Promise.all([
      this.prisma.$queryRaw<{ day: Date; count: bigint }[]>`
        SELECT date_trunc('day', "createdAt") as day, COUNT(*)::bigint as count
        FROM "users"
        WHERE "createdAt" >= ${since}
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      this.prisma.user.groupBy({
        by: ['role'],
        _count: { _all: true },
      }),
      this.prisma.user.findMany({
        select: {
          id: true,
          email: true,
          _count: { select: { runs: true } },
        },
        orderBy: { runs: { _count: 'desc' } },
        take: 10,
      }),
    ]);

    return {
      windowDays: days,
      signupsPerDay: signupsPerDay.map((r) => ({
        day: r.day,
        count: Number(r.count),
      })),
      byRole: byRole.map((r) => ({ role: r.role, count: r._count._all })),
      topUsers,
    };
  }

  async templates() {
    const [byDomain, top, statusBreakdown, avgSuccess] = await Promise.all([
      this.prisma.template.groupBy({
        by: ['domain'],
        _count: { _all: true },
        _avg: { successRate: true, usageCount: true },
      }),
      this.prisma.template.findMany({
        orderBy: [{ usageCount: 'desc' }],
        take: 10,
        select: {
          id: true,
          name: true,
          domain: true,
          usageCount: true,
          successRate: true,
          status: true,
        },
      }),
      this.prisma.template.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.template.aggregate({ _avg: { successRate: true } }),
    ]);

    return {
      byDomain: byDomain.map((r) => ({
        domain: r.domain,
        count: r._count._all,
        avgSuccessRate: r._avg.successRate ?? 0,
        avgUsageCount: r._avg.usageCount ?? 0,
      })),
      top,
      statusBreakdown: statusBreakdown.map((r) => ({
        status: r.status,
        count: r._count._all,
      })),
      avgSuccessRate: avgSuccess._avg.successRate ?? 0,
    };
  }

  async agents(days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const [byStatus, repairStats] = await Promise.all([
      this.prisma.agentRun.groupBy({
        by: ['status'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      }),
      this.prisma.agentRun.aggregate({
        where: { createdAt: { gte: since } },
        _avg: { repairAttempts: true },
        _max: { repairAttempts: true },
      }),
    ]);
    return {
      windowDays: days,
      byStatus: byStatus.map((r) => ({
        status: r.status,
        count: r._count._all,
      })),
      repairAttempts: {
        avg: repairStats._avg.repairAttempts ?? 0,
        max: repairStats._max.repairAttempts ?? 0,
      },
      successRate:
        (() => {
          const completed = byStatus.find(
            (r) => r.status === AgentRunStatus.COMPLETED,
          )?._count._all ?? 0;
          const total = byStatus.reduce((acc, r) => acc + r._count._all, 0);
          return total > 0 ? completed / total : 0;
        })(),
    };
  }
}
