/**
 * Tiny Prometheus-compatible counter/histogram registry.
 *
 * The canonical spec asks for `/metrics` Prometheus output. Rather than pull
 * in `prom-client` (and another transitive native build), we ship a small
 * in-process registry with the four metrics the contract calls out. Swap for
 * `prom-client` later without changing call-sites.
 */
type Labels = Record<string, string | number>;

interface Counter {
  name: string;
  help: string;
  labelNames: string[];
  values: Map<string, number>;
}

interface Histogram {
  name: string;
  help: string;
  labelNames: string[];
  buckets: number[];
  values: Map<string, { sum: number; count: number; bucketCounts: number[] }>;
}

const counters: Counter[] = [];
const histograms: Histogram[] = [];

function counter(name: string, help: string, labelNames: string[] = []): Counter {
  const c: Counter = { name, help, labelNames, values: new Map() };
  counters.push(c);
  return c;
}

function histogram(
  name: string,
  help: string,
  labelNames: string[] = [],
  buckets: number[] = [10, 50, 100, 250, 500, 1000, 2500, 10_000, 60_000],
): Histogram {
  const h: Histogram = { name, help, labelNames, buckets, values: new Map() };
  histograms.push(h);
  return h;
}

function labelKey(labels: Labels, names: string[]): string {
  return names.map((n) => `${n}="${(labels[n] ?? '').toString().replace(/"/g, '\\"')}"`).join(',');
}

function inc(c: Counter, labels: Labels = {}, by = 1) {
  const k = labelKey(labels, c.labelNames);
  c.values.set(k, (c.values.get(k) ?? 0) + by);
}

function observe(h: Histogram, value: number, labels: Labels = {}) {
  const k = labelKey(labels, h.labelNames);
  let bucket = h.values.get(k);
  if (!bucket) {
    bucket = { sum: 0, count: 0, bucketCounts: h.buckets.map(() => 0) };
    h.values.set(k, bucket);
  }
  bucket.sum += value;
  bucket.count += 1;
  for (let i = 0; i < h.buckets.length; i++) {
    if (value <= h.buckets[i]) bucket.bucketCounts[i] += 1;
  }
}

function render(): string {
  const lines: string[] = [];
  for (const c of counters) {
    lines.push(`# HELP ${c.name} ${c.help}`);
    lines.push(`# TYPE ${c.name} counter`);
    if (c.values.size === 0) {
      lines.push(`${c.name} 0`);
    }
    for (const [k, v] of c.values) {
      lines.push(`${c.name}${k ? `{${k}}` : ''} ${v}`);
    }
  }
  for (const h of histograms) {
    lines.push(`# HELP ${h.name} ${h.help}`);
    lines.push(`# TYPE ${h.name} histogram`);
    for (const [k, b] of h.values) {
      const labelPrefix = k ? `{${k},` : '{';
      h.buckets.forEach((bucket, i) => {
        lines.push(
          `${h.name}_bucket${labelPrefix}le="${bucket}"} ${b.bucketCounts[i]}`,
        );
      });
      lines.push(`${h.name}_bucket${labelPrefix}le="+Inf"} ${b.count}`);
      lines.push(`${h.name}_sum${k ? `{${k}}` : ''} ${b.sum}`);
      lines.push(`${h.name}_count${k ? `{${k}}` : ''} ${b.count}`);
    }
  }
  return lines.join('\n') + '\n';
}

// Pre-declared metric instances used across the app.
const httpRequests = counter(
  'agentforge_http_requests_total',
  'Total HTTP requests',
  ['method', 'route', 'status'],
);
const httpDuration = histogram(
  'agentforge_http_request_duration_ms',
  'HTTP request duration in ms',
  ['method', 'route'],
);
const aiRequests = counter(
  'agentforge_ai_requests_total',
  'Total AI service POST /run calls',
  ['outcome'],
);
const aiDuration = histogram(
  'agentforge_ai_request_duration_ms',
  'AI service POST /run duration in ms',
);
const runsTerminated = counter(
  'agentforge_runs_terminated_total',
  'Run terminations',
  ['status'],
);

export const metrics = {
  inc,
  observe,
  render,
  httpRequests,
  httpDuration,
  aiRequests,
  aiDuration,
  runsTerminated,
};
