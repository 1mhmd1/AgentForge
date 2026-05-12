import { Controller, Get, Header } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { metrics } from './metrics';

@ApiExcludeController()
@Controller('metrics')
export class MetricsController {
  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4')
  prometheus(): string {
    return metrics.render();
  }
}
