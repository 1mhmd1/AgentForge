import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { Domain, Role, TemplateStatus } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TemplatesService } from './templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { InstantiateTemplateDto } from './dto/instantiate-template.dto';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit.actions';

@ApiTags('templates')
@ApiBearerAuth()
@Controller('templates')
export class TemplatesController {
  constructor(
    private templates: TemplatesService,
    private audit: AuditService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List the caller’s templates + public templates' })
  list(
    @CurrentUser() user: { sub: string; role: Role },
    @Query('domain') domain?: Domain,
    @Query('status') status?: TemplateStatus,
    @Query('publicOnly') publicOnly?: string,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ) {
    return this.templates.list(user, {
      domain,
      status,
      publicOnly: publicOnly === 'true',
      page: page ? parseInt(page, 10) : undefined,
      perPage: perPage ? parseInt(perPage, 10) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Template detail' })
  getById(@Param('id') id: string) {
    return this.templates.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Create a template (from raw spec or fromRunId)',
  })
  async create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateTemplateDto,
    @Req() req: Request,
  ) {
    const tpl = await this.templates.create({
      userId,
      name: dto.name,
      description: dto.description,
      domain: dto.domain,
      defaultPrompt: dto.defaultPrompt,
      spec: dto.spec ?? null,
      fromRunId: dto.fromRunId ?? null,
      isPublic: dto.isPublic,
    });
    await this.audit.log({
      action: AuditAction.TEMPLATE_CREATE,
      userId,
      resource: 'TEMPLATE',
      resourceId: tpl.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: { fromRunId: dto.fromRunId, domain: dto.domain },
    });
    return tpl;
  }

  @Post(':id/runs')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Instantiate template into a new Run' })
  instantiate(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string; role: Role },
    @Body() dto: InstantiateTemplateDto,
  ) {
    return this.templates.instantiate(id, user, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update a template' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
    @CurrentUser() user: { sub: string; role: Role },
  ) {
    return this.templates.update(id, user, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete a template' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string; role: Role },
    @Req() req: Request,
  ) {
    const result = await this.templates.delete(id, user);
    await this.audit.log({
      action: AuditAction.TEMPLATE_DELETE,
      userId: user.sub,
      resource: 'TEMPLATE',
      resourceId: id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return result;
  }

  // ─── Admin moderation ──────────────────────────────────
  @Post(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Approve template (admin)' })
  async approve(
    @Param('id') id: string,
    @CurrentUser('sub') adminId: string,
    @Req() req: Request,
  ) {
    const tpl = await this.templates.approve(id);
    await this.audit.log({
      action: AuditAction.TEMPLATE_APPROVE,
      userId: adminId,
      resource: 'TEMPLATE',
      resourceId: id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return tpl;
  }

  @Post(':id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Reject template (admin)' })
  async reject(
    @Param('id') id: string,
    @CurrentUser('sub') adminId: string,
    @Req() req: Request,
  ) {
    const tpl = await this.templates.reject(id);
    await this.audit.log({
      action: AuditAction.TEMPLATE_REJECT,
      userId: adminId,
      resource: 'TEMPLATE',
      resourceId: id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return tpl;
  }
}
