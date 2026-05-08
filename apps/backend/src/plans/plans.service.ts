import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class PlansService {
  constructor(private prisma: PrismaService) {}

  async createPlan(data: Prisma.PlanCreateInput) {
    return this.prisma.plan.create({ data });
  }

  async updatePlan(id: string, data: Prisma.PlanUpdateInput) {
    return this.prisma.plan.update({ where: { id }, data });
  }

  async softDelete(id: string) {
    return this.prisma.plan.update({ where: { id }, data: { active: false, deletedAt: new Date() } });
  }

  async getById(id: string) {
    return this.prisma.plan.findUnique({ where: { id } });
  }

  async getBySlug(slug: string) {
    return this.prisma.plan.findFirst({ where: { slug, active: true, deletedAt: null } });
  }

  async listAll() {
    return this.prisma.plan.findMany({ where: { deletedAt: null }, orderBy: { createdAt: 'desc' } });
  }
}
