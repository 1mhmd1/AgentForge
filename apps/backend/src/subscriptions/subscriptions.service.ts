import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlanInterval, Prisma, SubscriptionStatus } from '@prisma/client';

function addInterval(start: Date, interval: PlanInterval): Date {
  const expiresAt = new Date(start);
  if (interval === PlanInterval.YEARLY) {
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  } else {
    expiresAt.setMonth(expiresAt.getMonth() + 1);
  }
  return expiresAt;
}

@Injectable()
export class SubscriptionsService {
  constructor(private prisma: PrismaService) {}

  async subscribe(userId: string, planId: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan not found');

    // expire previous active subscriptions
    await this.prisma.subscription.updateMany({
      where: { userId, status: SubscriptionStatus.ACTIVE },
      data: { status: SubscriptionStatus.CANCELED, canceledAt: new Date() },
    });

    const startedAt = new Date();
    const expiresAt = addInterval(startedAt, plan.interval);

    const subscription = await this.prisma.subscription.create({
      data: {
        userId,
        planId,
        status: SubscriptionStatus.ACTIVE,
        startedAt,
        expiresAt,
      },
      include: { plan: true, user: true },
    });

    return subscription;
  }

  async cancel(userId: string) {
    const sub = await this.prisma.subscription.findFirst({ where: { userId, status: SubscriptionStatus.ACTIVE } });
    if (!sub) throw new NotFoundException('Active subscription not found');

    return this.prisma.subscription.update({
      where: { id: sub.id },
      data: { status: SubscriptionStatus.CANCELED, canceledAt: new Date() },
      include: { plan: true, user: true },
    });
  }

  // Admin helpers
  async listAll() {
    return this.prisma.subscription.findMany({ include: { user: true, plan: true }, orderBy: { startedAt: 'desc' } });
  }

  async update(id: string, data: Prisma.SubscriptionUpdateInput) {
    const planId = (data as any)?.plan?.connect?.id as string | undefined;
    if (planId) {
      const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
      if (!plan) {
        throw new NotFoundException('Plan not found');
      }
    }

    return this.prisma.subscription.update({ where: { id }, data, include: { user: true, plan: true } });
  }
}
