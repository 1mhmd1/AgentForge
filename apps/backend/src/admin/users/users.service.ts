import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersAdminService {
  constructor(private prisma: PrismaService) {}

  async listUsers(page = 1, perPage = 20, q?: string) {
    const where: any = {};
    if (q) {
      where.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * perPage,
        take: perPage,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          createdAt: true,
          sessions: {
            select: {
              _count: { select: { runs: true } },
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
        totalRuns: user.sessions.reduce((sum, session) => sum + session._count.runs, 0),
      })),
      total,
      page,
      perPage,
    };
  }

  async updateUserRole(userId: string, role: any) {
    return this.prisma.user.update({ where: { id: userId }, data: { role } });
  }

  async updateUserStatus(userId: string, status: any) {
    return this.prisma.user.update({ where: { id: userId }, data: { status } });
  }
}
