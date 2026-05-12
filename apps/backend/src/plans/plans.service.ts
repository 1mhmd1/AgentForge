import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PlansService {
  constructor(private prisma: PrismaService) {}

  createPlan(data: any) {
    // Mirror canonical → legacy fields so old admin tooling keeps reading.
    const enriched = {
      ...data,
      price: data.priceUSDCents != null ? data.priceUSDCents / 100 : 0,
      maxCredits: data.monthlyCredits ?? 0,
    };
    return this.prisma.plan.create({ data: enriched as Prisma.PlanCreateInput });
  }

  updatePlan(id: string, data: any) {
    const enriched: any = { ...data };
    if (data.priceUSDCents != null) enriched.price = data.priceUSDCents / 100;
    if (data.monthlyCredits != null) enriched.maxCredits = data.monthlyCredits;
    return this.prisma.plan.update({ where: { id }, data: enriched });
  }

  softDelete(id: string) {
    return this.prisma.plan.update({
      where: { id },
      data: { active: false, deletedAt: new Date() },
    });
  }

  async getById(id: string) {
    const p = await this.prisma.plan.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Plan not found');
    return p;
  }

  async getBySlug(slug: string) {
    const p = await this.prisma.plan.findFirst({
      where: { slug, active: true, deletedAt: null },
    });
    if (!p) throw new NotFoundException('Plan not found');
    return p;
  }

  listPublic() {
    return this.prisma.plan.findMany({
      where: { active: true, deletedAt: null },
      orderBy: [{ priceUSDCents: 'asc' }, { createdAt: 'desc' }],
    });
  }

  listAll() {
    return this.prisma.plan.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── UserPlan ──────────────────────────────────────────
  async assignToUser(userId: string, planId: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan not found');
    if (!plan.active) throw new BadRequestException('Plan is not active');

    const renewsAt = new Date();
    if (plan.interval === 'YEARLY') renewsAt.setFullYear(renewsAt.getFullYear() + 1);
    else renewsAt.setMonth(renewsAt.getMonth() + 1);

    return this.prisma.userPlan.upsert({
      where: { userId },
      create: { userId, planId, renewsAt },
      update: { planId, renewsAt, cancelledAt: null, startedAt: new Date() },
    });
  }

  getMine(userId: string) {
    return this.prisma.userPlan.findUnique({
      where: { userId },
      include: { plan: true },
    });
  }

  cancelMine(userId: string) {
    return this.prisma.userPlan.update({
      where: { userId },
      data: { cancelledAt: new Date() },
    });
  }
}
