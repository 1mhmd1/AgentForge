import { Controller, Param, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { StreamingService } from './streaming.service';

@Controller('streaming')
export class StreamingController {
  constructor(private readonly streaming: StreamingService) {}

  @Sse('runs/:id')
  stream(@Param('id') id: string): Observable<MessageEvent> {
    return this.streaming.getStream(id);
  }
}

interface MessageEvent {
  data: string | object;
}
