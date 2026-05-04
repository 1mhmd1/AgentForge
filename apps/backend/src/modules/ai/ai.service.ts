import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async invokeOrchestrator(runId: string, prompt: string): Promise<void> {
    // 1. mark run as in-progress in Prisma
    // 2. dynamically import AI runtime orchestrator from `apps/ai`
    // 3. run pipeline (Planner -> Builder -> Validator)
    // 4. emit progress events via EventEmitter2 (consumed by streaming module)
    // 5. persist final result to Prisma
  }
}
