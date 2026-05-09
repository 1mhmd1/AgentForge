import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { Role, UserStatus } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { UsersAdminService } from './users.service';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { AdminActionReasonDto } from './dto/admin-action.dto';
import { AuditService } from '../../modules/audit/audit.service';
import { AuditAction } from '../../modules/audit/audit.actions';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class UsersAdminController {
  constructor(
    private svc: UsersAdminService,
    private audit: AuditService,
  ) {}

  @Get()
  list(
    @Query() pagination: PaginationQueryDto,
    @Query('role') role?: Role,
    @Query('status') status?: UserStatus,
  ) {
    return this.svc.listUsers({
      page: pagination.page,
      perPage: pagination.perPage,
      q: pagination.q,
      role,
      status,
    });
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.svc.getUser(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: AdminUpdateUserDto,
    @CurrentUser('sub') adminId: string,
    @Req() req: Request,
  ) {
    if (dto.role) {
      await this.svc.changeRole(id, dto.role, adminId);
      await this.audit.log({
        action: AuditAction.ADMIN_USER_ROLE_CHANGE,
        userId: adminId,
        resource: 'USER',
        resourceId: id,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: { role: dto.role },
      });
    }

    if (dto.planId !== undefined) {
      await this.svc.changePlan(id, dto.planId, adminId);
      await this.audit.log({
        action: AuditAction.ADMIN_USER_PLAN_CHANGE,
        userId: adminId,
        resource: 'USER',
        resourceId: id,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: { planId: dto.planId },
      });
    }

    const direct: Record<string, unknown> = {};
    if (dto.name !== undefined) direct.name = dto.name;
    if (dto.status !== undefined) direct.status = dto.status;
    if (dto.isActive !== undefined) direct.isActive = dto.isActive;
    if (dto.isSuspended !== undefined) direct.isSuspended = dto.isSuspended;
    if (dto.credits !== undefined) direct.credits = dto.credits;

    if (Object.keys(direct).length > 0) {
      return this.svc.updateUser(id, direct);
    }

    return this.svc.getUser(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('id') id: string,
    @CurrentUser('sub') adminId: string,
    @Body() dto: AdminActionReasonDto,
    @Req() req: Request,
  ) {
    const result = await this.svc.deleteUser(id, adminId, dto.reason);
    await this.audit.log({
      action: AuditAction.ADMIN_USER_DELETE,
      userId: adminId,
      resource: 'USER',
      resourceId: id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: { reason: dto.reason },
    });
    return result;
  }

  @Post(':id/suspend')
  @HttpCode(HttpStatus.OK)
  async suspend(
    @Param('id') id: string,
    @CurrentUser('sub') adminId: string,
    @Body() dto: AdminActionReasonDto,
    @Req() req: Request,
  ) {
    const user = await this.svc.suspend(id, adminId, dto.reason);
    await this.audit.log({
      action: AuditAction.ADMIN_USER_SUSPEND,
      userId: adminId,
      resource: 'USER',
      resourceId: id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: { reason: dto.reason },
    });
    return user;
  }

  @Post(':id/unsuspend')
  @HttpCode(HttpStatus.OK)
  async unsuspend(
    @Param('id') id: string,
    @CurrentUser('sub') adminId: string,
    @Body() dto: AdminActionReasonDto,
    @Req() req: Request,
  ) {
    const user = await this.svc.unsuspend(id, adminId, dto.reason);
    await this.audit.log({
      action: AuditAction.ADMIN_USER_UNSUSPEND,
      userId: adminId,
      resource: 'USER',
      resourceId: id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: { reason: dto.reason },
    });
    return user;
  }
}
