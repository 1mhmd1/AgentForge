import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiService } from '../ai/ai.service';

@Injectable()
export class RunsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  async create(prompt: string) {
    // 1. Create Run row in Prisma (status: 'planning')
    // 2. Trigger ai.service.invokeOrchestrator(runId, prompt) async
    // 3. Return runId immediately so client can subscribe to SSE
    return { runId: '', status: 'planning' };
  }

  async findOne(runId: string) {
    // Read run from Prisma
    return null;
  }
}
