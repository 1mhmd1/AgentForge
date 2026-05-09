import { Module } from '@nestjs/common';
import { RunsService } from './runs.service';
import { RunsController } from './runs.controller';
import { AiProxyService } from './ai-proxy.service';
import { RunStreamService } from './run-stream.service';
import { ConcurrencyGuard } from './concurrency.guard';
import { SessionsModule } from '../sessions/sessions.module';

@Module({
  imports: [SessionsModule],
  providers: [RunsService, AiProxyService, RunStreamService, ConcurrencyGuard],
  controllers: [RunsController],
  exports: [RunsService, AiProxyService],
})
export class RunsModule {}
