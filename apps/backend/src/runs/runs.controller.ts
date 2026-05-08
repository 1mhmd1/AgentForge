import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Param,
  Get,
  HttpException,
  HttpStatus,
  Sse,
  ValidationPipe,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { RunsService } from './runs.service';
import { CreateRunDto } from './dto/create-run.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { parseSseStream } from './sse-parser';
import { Domain } from '@prisma/client';

function mapDomain(value?: string): Domain | undefined {
  switch ((value || '').trim().toLowerCase()) {
    case 'web_research':
      return 'WEB_RESEARCH';
    case 'document':
      return 'DOCUMENT';
    case 'data_transform':
      return 'DATA_TRANSFORM';
    case 'website_builder':
      return 'WEBSITE_BUILDER';
    default:
      return undefined;
  }
}

@Controller()
export class RunsController {
  constructor(private runsService: RunsService) {}

  // POST /runs -> proxy SSE from AI service
  @UseGuards(JwtAuthGuard)
  @Sse('runs')
  @Post('runs')
  run(@Body(new ValidationPipe({ whitelist: true, transform: true })) body: CreateRunDto, @Req() req: any): Observable<any> {
    const user = req.user as any;
    const userId = user?.sub;

    if (!userId) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    const dto = body;

    return new Observable((subscriber) => {
      (async () => {
        // create DB rows
        let created;
        try {
          created = await this.runsService.createRunAndAgent(userId, dto.prompt, dto.sessionId, dto.domain);
        } catch (err: any) {
          subscriber.error(err);
          return;
        }

        const aiUrl = this.runsService.getAiServiceUrl().replace(/\/$/, '') + '/run';

        // call AI service
        let res: any;
        try {
          res = await fetch(aiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: dto.prompt, domain: dto.domain, sessionId: dto.sessionId }),
          });
        } catch (err: any) {
          // update run/agent to failed
          await this.runsService.prisma.agentRun.update({ where: { runId: created.run.id }, data: { status: 'FAILED', error: String(err) } });
          await this.runsService.prisma.run.update({ where: { id: created.run.id }, data: { status: 'FAILED', finalError: String(err) } });
          subscriber.error(err);
          return;
        }

        if (!res.ok || !res.body) {
          const text = await res.text().catch(() => '');
          const msg = `AI service error: ${res.status} ${res.statusText} ${text}`;
          await this.runsService.prisma.agentRun.update({ where: { runId: created.run.id }, data: { status: 'FAILED', error: msg } });
          await this.runsService.prisma.run.update({ where: { id: created.run.id }, data: { status: 'FAILED', finalError: msg } });
          subscriber.error(new Error(msg));
          return;
        }

        // read stream
        const reader = res.body.getReader?.();
        const chunks: string[] = [];

        if (reader) {
          // web ReadableStream
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const text = Buffer.from(value).toString('utf-8');
              chunks.push(text);
              // feed parser for completed events
              for (const evText of parseSseStream([text])) {
                // each evText is raw SSE block like "data: {...}\n\n"
                const dataLines = evText
                  .split(/\r?\n/)
                  .filter((l) => l.startsWith('data:'))
                  .map((l) => l.replace(/^data:\s?/, ''))
                  .join('\n');

                let parsed: any = dataLines;
                try {
                  parsed = JSON.parse(dataLines);
                } catch (e) {
                  // keep raw
                }

                // forward event to client
                const eventName = parsed && typeof parsed === 'object' && parsed.event ? String(parsed.event) : undefined;
                subscriber.next({ event: eventName, data: parsed });

                // handle specific typed events for DB updates
                try {
                  if (parsed && typeof parsed === 'object') {
                    const ev = parsed.event as string | undefined;
                    if (ev === 'started') {
                      // log only
                      // no DB change
                    } else if (ev === 'stage') {
                      const stageName = (parsed.stage || parsed.status || parsed.name || '').toString().toUpperCase();
                      // update Run.stage (PLANNING/BUILDING/VALIDATING/COMPLETED)
                      if (['PLANNING', 'BUILDING', 'VALIDATING', 'COMPLETED'].includes(stageName)) {
                        await this.runsService.prisma.run.update({ where: { id: created.run.id }, data: { stage: stageName } });
                      }
                    } else if (ev === 'spec') {
                      const spec = parsed.spec ?? parsed;
                      const domainVal = mapDomain(spec && spec.domain ? String(spec.domain) : undefined);
                      await this.runsService.prisma.agentRun.update({ where: { runId: created.run.id }, data: { spec: spec ?? undefined, domain: domainVal ?? 'WEB_RESEARCH' } });
                    } else if (ev === 'success') {
                      const score = parsed.semanticScore ?? parsed.semantic_score ?? undefined;
                      await this.runsService.prisma.agentRun.update({ where: { runId: created.run.id }, data: { status: 'COMPLETED', semanticScore: score } });
                      await this.runsService.prisma.run.update({ where: { id: created.run.id }, data: { status: 'COMPLETED' } });
                    } else if (ev === 'failed') {
                      const finalError = parsed.finalError ?? parsed.error ?? JSON.stringify(parsed);
                      await this.runsService.prisma.agentRun.update({ where: { runId: created.run.id }, data: { status: 'FAILED', error: finalError } });
                      await this.runsService.prisma.run.update({ where: { id: created.run.id }, data: { status: 'FAILED', finalError } });
                    }
                  }
                } catch (dbErr) {
                  this.runsService.prisma.run.update({ where: { id: created.run.id }, data: { finalError: String(dbErr) } }).catch(() => {});
                }
              }
            }
          } catch (readErr) {
            subscriber.error(readErr);
            return;
          }
        } else {
          // Node.js stream fallback
          try {
            for await (const chunk of res.body) {
              const text = chunk.toString('utf-8');
              chunks.push(text);
              for (const evText of parseSseStream([text])) {
                const dataLines = evText
                  .split(/\r?\n/)
                  .filter((l) => l.startsWith('data:'))
                  .map((l) => l.replace(/^data:\s?/, ''))
                  .join('\n');

                let parsed: any = dataLines;
                try {
                  parsed = JSON.parse(dataLines);
                } catch (e) {}

                const eventName = parsed && typeof parsed === 'object' && parsed.event ? String(parsed.event) : undefined;
                subscriber.next({ event: eventName, data: parsed });
                // DB updates (same as above)
                try {
                  if (parsed && typeof parsed === 'object') {
                    const ev = parsed.event as string | undefined;
                    if (ev === 'started') {
                    } else if (ev === 'stage') {
                      const stageName = (parsed.stage || parsed.status || parsed.name || '').toString().toUpperCase();
                      if (['PLANNING', 'BUILDING', 'VALIDATING', 'COMPLETED'].includes(stageName)) {
                        await this.runsService.prisma.run.update({ where: { id: created.run.id }, data: { stage: stageName } });
                      }
                    } else if (ev === 'spec') {
                      const spec = parsed.spec ?? parsed;
                      const domainVal = mapDomain(spec && spec.domain ? String(spec.domain) : undefined);
                      await this.runsService.prisma.agentRun.update({ where: { runId: created.run.id }, data: { spec: spec ?? undefined, domain: domainVal ?? 'WEB_RESEARCH' } });
                    } else if (ev === 'success') {
                      const score = parsed.semanticScore ?? parsed.semantic_score ?? undefined;
                      await this.runsService.prisma.agentRun.update({ where: { runId: created.run.id }, data: { status: 'COMPLETED', semanticScore: score } });
                      await this.runsService.prisma.run.update({ where: { id: created.run.id }, data: { status: 'COMPLETED' } });
                    } else if (ev === 'failed') {
                      const finalError = parsed.finalError ?? parsed.error ?? JSON.stringify(parsed);
                      await this.runsService.prisma.agentRun.update({ where: { runId: created.run.id }, data: { status: 'FAILED', error: finalError } });
                      await this.runsService.prisma.run.update({ where: { id: created.run.id }, data: { status: 'FAILED', finalError } });
                    }
                  }
                } catch (dbErr) {
                  this.runsService.prisma.run.update({ where: { id: created.run.id }, data: { finalError: String(dbErr) } }).catch(() => {});
                }
              }
            }
          } catch (e) {
            subscriber.error(e);
            return;
          }
        }

        // stream ended
        subscriber.complete();
      })().catch((err) => subscriber.error(err));

      return () => {
        // teardown
      };
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('runs/:id')
  async getRun(@Param('id') id: string) {
    const run = await this.runsService.findRunById(id);
    if (!run) throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    return run;
  }

  @UseGuards(JwtAuthGuard)
  @Get('sessions/:sessionId/runs')
  async getRunsForSession(@Param('sessionId') sessionId: string) {
    return this.runsService.findRunsForSession(sessionId);
  }
}
