import { Body, Controller, Post } from '@nestjs/common';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('invoke')
  async invoke(@Body() body: { runId: string; prompt: string }) {
    await this.aiService.invokeOrchestrator(body.runId, body.prompt);
    return { ok: true, runId: body.runId };
  }
}
