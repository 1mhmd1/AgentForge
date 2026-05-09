import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../auth/jwt.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiKeysService } from './apikeys.service';
import { CreateApiKeyDto } from './dto/create-apikey.dto';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit.actions';

import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('keys')
@ApiBearerAuth()
@Controller('keys')
@UseGuards(JwtAuthGuard)
export class ApiKeysController {
  constructor(
    private apiKeys: ApiKeysService,
    private audit: AuditService,
  ) {}

  @Post()
  async create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateApiKeyDto,
    @Req() req: Request,
  ) {
    const created = await this.apiKeys.create(userId, dto);
    await this.audit.log({
      action: AuditAction.APIKEY_CREATE,
      userId,
      resource: 'API_KEY',
      resourceId: created.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return created;
  }

  @Get()
  list(@CurrentUser('sub') userId: string) {
    return this.apiKeys.list(userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async revoke(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    const result = await this.apiKeys.revoke(id, userId);
    await this.audit.log({
      action: AuditAction.APIKEY_REVOKE,
      userId,
      resource: 'API_KEY',
      resourceId: id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return result;
  }
}
