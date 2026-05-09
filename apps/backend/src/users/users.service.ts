import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  // ─── Lookups ────────────────────────────────────────────
  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findByGoogleId(googleId: string) {
    return this.prisma.user.findUnique({ where: { googleId } });
  }

  async findByIdOrThrow(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { userPlan: { include: { plan: true } } },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // ─── Mutations ──────────────────────────────────────────
  createUser(data: { email: string; name?: string; passwordHash?: string }) {
    return this.prisma.user.create({ data });
  }

  createGoogleUser(data: { email: string; name: string; googleId: string }) {
    return this.prisma.user.create({ data });
  }

  linkGoogleAccount(userId: string, googleId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { googleId },
    });
  }

  updateMe(userId: string, data: Prisma.UserUpdateInput) {
    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: this.publicProfile(),
    });
  }

  deleteMe(userId: string) {
    return this.prisma.user.delete({ where: { id: userId } });
  }

  // ─── Admin ──────────────────────────────────────────────
  setRole(userId: string, role: Role) {
    return this.prisma.user.update({ where: { id: userId }, data: { role } });
  }

  setSuspended(userId: string, suspended: boolean) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { isSuspended: suspended, status: suspended ? 'SUSPENDED' : 'ACTIVE' },
    });
  }

  setActive(userId: string, active: boolean) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive: active, status: active ? 'ACTIVE' : 'DISABLED' },
    });
  }

  publicProfile(): Prisma.UserSelect {
    return {
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
    };
  }

  /**
   * Returns the current user with their active plan + active subscription.
   * Plan + credits live in their own tables now (UserPlan / CreditEntry); this
   * method joins both.
   */
  async meDetails(userId: string) {
    const [user, balance] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          ...this.publicProfile(),
          userPlan: { include: { plan: true } },
          subscriptions: {
            where: { status: 'ACTIVE' },
            orderBy: { startedAt: 'desc' },
            take: 1,
            include: { plan: true },
          },
        },
      }),
      this.prisma.creditEntry.aggregate({
        where: { userId },
        _sum: { amount: true },
      }),
    ]);
    if (!user) return null;
    return { ...user, credits: balance._sum.amount ?? 0 };
  }
}

export type SafeUser = Pick<
  User,
  | 'id'
  | 'email'
  | 'name'
  | 'avatar'
  | 'role'
  | 'status'
  | 'isActive'
  | 'isSuspended'
  | 'createdAt'
  | 'updatedAt'
>;
