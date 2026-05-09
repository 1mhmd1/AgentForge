import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
  ServiceUnavailableException,
  Sse,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RunsService } from './runs.service';
import { RunStreamService } from './run-stream.service';
import { AiProxyService } from './ai-proxy.service';
import { ConcurrencyGuard } from './concurrency.guard';
import { CreateRunDto } from './dto/create-run.dto';
import { ListRunsDto } from './dto/list-runs.dto';
import { FilesService } from '../modules/files/files.service';
import { CreditsService } from '../modules/credits/credits.service';
import { AuditService } from '../modules/audit/audit.service';
import { AuditAction } from '../modules/audit/audit.actions';

@ApiTags('runs')
@ApiBearerAuth()
@Controller()
export class RunsController {
  constructor(
    private runs: RunsService,
    private stream: RunStreamService,
    private aiProxy: AiProxyService,
    private files: FilesService,
    private credits: CreditsService,
    private audit: AuditService,
  ) {}

  // ─── Create — async stub, no SSE here ─────────────────
  @Post('runs')
  @UseGuards(JwtAuthGuard, ConcurrencyGuard)
  @ApiOperation({
    summary: 'Create a run',
    description:
      'Validates plan/credits/concurrency, persists a Run row in STARTED state, and returns the streamUrl. Clients open `GET /api/runs/:id/stream` next.',
  })
  async create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateRunDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() req: Request,
  ) {
    // Block new runs when user is in overdraft (existing runs may complete).
    const balance = await this.credits.balance(userId);
    if (balance.overdraft) {
      throw new BadRequestException({
        message: 'Out of credits — top up before starting a new run',
        errorCode: 'NO_CREDITS',
      });
    }

    // Pre-flight upstream so the user gets a fast 503 if AI is down.
    const aiOk = await this.aiProxy.ping();
    if (!aiOk) {
      throw new ServiceUnavailableException({
        message: 'AI service unavailable',
        errorCode: 'AI_SERVICE_UNAVAILABLE',
      });
    }

    let prompt = dto.prompt;
    if (dto.attachmentIds?.length) {
      const addendum = await this.files.buildPromptAddendum(
        userId,
        dto.attachmentIds,
      );
      if (addendum) prompt = `${prompt}\n\n${addendum}`;
    }

    const run = await this.runs.createRun({
      userId,
      prompt,
      domain: dto.domain,
      sessionId: dto.sessionId ?? null,
      templateId: dto.templateId ?? null,
      attachmentIds: dto.attachmentIds,
      idempotencyKey: idempotencyKey ?? null,
    });

    await this.audit.log({
      action: AuditAction.RUN_CREATE,
      userId,
      resource: 'RUN',
      resourceId: run.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: { domain: dto.domain, attachments: dto.attachmentIds?.length ?? 0 },
    });

    return {
      runId: run.id,
      streamUrl: `/api/runs/${run.id}/stream`,
      status: run.status,
    };
  }

  // ─── Stream — SSE proxy ───────────────────────────────
  @Sse('runs/:id/stream')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Stream a run',
    description:
      'Server-Sent Events proxied from the AI service. Heartbeats every 15s, synthesizes a `failed` event with `final_error: "ai_service_disconnected"` when the upstream drops.',
  })
  @ApiParam({ name: 'id' })
  async streamRun(
    @Param('id') runId: string,
    @CurrentUser() user: { sub: string; role: Role },
  ): Promise<Observable<{ event?: string; data: any; comment?: string }>> {
    // Ownership / 404 checks happen here so they surface as proper HTTP
    // responses instead of getting swallowed inside an Observable.error.
    const snapshot = await this.runs.assertCanRead(runId, user);
    return this.stream.stream(runId, user, snapshot);
  }

  // ─── Read ─────────────────────────────────────────────
  @Get('runs')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Paginated history of the caller’s runs' })
  list(
    @CurrentUser('sub') userId: string,
    @Query() filter: ListRunsDto,
  ) {
    return this.runs.list(userId, filter);
  }

  @Get('runs/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Run detail (spec, validation report, code, audit)' })
  getRun(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string; role: Role },
  ) {
    return this.runs.findById(id, user);
  }

  @Get('runs/:id/code')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Generated Python source as text/plain' })
  async getCode(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string; role: Role },
    @Res() res: Response,
  ) {
    const code = await this.runs.findCode(id, user);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(code ?? '');
  }

  @Get('sessions/:sessionId/runs')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Runs for a session' })
  listForSession(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: { sub: string; role: Role },
  ) {
    return this.runs.listForSession(sessionId, user);
  }

  // ─── Mutate ───────────────────────────────────────────
  @Post('runs/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Cancel an in-flight run' })
  async cancel(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string; role: Role },
    @Req() req: Request,
  ) {
    const result = await this.runs.cancel(id, user);
    await this.audit.log({
      action: AuditAction.RUN_CANCEL,
      userId: user.sub,
      resource: 'RUN',
      resourceId: id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return result;
  }

  @Post('runs/:id/replay')
  @UseGuards(JwtAuthGuard, ConcurrencyGuard)
  @ApiOperation({ summary: 'Re-run with the same prompt + domain (new run row)' })
  async replay(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string; role: Role },
  ) {
    const run = await this.runs.replay(id, user);
    return {
      runId: run.id,
      streamUrl: `/api/runs/${run.id}/stream`,
      status: run.status,
    };
  }

  @Delete('runs/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Soft-delete a run' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string; role: Role },
  ) {
    return this.runs.softDelete(id, user);
  }
}
