import { Module, forwardRef } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { TemplatesController } from './templates.controller';
import { RunsModule } from '../../runs/runs.module';

@Module({
  imports: [forwardRef(() => RunsModule)],
  controllers: [TemplatesController],
  providers: [TemplatesService],
  exports: [TemplatesService],
})
export class TemplatesModule {}
