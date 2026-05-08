// Minimal SSE parser that extracts complete event blocks (separated by blank line)
export function* parseSseStream(chunks: Iterable<string>) {
  let buffer = '';

  for (const part of chunks) {
    buffer += part;

    // try to split into events by double-newline (handles \n\n and \r\n\r\n)
    let idx: number;
    while (true) {
      const m1 = buffer.indexOf('\r\n\r\n');
      const m2 = buffer.indexOf('\n\n');
      if (m1 === -1 && m2 === -1) break;
      if (m1 !== -1 && (m2 === -1 || m1 < m2)) {
        idx = m1 + 4;
      } else {
        idx = m2 + 2;
      }
      const eventText = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx);
      if (eventText) {
        yield eventText;
      }
    }
  }

  if (buffer.trim()) {
    yield buffer.trim();
  }
}
