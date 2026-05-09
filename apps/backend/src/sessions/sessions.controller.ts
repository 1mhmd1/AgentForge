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
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SessionsService } from './sessions.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../modules/audit/audit.service';
import { AuditAction } from '../modules/audit/audit.actions';

@Controller()
export class SessionsController {
  constructor(
    private sessions: SessionsService,
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  // ─── User routes ───────────────────────────────────────
  @Post('sessions')
  @UseGuards(JwtAuthGuard)
  async create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateSessionDto,
    @Req() req: Request,
  ) {
    const session = await this.sessions.create(userId, dto);
    await this.audit.log({
      action: AuditAction.SESSION_CREATE,
      userId,
      resource: 'SESSION',
      resourceId: session.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return session;
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  list(
    @CurrentUser('sub') userId: string,
    @Query('archived') archived?: string,
  ) {
    return this.sessions.listForUser(userId, archived === 'true');
  }

  @Get('sessions/me')
  @UseGuards(JwtAuthGuard)
  mySessions(@CurrentUser('sub') userId: string) {
    return this.sessions.listForUser(userId, false);
  }

  @Get('sessions/:id')
  @UseGuards(JwtAuthGuard)
  getOne(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.sessions.findOneOwned(id, userId);
  }

  @Patch('sessions/:id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateSessionDto,
    @Req() req: Request,
  ) {
    const result = await this.sessions.update(id, userId, dto);
    if (dto.isArchived) {
      await this.audit.log({
        action: AuditAction.SESSION_ARCHIVE,
        userId,
        resource: 'SESSION',
        resourceId: id,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
    }
    return result;
  }

  @Delete('sessions/:id')
  @UseGuards(JwtAuthGuard)
  async delete(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    await this.sessions.delete(id, userId);
    await this.audit.log({
      action: AuditAction.SESSION_DELETE,
      userId,
      resource: 'SESSION',
      resourceId: id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return { message: 'Session deleted' };
  }

  // ─── Admin routes ──────────────────────────────────────
  @Get('admin/sessions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  allSessions() {
    return this.prisma.session.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userId: true,
        title: true,
        isArchived: true,
        previousSessionId: true,
        expiresAt: true,
        lastSeenAt: true,
        createdAt: true,
        user: {
          select: { id: true, email: true, name: true, role: true, status: true },
        },
        _count: { select: { runs: true } },
      },
    });
  }
}
