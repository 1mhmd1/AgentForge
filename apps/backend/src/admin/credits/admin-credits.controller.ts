import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreditReason, Role } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreditsService } from '../../modules/credits/credits.service';
import { AuditService } from '../../modules/audit/audit.service';
import { AuditAction } from '../../modules/audit/audit.actions';

class GrantCreditsDto {
  @Type(() => Number) @IsInt() @Min(1) amount!: number;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class AdminCreditsController {
  constructor(
    private credits: CreditsService,
    private audit: AuditService,
  ) {}

  @Post(':id/grant-credits')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Grant credits to a user (admin override)' })
  async grant(
    @Param('id') userId: string,
    @Body() body: GrantCreditsDto,
    @CurrentUser('sub') adminId: string,
    @Req() req: Request,
  ) {
    const entry = await this.credits.grant(
      userId,
      body.amount,
      CreditReason.ADMIN_GRANT,
      { reason: body.reason ?? null, adminId } as any,
    );
    await this.audit.log({
      action: AuditAction.ADMIN_USER_PLAN_CHANGE, // closest existing label; reuse to avoid sprawl
      userId: adminId,
      resource: 'USER',
      resourceId: userId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: { grant: body.amount, reason: body.reason },
    });
    return entry;
  }
}
