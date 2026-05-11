import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Domain, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AgentsService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string, actor: { sub: string; role: Role }) {
    const agent = await this.prisma.agentRun.findUnique({
      where: { id },
      include: {
        run: true,
        template: true,
      },
    });

    if (!agent) throw new NotFoundException('AgentRun not found');

    const isAdmin = actor.role === Role.ADMIN || actor.role === Role.SUPER_ADMIN;
    if (!isAdmin && agent.run.userId !== actor.sub) {
      throw new ForbiddenException('Cannot read this agent run');
    }

    return agent;
  }

  async listForUser(
    userId: string,
    params: { domain?: Domain; status?: string; page?: number; perPage?: number },
  ) {
    const page = params.page ?? 1;
    const perPage = Math.min(params.perPage ?? 20, 100);

    const where: Prisma.AgentRunWhereInput = {
      run: { userId },
    };
    if (params.domain) where.domain = params.domain;
    if (params.status) where.status = params.status as any;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.agentRun.findMany({
        where,
        skip: (page - 1) * perPage,
        take: perPage,
        orderBy: { createdAt: 'desc' },
        include: { run: { select: { id: true, sessionId: true, prompt: true } } },
      }),
      this.prisma.agentRun.count({ where }),
    ]);

    return { items, total, page, perPage };
  }

  /** Admin-only: full list across all users. */
  listAll(params: { domain?: Domain; status?: string; page?: number; perPage?: number }) {
    const page = params.page ?? 1;
    const perPage = Math.min(params.perPage ?? 20, 100);

    const where: Prisma.AgentRunWhereInput = {};
    if (params.domain) where.domain = params.domain;
    if (params.status) where.status = params.status as any;

    return this.prisma.$transaction([
      this.prisma.agentRun.findMany({
        where,
        skip: (page - 1) * perPage,
        take: perPage,
        orderBy: { createdAt: 'desc' },
        include: {
          run: { select: { id: true, userId: true, prompt: true } },
          template: { select: { id: true, name: true } },
        },
      }),
      this.prisma.agentRun.count({ where }),
    ]).then(([items, total]) => ({ items, total, page, perPage }));
  }
}
