import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { UpgradeSubscriptionDto } from './dto/upgrade-subscription.dto';
import { AuditService } from '../modules/audit/audit.service';
import { AuditAction } from '../modules/audit/audit.actions';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private svc: SubscriptionsService,
    private audit: AuditService,
  ) {}

  // ─── User routes ───────────────────────────────────────
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser('sub') userId: string) {
    const [active, history] = await Promise.all([
      this.svc.findActiveForUser(userId),
      this.svc.historyForUser(userId),
    ]);
    return { active, history };
  }

  // Compat: legacy direct subscribe action.
  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  async subscribe(
    @CurrentUser('sub') userId: string,
    @Body() body: CreateSubscriptionDto,
    @Req() req: Request,
  ) {
    const sub = await this.svc.subscribe(userId, body.planId);
    await this.audit.log({
      action: AuditAction.SUB_SUBSCRIBE,
      userId,
      resource: 'SUBSCRIPTION',
      resourceId: sub.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return sub;
  }

  @Post('upgrade')
  @UseGuards(JwtAuthGuard)
  async upgrade(
    @CurrentUser('sub') userId: string,
    @Body() body: UpgradeSubscriptionDto,
    @Req() req: Request,
  ) {
    const result = await this.svc.upgrade(userId, body.planId, {
      successUrl: body.successUrl,
      cancelUrl: body.cancelUrl,
    });
    await this.audit.log({
      action: AuditAction.SUB_UPGRADE,
      userId,
      resource: 'SUBSCRIPTION',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: { planId: body.planId, mode: result.mode },
    });
    return result;
  }

  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async cancel(@CurrentUser('sub') userId: string, @Req() req: Request) {
    const sub = await this.svc.cancel(userId);
    await this.audit.log({
      action: AuditAction.SUB_CANCEL,
      userId,
      resource: 'SUBSCRIPTION',
      resourceId: sub.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return sub;
  }

  // ─── Admin routes ──────────────────────────────────────
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  listAll() {
    return this.svc.listAll();
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async update(@Param('id') id: string, @Body() body: UpdateSubscriptionDto) {
    const data: any = {};
    if (body.status) data.status = body.status;
    if (body.expiresAt) data.expiresAt = new Date(body.expiresAt);
    if (body.canceledAt) data.canceledAt = new Date(body.canceledAt);
    if (body.planId) data.plan = { connect: { id: body.planId } };
    return this.svc.update(id, data);
  }
}
