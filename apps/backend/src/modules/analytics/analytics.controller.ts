import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { AnalyticsService } from './analytics.service';

@Controller('admin/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class AnalyticsController {
  constructor(private analytics: AnalyticsService) {}

  @Get('overview')
  overview() {
    return this.analytics.overview();
  }

  @Get('runs')
  runs(@Query('days') days?: string) {
    return this.analytics.runs(days ? parseInt(days, 10) : 30);
  }

  @Get('users')
  users(@Query('days') days?: string) {
    return this.analytics.users(days ? parseInt(days, 10) : 30);
  }

  @Get('templates')
  templates() {
    return this.analytics.templates();
  }

  @Get('agents')
  agents(@Query('days') days?: string) {
    return this.analytics.agents(days ? parseInt(days, 10) : 30);
  }
}
