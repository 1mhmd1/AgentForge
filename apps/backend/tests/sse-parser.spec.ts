import { SseParser } from '../src/runs/sse-parser';

describe('SseParser', () => {
  it('parses a single complete event with json payload', () => {
    const parser = new SseParser();
    const out = parser.feed('event: stage\ndata: {"name":"PLANNER"}\n\n');
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      event: 'stage',
      data: { name: 'PLANNER' },
      id: undefined,
      retry: undefined,
    });
  });

  it('joins multi-line data fields', () => {
    const parser = new SseParser();
    const out = parser.feed('event: spec\ndata: {"a":\ndata: 1}\n\n');
    expect(out[0].data).toEqual({ a: 1 });
  });

  it('infers event name from inline `event` json field when SSE event header is absent', () => {
    const parser = new SseParser();
    const out = parser.feed('data: {"event":"started","run_id":"ui_abcd"}\n\n');
    expect(out[0].event).toBe('started');
    expect(out[0].data).toEqual({ event: 'started', run_id: 'ui_abcd' });
  });

  it('handles fragmented chunks split mid-event', () => {
    const parser = new SseParser();
    expect(parser.feed('event: stage\ndata: {"name":"PLA')).toHaveLength(0);
    expect(parser.feed('NNER"}\n\n')).toEqual([
      {
        event: 'stage',
        data: { name: 'PLANNER' },
        id: undefined,
        retry: undefined,
      },
    ]);
  });

  it('keeps raw string when payload is not JSON', () => {
    const parser = new SseParser();
    const out = parser.feed('data: hello world\n\n');
    expect(out[0].data).toBe('hello world');
  });

  it('parses multiple events in one chunk', () => {
    const parser = new SseParser();
    const out = parser.feed(
      'event: a\ndata: 1\n\nevent: b\ndata: 2\n\n',
    );
    expect(out.map((e) => e.event)).toEqual(['a', 'b']);
  });
});
