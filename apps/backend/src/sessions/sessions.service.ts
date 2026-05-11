import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

@Injectable()
export class SessionsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, data: { title?: string; expiresAt?: Date }) {
    return this.prisma.session.create({
      data: {
        userId,
        title: data.title,
        expiresAt: data.expiresAt ?? new Date(Date.now() + DEFAULT_TTL_MS),
      },
    });
  }

  async listForUser(userId: string, includeArchived = false) {
    const where: Prisma.SessionWhereInput = { userId };
    if (!includeArchived) where.isArchived = false;

    return this.prisma.session.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userId: true,
        title: true,
        isArchived: true,
        previousSessionId: true,
        expiresAt: true,
        lastSeenAt: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { runs: true } },
      },
    });
  }

  async findOneOwned(sessionId: string, userId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { _count: { select: { runs: true } } },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (session.userId !== userId) {
      throw new ForbiddenException('You do not own this session');
    }
    return session;
  }

  async update(
    sessionId: string,
    userId: string,
    data: { title?: string; isArchived?: boolean },
  ) {
    await this.findOneOwned(sessionId, userId);
    return this.prisma.session.update({
      where: { id: sessionId },
      data: {
        title: data.title,
        isArchived: data.isArchived,
        lastSeenAt: new Date(),
      },
    });
  }

  async delete(sessionId: string, userId: string) {
    await this.findOneOwned(sessionId, userId);
    return this.prisma.session.delete({ where: { id: sessionId } });
  }

  /**
   * Allowed to read but not produce new runs.
   * Used by RunsService before creating a run.
   */
  async assertWritable(sessionId: string, userId: string) {
    const session = await this.findOneOwned(sessionId, userId);

    if (session.isArchived) {
      throw new ForbiddenException({
        message: 'Session is archived',
        errorCode: 'SESSION_ARCHIVED',
      });
    }

    if (session.expiresAt.getTime() < Date.now()) {
      throw new ForbiddenException({
        message: 'Session expired — create a new one',
        errorCode: 'SESSION_EXPIRED',
      });
    }

    return session;
  }

  touch(sessionId: string) {
    return this.prisma.session.update({
      where: { id: sessionId },
      data: { lastSeenAt: new Date() },
    });
  }
}
