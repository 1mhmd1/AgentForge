import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
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

@Injectable()
export class RunsService {
  private readonly logger = new Logger(RunsService.name);

  constructor(public prisma: PrismaService, private config: ConfigService) {}

  async createRunAndAgent(userId: string, prompt: string, sessionId: string, domain?: string) {
    const normalizedDomain = mapDomain(domain) ?? 'WEB_RESEARCH';
    const run = await this.prisma.run.create({
      data: {
        sessionId,
        userPrompt: prompt,
        stage: 'PLANNING',
        status: 'RUNNING',
        domain: normalizedDomain,
      },
    });

    const agentRun = await this.prisma.agentRun.create({
      data: {
        runId: run.id,
        domain: normalizedDomain,
        status: 'RUNNING',
      },
    });

    return { run, agentRun };
  }

  async findRunById(id: string) {
    return this.prisma.run.findUnique({
      where: { id },
      include: { agentRun: true },
    });
  }

  async findRunsForSession(sessionId: string) {
    return this.prisma.run.findMany({
      where: { sessionId },
      include: { agentRun: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  getAiServiceUrl() {
    return this.config.get<string>('AI_SERVICE_URL') || 'http://localhost:4000';
  }
}
