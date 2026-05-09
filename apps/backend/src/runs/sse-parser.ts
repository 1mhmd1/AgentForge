/**
 * Streaming SSE parser. Feed it chunks (`feed`) and call `drain` to pull
 * complete events as they arrive. Each event is exposed as a parsed object
 * (`{ event?, data }`); when the data isn't JSON, `data` is the raw string.
 */
export interface SseEvent {
  event?: string;
  data: any;
  id?: string;
  retry?: number;
}

export class SseParser {
  private buffer = '';

  feed(chunk: string): SseEvent[] {
    this.buffer += chunk;
    const events: SseEvent[] = [];

    while (true) {
      const m1 = this.buffer.indexOf('\r\n\r\n');
      const m2 = this.buffer.indexOf('\n\n');
      if (m1 === -1 && m2 === -1) break;

      let endIdx: number;
      if (m1 !== -1 && (m2 === -1 || m1 < m2)) {
        endIdx = m1 + 4;
      } else {
        endIdx = m2 + 2;
      }

      const block = this.buffer.slice(0, endIdx).trim();
      this.buffer = this.buffer.slice(endIdx);

      if (!block) continue;

      const parsed = this.parseBlock(block);
      if (parsed) events.push(parsed);
    }

    return events;
  }

  private parseBlock(block: string): SseEvent | null {
    let event: string | undefined;
    let id: string | undefined;
    let retry: number | undefined;
    const dataLines: string[] = [];

    for (const line of block.split(/\r?\n/)) {
      if (!line || line.startsWith(':')) continue;
      const colon = line.indexOf(':');
      if (colon === -1) continue;
      const field = line.slice(0, colon).trim();
      const value = line.slice(colon + 1).replace(/^ /, '');

      switch (field) {
        case 'event':
          event = value;
          break;
        case 'data':
          dataLines.push(value);
          break;
        case 'id':
          id = value;
          break;
        case 'retry': {
          const n = parseInt(value, 10);
          if (!Number.isNaN(n)) retry = n;
          break;
        }
      }
    }

    if (dataLines.length === 0) return null;

    const raw = dataLines.join('\n');
    let parsed: any = raw;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // keep raw string
    }

    // If the AI service uses an inline `event` field on its JSON, surface it.
    const inferredEvent =
      event ?? (parsed && typeof parsed === 'object' && parsed.event
        ? String(parsed.event)
        : undefined);

    return { event: inferredEvent, data: parsed, id, retry };
  }
}
