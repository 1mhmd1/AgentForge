import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { RunsService } from './runs.service';
import { RunsController } from './runs.controller';

@Module({
  imports: [AiModule],
  controllers: [RunsController],
  providers: [RunsService],
})
export class RunsModule {}
