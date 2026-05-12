import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UsageService } from './usage.service';

@Controller()
export class UsageController {
  constructor(private usage: UsageService) {}

  @Get('usage/me')
  @UseGuards(JwtAuthGuard)
  me(
    @CurrentUser('sub') userId: string,
    @Query('days') days?: string,
  ) {
    return this.usage.forUser(userId, days ? parseInt(days, 10) : 30);
  }

  @Get('admin/usage/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  forUser(
    @Param('userId') userId: string,
    @Query('days') days?: string,
  ) {
    return this.usage.forUser(userId, days ? parseInt(days, 10) : 30);
  }
}
