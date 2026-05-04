import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Observable, Subject } from 'rxjs';

@Injectable()
export class StreamingService {
  private streams = new Map<string, Subject<MessageEvent>>();

  getStream(runId: string): Observable<MessageEvent> {
    if (!this.streams.has(runId)) {
      this.streams.set(runId, new Subject<MessageEvent>());
    }
    return this.streams.get(runId)!.asObservable();
  }

  @OnEvent('run.progress')
  onRunProgress(payload: { runId: string; status: string; data?: unknown }) {
    const subject = this.streams.get(payload.runId);
    if (subject) {
      subject.next({ data: payload } as MessageEvent);
    }
  }
}

interface MessageEvent {
  data: string | object;
}
