import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PlansService } from './plans.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

@ApiTags('plans')
@Controller()
export class PlansController {
  constructor(private plans: PlansService) {}

  @Get('plans')
  @ApiOperation({ summary: 'Public plan list' })
  list() {
    return this.plans.listPublic();
  }

  @Get('plans/slug/:slug')
  getBySlug(@Param('slug') slug: string) {
    return this.plans.getBySlug(slug);
  }

  @Get('plans/:id')
  getById(@Param('id') id: string) {
    return this.plans.getById(id);
  }

  // ─── Caller's plan ────────────────────────────────────
  @Get('plans/me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Caller’s current plan + renewal date' })
  me(@CurrentUser('sub') userId: string) {
    return this.plans.getMine(userId);
  }

  @Post('plans/me/assign/:planId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Assign caller to a plan (dev path; Stripe replaces)' })
  assignToMe(
    @Param('planId') planId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.plans.assignToUser(userId, planId);
  }

  @Post('plans/me/cancel')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  cancelMine(@CurrentUser('sub') userId: string) {
    return this.plans.cancelMine(userId);
  }

  // ─── Admin ────────────────────────────────────────────
  @Get('admin/plans')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  listAll() {
    return this.plans.listAll();
  }

  @Post('admin/plans')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  create(@Body() dto: CreatePlanDto) {
    return this.plans.createPlan(dto);
  }

  @Patch('admin/plans/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.plans.updatePlan(id, dto);
  }

  @Delete('admin/plans/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  remove(@Param('id') id: string) {
    return this.plans.softDelete(id);
  }
}
