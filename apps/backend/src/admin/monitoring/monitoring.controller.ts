import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { MonitoringService } from './monitoring.service';
import { AdminRunsQueryDto } from './dto/admin-runs-query.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class MonitoringController {
  constructor(private svc: MonitoringService) {}

  @Get('runs')
  listRuns(@Query() query: AdminRunsQueryDto) {
    return this.svc.listRuns(query);
  }

  @Get('runs/failed')
  failedRuns(@Query('days') days?: string) {
    return this.svc.failedRuns(days ? parseInt(days, 10) : 7);
  }
}
