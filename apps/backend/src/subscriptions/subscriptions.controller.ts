import { Controller, Post, UseGuards, Req, Body, Delete, Get, Patch, Param, ValidationPipe } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private svc: SubscriptionsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('subscribe')
  async subscribe(@Req() req: any, @Body(new ValidationPipe({ whitelist: true, transform: true })) body: CreateSubscriptionDto) {
    const user = req.user as any;
    return this.svc.subscribe(user.sub, body.planId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('cancel')
  async cancel(@Req() req: any) {
    const user = req.user as any;
    return this.svc.cancel(user.sub);
  }

  // Admin routes
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get()
  async listAll() {
    return this.svc.listAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id')
  async update(@Param('id') id: string, @Body(new ValidationPipe({ whitelist: true, transform: true })) body: UpdateSubscriptionDto) {
    const data: any = {};

    if (body.status) {
      data.status = body.status;
    }

    if (body.expiresAt) {
      data.expiresAt = new Date(body.expiresAt);
    }

    if (body.canceledAt) {
      data.canceledAt = new Date(body.canceledAt);
    }

    if (body.planId) {
      data.plan = { connect: { id: body.planId } };
    }

    return this.svc.update(id, data);
  }
}
