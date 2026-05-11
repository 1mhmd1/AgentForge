import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditEvent {
  action: string;
  userId?: string | null;
  resource?: string;
  resourceId?: string;
  ip?: string;
  userAgent?: string;
  success?: boolean;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  async log(event: AuditEvent): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: event.action,
          userId: event.userId ?? null,
          resource: event.resource,
          resourceId: event.resourceId,
          ip: event.ip,
          userAgent: event.userAgent,
          success: event.success ?? true,
          metadata: event.metadata ?? Prisma.JsonNull,
        },
      });
    } catch (err) {
      // Audit must never block the request — but failures must surface.
      this.logger.error(`Failed to write audit log [${event.action}]`, err as Error);
    }
  }

  async list(params: {
    userId?: string;
    action?: string;
    resource?: string;
    page?: number;
    perPage?: number;
  }) {
    const page = params.page ?? 1;
    const perPage = Math.min(params.perPage ?? 50, 200);

    const where: Prisma.AuditLogWhereInput = {};
    if (params.userId) where.userId = params.userId;
    if (params.action) where.action = params.action;
    if (params.resource) where.resource = params.resource;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        skip: (page - 1) * perPage,
        take: perPage,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total, page, perPage };
  }
}
