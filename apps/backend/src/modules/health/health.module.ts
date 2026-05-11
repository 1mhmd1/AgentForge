import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { RunsModule } from '../../runs/runs.module';

@Module({
  imports: [RunsModule],
  controllers: [HealthController],
})
export class HealthModule {}
