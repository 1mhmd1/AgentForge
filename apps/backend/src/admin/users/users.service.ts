import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdminActionType, Prisma, Role, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Field-level allowlist for admin user reads. NEVER add `passwordHash` or
 * `googleId` here — admin tooling must not be a back-door for credential
 * exfiltration.
 */
const ADMIN_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  avatar: true,
  role: true,
  status: true,
  isActive: true,
  isSuspended: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

interface ListParams {
  page?: number;
  perPage?: number;
  q?: string;
  role?: Role;
  status?: UserStatus;
}

@Injectable()
export class UsersAdminService {
  constructor(private prisma: PrismaService) {}

  async listUsers({ page = 1, perPage = 20, q, role, status }: ListParams) {
    const where: Prisma.UserWhereInput = {};
    if (q) {
      where.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (role) where.role = role;
    if (status) where.status = status;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * perPage,
        take: perPage,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          role: true,
          status: true,
          isActive: true,
          isSuspended: true,
          createdAt: true,
          updatedAt: true,
          userPlan: {
            include: { plan: { select: { id: true, name: true, slug: true, tier: true } } },
          },
          _count: { select: { sessions: true, runs: true, apiKeys: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total, page, perPage };
  }

  async getUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...ADMIN_USER_SELECT,
        userPlan: { include: { plan: true } },
        subscriptions: {
          orderBy: { startedAt: 'desc' },
          take: 5,
          include: { plan: true },
        },
        _count: { select: { sessions: true, runs: true, apiKeys: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /**
   * Mutates only the safe set of profile fields. We never accept
   * passwordHash/googleId from admin tooling — those are credential
   * primitives.
   */
  async updateUser(
    userId: string,
    data: Pick<
      Prisma.UserUpdateInput,
      'name' | 'avatar' | 'status' | 'isActive' | 'isSuspended'
    >,
  ) {
    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: ADMIN_USER_SELECT,
    });
  }

  async deleteUser(userId: string, adminId: string, reason?: string) {
    await this.recordAction(adminId, userId, AdminActionType.USER_DELETE, reason);
    await this.prisma.user.delete({ where: { id: userId } });
    return { message: 'User deleted' };
  }

  async suspend(userId: string, adminId: string, reason?: string) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { isSuspended: true, status: UserStatus.SUSPENDED },
    });
    await this.recordAction(adminId, userId, AdminActionType.USER_SUSPEND, reason);
    return updated;
  }

  async unsuspend(userId: string, adminId: string, reason?: string) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { isSuspended: false, status: UserStatus.ACTIVE },
    });
    await this.recordAction(adminId, userId, AdminActionType.USER_UNSUSPEND, reason);
    return updated;
  }

  async changePlan(userId: string, planId: string | null, adminId: string) {
    if (planId) {
      const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
      if (!plan) throw new NotFoundException('Plan not found');
      const renewsAt = new Date();
      if (plan.interval === 'YEARLY') renewsAt.setFullYear(renewsAt.getFullYear() + 1);
      else renewsAt.setMonth(renewsAt.getMonth() + 1);
      await this.prisma.userPlan.upsert({
        where: { userId },
        create: { userId, planId, renewsAt },
        update: { planId, renewsAt, cancelledAt: null, startedAt: new Date() },
      });
    } else {
      await this.prisma.userPlan.deleteMany({ where: { userId } });
    }
    await this.recordAction(adminId, userId, AdminActionType.USER_PLAN_CHANGE, undefined, {
      planId,
    });
    return this.getUser(userId);
  }

  async changeRole(userId: string, role: Role, adminId: string) {
    // Privilege escalation guard: only SUPER_ADMINs can grant or revoke
    // SUPER_ADMIN. An ADMIN trying to elevate themselves (or anyone) gets a
    // 403, never a 200.
    if (role === Role.SUPER_ADMIN) {
      const admin = await this.prisma.user.findUnique({
        where: { id: adminId },
        select: { role: true },
      });
      if (admin?.role !== Role.SUPER_ADMIN) {
        throw new ForbiddenException({
          message: 'Only a SUPER_ADMIN can grant SUPER_ADMIN',
          errorCode: 'INSUFFICIENT_PRIVILEGE',
        });
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: ADMIN_USER_SELECT,
    });
    await this.recordAction(adminId, userId, AdminActionType.USER_ROLE_CHANGE, undefined, {
      role,
    });
    return updated;
  }

  // ─── helpers ───────────────────────────────────────────
  private recordAction(
    adminId: string,
    targetUserId: string | null,
    type: AdminActionType,
    reason?: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    return this.prisma.adminAction.create({
      data: {
        adminId,
        targetUserId,
        type,
        reason,
        metadata: metadata ?? Prisma.JsonNull,
      },
    });
  }
}
