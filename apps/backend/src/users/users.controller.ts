import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateMeDto } from './dto/update-me.dto';
import { AuditService } from '../modules/audit/audit.service';
import { AuditAction } from '../modules/audit/audit.actions';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private users: UsersService,
    private audit: AuditService,
  ) {}

  @Get('me')
  me(@CurrentUser('sub') userId: string) {
    return this.users.meDetails(userId);
  }

  @Patch('me')
  async updateMe(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateMeDto,
    @Req() req: Request,
  ) {
    const updated = await this.users.updateMe(userId, dto);
    await this.audit.log({
      action: AuditAction.USER_UPDATE_SELF,
      userId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: { fields: Object.keys(dto) },
    });
    return updated;
  }

  @Delete('me')
  async deleteMe(@CurrentUser('sub') userId: string, @Req() req: Request) {
    await this.audit.log({
      action: AuditAction.USER_DELETE_SELF,
      userId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    await this.users.deleteMe(userId);
    return { message: 'Account deleted' };
  }
}
