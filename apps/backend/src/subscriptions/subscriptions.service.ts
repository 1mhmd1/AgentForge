import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PlanInterval, Prisma, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from './billing/stripe.service';

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
  constructor(
    private prisma: PrismaService,
    private stripe: StripeService,
  ) {}

  async findActiveForUser(userId: string) {
    return this.prisma.subscription.findFirst({
      where: { userId, status: SubscriptionStatus.ACTIVE },
      include: { plan: true },
      orderBy: { startedAt: 'desc' },
    });
  }

  async historyForUser(userId: string) {
    return this.prisma.subscription.findMany({
      where: { userId },
      include: { plan: true },
      orderBy: { startedAt: 'desc' },
    });
  }

  /**
   * Direct subscribe path used in dev / no Stripe. In production this would
   * be replaced by a successful Stripe webhook.
   */
  async subscribe(userId: string, planId: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan not found');
    if (!plan.active) throw new BadRequestException('Plan is not active');

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

    // Mirror to UserPlan so concurrency / quota checks see the active plan.
    const renewsAt = new Date(expiresAt);
    await this.prisma.userPlan.upsert({
      where: { userId },
      create: { userId, planId, renewsAt },
      update: { planId, renewsAt, cancelledAt: null, startedAt: new Date() },
    });

    return subscription;
  }

  /**
   * Upgrade path. If Stripe is enabled, returns a checkout URL.
   * If not, behaves like subscribe() and returns the new subscription.
   */
  async upgrade(
    userId: string,
    planId: string,
    urls: { successUrl?: string; cancelUrl?: string },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan not found');

    const success =
      urls.successUrl ?? `${process.env.FRONTEND_URL ?? ''}/billing/success`;
    const cancel =
      urls.cancelUrl ?? `${process.env.FRONTEND_URL ?? ''}/billing/cancel`;

    if (this.stripe.isLive()) {
      const session = await this.stripe.createCheckoutSession({
        userId,
        email: user.email,
        planId,
        stripePriceId: undefined,
        successUrl: success,
        cancelUrl: cancel,
      });
      return { mode: 'checkout', checkoutUrl: session.url, sessionId: session.sessionId };
    }

    // No Stripe: directly upgrade.
    const sub = await this.subscribe(userId, planId);
    return { mode: 'direct', subscription: sub };
  }

  async cancel(userId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { userId, status: SubscriptionStatus.ACTIVE },
    });
    if (!sub) throw new NotFoundException('Active subscription not found');

    if (sub.stripeSubscriptionId) {
      await this.stripe.cancelSubscription(sub.stripeSubscriptionId);
    }

    return this.prisma.subscription.update({
      where: { id: sub.id },
      data: { status: SubscriptionStatus.CANCELED, canceledAt: new Date() },
      include: { plan: true, user: true },
    });
  }

  // ─── Admin helpers ─────────────────────────────────────
  listAll() {
    return this.prisma.subscription.findMany({
      include: { user: true, plan: true },
      orderBy: { startedAt: 'desc' },
    });
  }

  async update(id: string, data: Prisma.SubscriptionUpdateInput) {
    const planConnect = (data as any)?.plan?.connect?.id as string | undefined;
    if (planConnect) {
      const plan = await this.prisma.plan.findUnique({ where: { id: planConnect } });
      if (!plan) throw new NotFoundException('Plan not found');
    }

    return this.prisma.subscription.update({
      where: { id },
      data,
      include: { user: true, plan: true },
    });
  }
}
