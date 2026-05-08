import { Controller, Post, Body, UseGuards, Patch, Param, Delete, Get, ValidationPipe } from '@nestjs/common';
import { PlansService } from './plans.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('plans')
export class PlansController {
  constructor(private plansService: PlansService) {}

  // Public endpoint: get plan by slug
  @Get('slug/:slug')
  async getBySlug(@Param('slug') slug: string) {
    return this.plansService.getBySlug(slug);
  }

  // Admin CRUD
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  async create(@Body(new ValidationPipe({ whitelist: true, transform: true })) dto: CreatePlanDto) {
    return this.plansService.createPlan(dto as any);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id')
  async update(@Param('id') id: string, @Body(new ValidationPipe({ whitelist: true, transform: true })) dto: UpdatePlanDto) {
    return this.plansService.updatePlan(id, dto as any);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.plansService.softDelete(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get()
  async listAll() {
    return this.plansService.listAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.plansService.getById(id);
  }
}
