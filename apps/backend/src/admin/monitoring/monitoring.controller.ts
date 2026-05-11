import { Controller, Get, HttpCode, HttpStatus, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { MonitoringService } from './monitoring.service';
import { AdminRunsQueryDto } from './dto/admin-runs-query.dto';
import { RunsService } from '../../runs/runs.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class MonitoringController {
  constructor(
    private svc: MonitoringService,
    private runs: RunsService,
  ) {}

  @Get('runs')
  listRuns(@Query() query: AdminRunsQueryDto) {
    return this.svc.listRuns(query);
  }

  @Get('runs/failed')
  failedRuns(@Query('days') days?: string) {
    return this.svc.failedRuns(days ? parseInt(days, 10) : 7);
  }

  /**
   * Bulk-cancel every active (non-terminal) run system-wide. Recovery tool for
   * when the pipeline crashes leave runs stuck in PLANNING/BUILDING/VALIDATING
   * and the ConcurrencyGuard blocks new submissions.
   */
  @Post('runs/cancel-active')
  @HttpCode(HttpStatus.OK)
  cancelActive() {
    return this.runs.cancelAllActive();
  }
}
