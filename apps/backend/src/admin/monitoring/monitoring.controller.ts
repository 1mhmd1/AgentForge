import { Controller, Get, Query, UseGuards, ValidationPipe } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { JwtAuthGuard } from '../../auth/jwt.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '@prisma/client';
import { AdminRunsQueryDto } from './dto/admin-runs-query.dto';

@Controller('admin')
export class MonitoringController {
  constructor(private svc: MonitoringService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('runs')
  async listRuns(@Query(new ValidationPipe({ transform: true, whitelist: true })) query: AdminRunsQueryDto) {
    return this.svc.listRuns({ domain: query.domain, status: query.status });
  }
}
