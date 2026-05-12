import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckIcon, XIcon, CopyIcon, SpinnerIcon } from '../components/Icons';
import WorkflowTheater from '../components/WorkflowTheater';
import { Domain, getRun, getRunCode, openRunStream, RunDetail, RunStreamEvent } from '../api/runs';

interface RunExecProps {
  runId: string | null;
  onNavigate: (page: string, id?: string) => void;
}

type LogKind = 'info' | 'ok' | 'warn' | 'err';
interface LogLine { id: number; t: string; g: string; txt: string; kind: LogKind }
type StageState = 'idle' | 'running' | 'done' | 'error';
interface SubAgent { id: number; task: string; done: boolean }

const STAGE_NAMES = ['Planner', 'Builder', 'Validator'];

/**
 * Maps a backend stage label to a frontend stage index. The Python service
 * emits PROMPT_OPTIMIZER, PLANNER, BUILDER (plus 8 builder sub-stages like
 * "Spec Validation", "Code Injection", etc.), and VALIDATOR. The UI collapses
 * everything before BUILDER into the Planner column.
 */
function stageIndex(stage: string): 0 | 1 | 2 | null {
  const s = stage.toUpperCase();
  if (s === 'VALIDATOR') return 2;
  if (s === 'BUILDER') return 1;
  // Any of the 8 builder sub-stages contain words we can detect.
  if (s.includes('SPEC VALIDATION') || s.includes('EXECUTION PLANNING') ||
      s.includes('TEMPLATE LOADING') || s.includes('TEMPLATE RENDERING') ||
      s.includes('CODE INJECTION') || s.includes('QUALITY VALIDATION') ||
      s.includes('SYNTAX VALIDATION') || s.includes('FILE WRITING')) {
    return 1;
  }
  if (s === 'PLANNER' || s === 'PROMPT_OPTIMIZER') return 0;
  return null;
}

function formatTimestamp(elapsedMs: number): string {
  const s = elapsedMs / 1000;
  const mm = Math.floor(s / 60).toString().padStart(2, '0');
  const ss = (s % 60).toFixed(3).padStart(6, '0');
  return `${mm}:${ss}`;
}

/**
 * Turn a planner agent entry into a short human-readable label.
 *   { role: "skeleton_and_hero" }  -> "Skeleton & Hero"
 *   { role: "menu_section" }       -> "Menu Section"
 *   { role: "step_3" }             -> "Step 3"
 *   "build the hero"               -> "Build The Hero"  (string fallback)
 * Always ≤ 22 chars so the workflow theater fan doesn't overflow.
 */
function formatSubAgentName(entry: any, index: number): string {
  const raw =
    (typeof entry === 'string' ? entry : null) ??
    entry?.role ??
    entry?.name ??
    entry?.task ??
    entry?.id ??
    `Step ${index + 1}`;
  const s = String(raw).trim();
  const stepMatch = s.match(/^(?:step|agent)_(\d+)$/i);
  if (stepMatch) return `Step ${stepMatch[1]}`;
  const titled = s
    .replace(/_and_/gi, ' & ')
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
  return (titled || `Step ${index + 1}`).slice(0, 22);
}

export default function RunExecution({ runId, onNavigate }: RunExecProps) {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [stageStates, setStageStates] = useState<StageState[]>(['idle', 'idle', 'idle']);
  const [completed, setCompleted] = useState(false);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<'preview' | 'output' | 'explanation'>('preview');
  const [copied, setCopied] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [subAgents, setSubAgents] = useState<SubAgent[]>([]);
  const [code, setCode] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [validationScore, setValidationScore] = useState<number | null>(null);
  const [domain, setDomain] = useState<Domain | null>(null);

  const startedAt = useRef(Date.now());
  const logId = useRef(0);
  const logEndRef = useRef<HTMLDivElement>(null);

  const theaterStage = useMemo(() => {
    if (completed) return 'completed';
    if (stageStates[2] === 'running' || stageStates[2] === 'done') return 'validating';
    if (stageStates[1] === 'running' || stageStates[1] === 'done') return 'building';
    return 'planning';
  }, [stageStates, completed]);

  // Open SSE stream when the runId arrives.
  useEffect(() => {
    if (!runId) return;
    setLogs([]);
    setSubAgents([]);
    setStageStates(['idle', 'idle', 'idle']);
    setCompleted(false);
    setFailed(false);
    setCode('');
    setErrorMessage(null);
    setValidationScore(null);
    setDomain(null);
    setStreaming(true);
    startedAt.current = Date.now();
    logId.current = 0;

    const pushLog = (g: string, txt: string, kind: LogKind = 'info') => {
      const id = logId.current++;
      const t = formatTimestamp(Date.now() - startedAt.current);
      setLogs((prev) => [...prev, { id, t, g, txt, kind }]);
    };

    pushLog('◈', `Run ${runId} starting...`, 'info');

    let lastStageIndex: 0 | 1 | 2 | null = null;

    const handle = openRunStream(runId, {
      onError: () => {
        pushLog('⚠', 'Stream connection error (will retry)', 'warn');
      },
      onEvent: (ev: RunStreamEvent) => {
        switch (ev.event) {
          case 'snapshot': {
            // Terminal run replayed. Hydrate from full run record.
            const run = ev.data?.run as RunDetail | undefined;
            if (!run) return;
            const isDone = run.status === 'COMPLETED';
            const isFail = run.status === 'FAILED' || run.status === 'INTERRUPTED' || run.status === 'CANCELLED';
            setStageStates([isFail ? 'error' : 'done', isFail ? 'error' : 'done', isFail ? 'error' : 'done']);
            setCompleted(isDone);
            setFailed(isFail);
            setStreaming(false);
            if (isFail && run.finalError) setErrorMessage(run.finalError);
            if (run.validationScore !== null && run.validationScore !== undefined) setValidationScore(run.validationScore);
            if (run.domain) setDomain(run.domain);
            if (run.generatedCode) setCode(run.generatedCode);
            else if (run.id) getRunCode(run.id).then(setCode).catch(() => { /* noop */ });
            pushLog('◈', `Snapshot loaded (status=${run.status})`, isFail ? 'err' : 'ok');
            return;
          }
          case 'started': {
            pushLog('✦', 'Pipeline started', 'info');
            setStageStates((prev) => {
              const next = [...prev] as StageState[];
              next[0] = 'running';
              return next;
            });
            lastStageIndex = 0;
            return;
          }
          case 'stage': {
            const stageName = String(ev.data?.stage ?? ev.data?.name ?? '');
            const idx = stageIndex(stageName);
            const status = String(ev.data?.status ?? '').toLowerCase();
            const duration = typeof ev.data?.duration === 'number' ? ev.data.duration.toFixed(2) : null;
            if (idx !== null) {
              setStageStates((prev) => {
                const next = [...prev] as StageState[];
                if (status === 'failed' || status === 'error') next[idx] = 'error';
                else if (status === 'completed' || status === 'success' || status === 'passed') next[idx] = 'done';
                else next[idx] = 'running';
                // Cascade earlier stages to done if we moved forward.
                for (let i = 0; i < idx; i++) if (next[i] === 'running' || next[i] === 'idle') next[i] = 'done';
                return next;
              });
              lastStageIndex = idx;
            }
            const kind: LogKind = status === 'failed' || status === 'error' ? 'err'
              : status === 'completed' || status === 'success' || status === 'passed' ? 'ok' : 'info';
            const glyph = kind === 'ok' ? '✓' : kind === 'err' ? '✕' : '◈';
            const suffix = duration ? ` (${duration}s)` : '';
            pushLog(glyph, `${stageName.toUpperCase()}${suffix}`, kind);
            return;
          }
          case 'spec': {
            const plan = ev.data?.spec?.execution_plan ?? ev.data?.execution_plan;
            // Prefer the `agents[]` array - each entry has a meaningful `role`
            // like "skeleton_and_hero" or "menu_section". Fall back to the
            // raw `steps[]` strings only when the planner didn't produce a
            // structured plan.
            const agents: any[] = Array.isArray(plan?.agents) ? plan.agents
              : Array.isArray(ev.data?.spec?.agents) ? ev.data.spec.agents
              : [];
            const items: any[] = agents.length ? agents
              : Array.isArray(plan?.steps) ? plan.steps
              : Array.isArray(plan) ? plan
              : Array.isArray(ev.data?.spec?.steps) ? ev.data.spec.steps
              : [];
            if (items.length) {
              const ents: SubAgent[] = items.map((it, i) => ({
                id: i + 1,
                task: formatSubAgentName(it, i),
                done: false,
              }));
              setSubAgents(ents);
              pushLog('✦', `PLANNER queued ${ents.length} sub-agents`, 'info');
            } else {
              pushLog('✦', 'PLANNER spec received', 'info');
            }
            return;
          }
          case 'success': {
            const score = typeof ev.data?.validation_score === 'number' ? Math.round(ev.data.validation_score) : null;
            const duration = typeof ev.data?.build_duration === 'number' ? ev.data.build_duration.toFixed(2) : null;
            setStageStates(['done', 'done', 'done']);
            setSubAgents((prev) => prev.map((sa) => ({ ...sa, done: true })));
            setCompleted(true);
            setStreaming(false);
            setValidationScore(score);
            if (typeof ev.data?.domain === 'string') setDomain(ev.data.domain as Domain);
            if (typeof ev.data?.code === 'string' && ev.data.code) {
              setCode(ev.data.code);
            } else if (runId) {
              // Fall back to /api/runs/:id/code; backend reads the generated
              // file off disk and returns it as text/plain.
              getRunCode(runId).then(setCode).catch(() => { /* noop */ });
            }
            pushLog('✦', `Run completed${duration ? ` in ${duration}s` : ''}${score !== null ? ` (score=${score}/100)` : ''}`, 'ok');
            handle.close();
            return;
          }
          case 'failed': {
            const msg = String(ev.data?.final_error ?? 'pipeline_failed');
            const where = ev.data?.error_stage ? ` at ${ev.data.error_stage}` : '';
            setStageStates((prev) => {
              const next = [...prev] as StageState[];
              const targetIdx = lastStageIndex ?? 0;
              next[targetIdx] = 'error';
              return next;
            });
            setFailed(true);
            setStreaming(false);
            setErrorMessage(`${msg}${where}`);
            pushLog('✕', `FAILED: ${msg}${where}`, 'err');
            handle.close();
            return;
          }
        }
      },
    });

    return () => { handle.close(); };
  }, [runId]);

  // If we land on the page without a runId (deep link refresh), try to fetch
  // the run record so the user sees *something* even if the SSE is gone.
  useEffect(() => {
    if (!runId) return;
    getRun(runId).catch(() => { /* 404 etc. handled by stream error */ });
  }, [runId]);

  useEffect(() => {
    logEndRef.current?.scrollTo({ top: logEndRef.current.scrollHeight, behavior: 'smooth' });
  }, [logs.length]);

  const handleCopy = () => {
    if (!code) return;
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div data-responsive-root style={s.root}>
      <div style={{ ...s.header, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => onNavigate('runs')} style={s.back}>← Runs</button>
        <span style={{ ...s.runId, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '60%' }}>{runId ?? 'no run selected'}</span>
        {validationScore !== null && <span style={s.score}>score {validationScore}/100</span>}
      </div>
      <WorkflowTheater stage={theaterStage} subAgents={subAgents} />
      <Stepper states={stageStates} />
      <div style={s.grid}>
        <div style={{ ...s.terminal, ...(streaming ? { boxShadow: '0 0 0 1px rgba(124,58,237,0.3), 0 0 60px rgba(124,58,237,0.25)', animation: 'terminalPulse 2.4s ease-in-out infinite' } : {}) }}>
          <div style={s.terminalHeader}>
            <span style={{ display: 'inline-flex', gap: 6 }}>
              <span style={{ ...s.dot, background: '#EF4444' }} />
              <span style={{ ...s.dot, background: '#F59E0B' }} />
              <span style={{ ...s.dot, background: '#22C55E' }} />
            </span>
            <span style={s.terminalTitle}>agent_forge.exe</span>
          </div>
          <div ref={logEndRef} style={s.logArea}>
            {logs.map((l, idx) => (
              <LogLineView key={l.id} line={l} isLast={streaming && idx === logs.length - 1} />
            ))}
            {streaming && logs.length > 0 && (
              <span style={{ color: '#67E8F9', animation: 'cursorBlink 1s steps(2) infinite', marginLeft: 4 }}>▋</span>
            )}
          </div>
        </div>
        <div style={s.resultPanel}>
          {failed
            ? <ResultFailed message={errorMessage} />
            : !completed
              ? <ResultLoading />
              : <ResultComplete tab={tab} setTab={setTab} copied={copied} onCopy={handleCopy} code={code} domain={domain} />}
        </div>
      </div>
    </div>
  );
}

function Stepper({ states }: { states: StageState[] }) {
  const colors: Record<StageState, string> = { idle: '#1A2740', running: '#3B82F6', done: '#22C55E', error: '#EF4444' };
  const labelColors: Record<StageState, string> = { idle: '#475569', running: '#3B82F6', done: '#22C55E', error: '#EF4444' };
  return (
    <div style={ss.row}>
      {STAGE_NAMES.map((label, i) => {
        const state = states[i];
        const c = colors[state];
        return (
          <React.Fragment key={label}>
            <div style={ss.stack}>
              <div style={{ position: 'relative', width: 36, height: 36, borderRadius: '50%', border: `2px solid ${c}`, background: state === 'idle' ? '#0D1424' : `${c}1a`, color: state === 'idle' ? '#475569' : c, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, transition: 'all 300ms ease' }}>
                {state === 'done' ? <CheckIcon style={{ width: 16, height: 16 }} /> : state === 'error' ? <XIcon style={{ width: 16, height: 16 }} /> : state === 'running' ? <SpinnerIcon size={14} /> : i + 1}
                {state === 'running' && <span style={{ position: 'absolute', inset: -4, borderRadius: '50%', border: `2px solid ${c}`, animation: 'pulse-ring 1s ease-out infinite' }} />}
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: labelColors[state], marginTop: 8, fontFamily: 'Inter, sans-serif' }}>{label}</span>
            </div>
            {i < STAGE_NAMES.length - 1 && (
              <div style={{ flex: 1, height: 2, position: 'relative', background: '#1A2740', marginTop: -22, borderRadius: 1, overflow: 'hidden' }}>
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, #22C55E, #3B82F6)', width: states[i] === 'done' ? '100%' : '0%', transition: 'width 600ms ease-out' }} />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function LogLineView({ line, isLast }: { line: LogLine; isLast: boolean }) {
  const colorMap: Record<LogKind, string> = { info: '#67E8F9', ok: '#22C55E', warn: '#F59E0B', err: '#EF4444' };
  const c = colorMap[line.kind] || '#67E8F9';
  return (
    <div style={{ display: 'flex', gap: 10, animation: 'fadeSlide 200ms ease-out both, logGlow 400ms ease-out both', padding: '2px 0', textShadow: isLast ? `0 0 12px ${c}aa` : 'none' }}>
      <span style={{ color: '#94A3B8' }}>[{line.t}]</span>
      <span style={{ color: c }}>{line.g} {line.txt}</span>
    </div>
  );
}

function ResultLoading() {
  return (
    <div style={{ padding: 24 }}>
      <div style={{ ...skel, height: 16, width: '70%' }} />
      <div style={{ ...skel, height: 12, width: '90%', marginTop: 12 }} />
      <div style={{ ...skel, height: 12, width: '60%', marginTop: 12 }} />
      <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', border: '2px solid rgba(124,58,237,0.3)', borderTopColor: '#A78BFA', animation: 'spin-conic 1.4s linear infinite' }} />
        <span style={{ fontSize: 14, color: '#475569', fontFamily: 'Inter, sans-serif' }}>AI is building your agent…</span>
      </div>
    </div>
  );
}

function ResultFailed({ message }: { message: string | null }) {
  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: '#FCA5A5', fontFamily: 'Inter, sans-serif', textAlign: 'center' }}>
      <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(239,68,68,0.12)', border: '2px solid rgba(239,68,68,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <XIcon style={{ width: 22, height: 22 }} />
      </div>
      <div style={{ fontSize: 15, color: '#E2E8F0', fontWeight: 600 }}>Run failed</div>
      <div style={{ fontSize: 13, color: '#94A3B8', maxWidth: 320 }}>{message ?? 'The pipeline did not complete successfully.'}</div>
    </div>
  );
}

const skel: React.CSSProperties = { background: 'linear-gradient(90deg, #0D1424 0%, #1A2740 50%, #0D1424 100%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s linear infinite', borderRadius: 4 };

/**
 * Pulls the embedded artifact out of a generated `run_*.py` file.
 *
 * Modern safe_injector skeletons store rendered content in JSON-encoded
 * double-quoted string literals like:
 *   HTML_CONTENT = "<!DOCTYPE html>\n<html ...>..."
 *   CONTENT      = "..."
 * (The value is produced by `json.dumps` so it round-trips through
 * JSON.parse.) Earlier skeletons used `"""..."""` triple-quoted blocks; we
 * fall back to that when no named variable is found.
 */
function extractEmbeddedArtifact(code: string): string | null {
  if (!code) return null;

  // Match `NAME = "<json-string>"` where the string handles escaped chars.
  const readJsonStringVar = (name: string): string | null => {
    const re = new RegExp(`${name}\\s*=\\s*("(?:[^"\\\\]|\\\\.)*")`);
    const m = code.match(re);
    if (!m) return null;
    try {
      const v = JSON.parse(m[1]);
      return typeof v === 'string' ? v : null;
    } catch {
      return null;
    }
  };

  const candidates = [
    readJsonStringVar('TRANSFORMED_OUTPUT'),
    readJsonStringVar('HTML_CONTENT'),
    readJsonStringVar('CONTENT'),
    readJsonStringVar('CSV_CONTENT'),
    readJsonStringVar('JSON_CONTENT'),
    readJsonStringVar('MARKDOWN_CONTENT'),
  ];
  for (const v of candidates) {
    if (v && v.trim().length >= 20) return v;
  }

  // Legacy fallback for older triple-quoted skeletons.
  const matches = [...code.matchAll(/"""([\s\S]*?)"""/g)];
  if (!matches.length) return null;
  let longest = '';
  for (const m of matches) {
    // Skip f-string templates that still contain `{HTML_CONTENT}` placeholders.
    if (/\{(?:HTML|CSS|JS|CONTENT|JSON|MARKDOWN|CSV)_CONTENT\}/.test(m[1])) continue;
    if (m[1].length > longest.length) longest = m[1];
  }
  const trimmed = longest.trim();
  return trimmed.length >= 20 ? trimmed : null;
}

/**
 * Pull a hint about the original filename out of the generated agent so the
 * Download button can offer a sensible name (e.g. `customers.csv` ->
 * `customers.converted.json`). Falls back to a generic name.
 */
function extractInputFilename(code: string): string | null {
  const m = code.match(/INPUT_FILENAME\s*=\s*("(?:[^"\\]|\\.)*")/);
  if (!m) return null;
  try {
    const v = JSON.parse(m[1]);
    return typeof v === 'string' ? v : null;
  } catch {
    return null;
  }
}

function looksLikeHtml(text: string): boolean {
  // Full pages
  if (/<!DOCTYPE\s+html|<html[\s>]|<body[\s>]/i.test(text)) return true;
  // Fragments emitted by web_research / document sub-agents -- they ship a
  // tree of <h1>/<section>/<table>/etc. without a wrapping <html>.
  if (/<(?:h1|h2|h3|section|article|table|ul|ol|p|div|header|main|footer)\b/i.test(text)) return true;
  return false;
}

const FRAGMENT_STYLES = `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; max-width: 760px; margin: 28px auto; padding: 0 28px 48px; color: #1a202c; line-height: 1.65; background: #fdfdfd; }
  h1, h2, h3, h4 { color: #1a202c; line-height: 1.25; }
  h1 { font-size: 30px; font-weight: 800; margin: 0 0 12px; padding-bottom: 12px; border-bottom: 3px solid #7C3AED; }
  h2 { font-size: 22px; font-weight: 700; margin: 2em 0 0.6em; color: #7C3AED; }
  h3 { font-size: 17px; font-weight: 600; margin: 1.6em 0 0.4em; color: #3B82F6; }
  p { margin: 0.8em 0; }
  ul, ol { padding-left: 22px; margin: 0.6em 0; }
  li { margin: 0.35em 0; }
  table { width: 100%; border-collapse: collapse; margin: 1.4em 0; font-size: 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
  th { background: linear-gradient(180deg, #f8fafc, #f1f5f9); font-weight: 600; text-align: left; padding: 10px 14px; border-bottom: 2px solid #e2e8f0; color: #475569; font-size: 12px; letter-spacing: 0.04em; text-transform: uppercase; }
  td { padding: 12px 14px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  tr:hover td { background: #fafbfc; }
  code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 0.9em; }
  pre { background: #0f172a; color: #e2e8f0; padding: 16px; border-radius: 8px; overflow-x: auto; }
  pre code { background: transparent; padding: 0; color: inherit; }
  blockquote { border-left: 4px solid #A78BFA; padding: 4px 16px; margin: 1.2em 0; color: #64748b; font-style: italic; background: #faf5ff; border-radius: 0 6px 6px 0; }
  a { color: #7C3AED; text-decoration: none; }
  a:hover { text-decoration: underline; }
  section { margin: 1.6em 0; }
  hr { border: 0; border-top: 1px solid #e2e8f0; margin: 2em 0; }
`;

function wrapHtmlFragment(html: string): string {
  // Already a complete document - render as-is.
  if (/<!DOCTYPE\s+html|<html[\s>]/i.test(html)) return html;
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Document</title>
<style>${FRAGMENT_STYLES}</style>
</head>
<body>
${html}
</body>
</html>`;
}

const DOMAIN_LABELS: Record<Domain, string> = {
  website_builder: 'Website preview',
  document: 'Document',
  web_research: 'Research findings',
  data_transform: 'Transformed data',
};

function ResultComplete({ tab, setTab, copied, onCopy, code, domain }: { tab: 'preview' | 'output' | 'explanation'; setTab: (t: 'preview' | 'output' | 'explanation') => void; copied: boolean; onCopy: () => void; code: string; domain: Domain | null }) {
  const artifact = useMemo(() => extractEmbeddedArtifact(code), [code]);
  const isHtml = useMemo(() => !!artifact && (domain === 'website_builder' || looksLikeHtml(artifact)), [artifact, domain]);
  const inputFilename = useMemo(() => extractInputFilename(code), [code]);
  const display = code || '// Generated code will appear here once the run completes.';
  const previewLabel = domain ? DOMAIN_LABELS[domain] : 'Preview';

  return (
    <div style={{ padding: 20, animation: 'fadeUp 500ms ease both' }}>
      <div style={{ display: 'flex', gap: 24, marginBottom: 16, borderBottom: '1px solid rgba(26,39,64,0.6)' }}>
        {(['preview', 'output', 'explanation'] as const).map((t) => (
          <button type="button" key={t} onClick={() => setTab(t)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px 0', fontSize: 13, fontWeight: 600, fontFamily: 'Inter, sans-serif', color: tab === t ? '#E2E8F0' : '#475569', textTransform: 'capitalize', position: 'relative' }}>
            {t}
            {tab === t && <span style={{ position: 'absolute', left: 0, bottom: -1, width: '100%', height: 2, background: 'linear-gradient(90deg, #7C3AED, #06B6D4)', borderRadius: 1 }} />}
          </button>
        ))}
      </div>

      {tab === 'preview' && (
        <ResultPreview
          artifact={artifact}
          isHtml={isHtml}
          label={previewLabel}
          domain={domain}
          inputFilename={inputFilename}
        />
      )}

      {tab === 'output' && (
        <div style={{ position: 'relative', background: '#020608', borderRadius: 10, padding: 20, maxHeight: 480, overflow: 'auto' }}>
          <button type="button" onClick={onCopy} disabled={!code} style={{ position: 'absolute', top: 12, right: 12, background: 'transparent', border: 'none', cursor: code ? 'pointer' : 'not-allowed', color: copied ? '#22C55E' : '#475569', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontFamily: 'Inter, sans-serif', transition: 'color 200ms ease' }}>
            {copied ? <CheckIcon style={{ width: 14, height: 14 }} /> : <CopyIcon style={{ width: 14, height: 14 }} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <pre style={{ margin: 0, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#E2E8F0', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{display}</pre>
        </div>
      )}

      {tab === 'explanation' && (
        <PipelineExplanation domain={domain} />
      )}
    </div>
  );
}

function ResultPreview({ artifact, isHtml, label, domain, inputFilename }: { artifact: string | null; isHtml: boolean; label: string; domain: Domain | null; inputFilename: string | null }) {
  if (!artifact) {
    return (
      <div style={{ padding: '36px 20px', textAlign: 'center', color: '#94A3B8', fontSize: 14, lineHeight: 1.6 }}>
        <div style={{ fontSize: 13, color: '#475569', marginBottom: 6 }}>No embedded output detected.</div>
        Switch to <span style={{ color: '#A78BFA' }}>Output</span> to view the generated Python source.
      </div>
    );
  }

  if (isHtml) {
    return (
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: '#475569', textTransform: 'uppercase', marginBottom: 10 }}>{label}</div>
        <iframe
          title="generated-website-preview"
          srcDoc={wrapHtmlFragment(artifact)}
          sandbox="allow-same-origin"
          style={{ width: '100%', height: 720, border: '1px solid rgba(26,39,64,0.6)', borderRadius: 10, background: '#ffffff', display: 'block' }}
        />
      </div>
    );
  }

  // data_transform: pretty-print JSON, offer a Download button. The artifact
  // came out of TRANSFORMED_OUTPUT which the generated agent populated at
  // build time (and again at runtime, but the build-time one is what's in
  // generated_code).
  if (domain === 'data_transform') {
    return (
      <DataTransformPreview json={artifact} inputFilename={inputFilename} label={label} />
    );
  }

  // Document / web_research: render as plain text in a monospace pane.
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: '#475569', textTransform: 'uppercase', marginBottom: 10 }}>{label}</div>
      <pre style={{ margin: 0, background: '#020608', borderRadius: 10, padding: 20, maxHeight: 720, overflow: 'auto', fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: '#E2E8F0', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{artifact}</pre>
    </div>
  );
}

function DataTransformPreview({ json, inputFilename, label }: { json: string; inputFilename: string | null; label: string }) {
  const stats = useMemo(() => {
    try {
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed)) return { kind: 'array', count: parsed.length, sample: parsed[0] };
      if (parsed && typeof parsed === 'object') return { kind: 'object', count: Object.keys(parsed).length };
      return { kind: typeof parsed, count: 0 };
    } catch {
      return { kind: 'unknown', count: 0 };
    }
  }, [json]);

  const downloadName = useMemo(() => {
    if (!inputFilename) return 'converted.json';
    const stem = inputFilename.replace(/\.[^.]+$/, '');
    return `${stem || 'converted'}.converted.json`;
  }, [inputFilename]);

  const handleDownload = () => {
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: '#475569', textTransform: 'uppercase' }}>{label}</div>
        <span style={{ fontSize: 11, color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
          {stats.kind === 'array' ? `${stats.count} records` : stats.kind === 'object' ? `${stats.count} keys` : stats.kind}
        </span>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={handleDownload}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: 'linear-gradient(135deg, #7C3AED, #3B82F6)', border: 'none', color: 'white', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13, cursor: 'pointer', boxShadow: '0 0 20px rgba(124,58,237,0.35)' }}
        >
          ↓ Download {downloadName}
        </button>
      </div>
      <pre style={{ margin: 0, background: '#020608', borderRadius: 10, padding: 20, maxHeight: 720, overflow: 'auto', fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: '#E2E8F0', lineHeight: 1.7, whiteSpace: 'pre', wordBreak: 'normal' }}>{json}</pre>
    </div>
  );
}

function PipelineExplanation({ domain }: { domain: Domain | null }) {
  const domainLabel = domain ? DOMAIN_LABELS[domain] : 'artifact';
  const stages: { title: string; tag: string; body: React.ReactNode; substeps?: string[] }[] = [
    {
      title: 'Prompt Optimizer',
      tag: 'stage 1',
      body: (
        <>
          Rewrites your raw input into a structured brief: extracts the goal, target audience, must-have sections,
          tone, and any constraints. This step normalises wording so the planner sees the same shape regardless of how
          you phrased the request.
        </>
      ),
    },
    {
      title: 'Planner',
      tag: 'stage 2',
      body: (
        <>
          Classifies the domain (<code style={ex.code}>website_builder</code>, <code style={ex.code}>document</code>,
          <code style={ex.code}>web_research</code>, or <code style={ex.code}>data_transform</code>) and emits an
          execution plan. The plan lists between 2 and 7 role-named sub-agents (e.g. <em>Hero & Chrome</em>,
          <em> Menu Section</em>, <em>CSS</em>) — one per section the brief implies, plus a mandatory CSS step for
          website builds. The count scales to your prompt's complexity; it is not fixed.
        </>
      ),
    },
    {
      title: 'Builder',
      tag: 'stage 3',
      body: (
        <>
          Runs the sub-agents through eight tightly sequenced phases. Each phase has its own gate — if a check fails,
          the run halts with a precise error rather than producing a broken artifact.
        </>
      ),
      substeps: [
        'Spec Validation — confirms the planner output is a valid execution plan with all required fields.',
        'Execution Planning — orders the sub-agents and resolves dependencies between sections.',
        'Template Loading — pulls a matching skeleton from the Qdrant template store using semantic search.',
        'Template Rendering — fills the skeleton placeholders with the planner\'s section briefs.',
        'Code Injection — each sub-agent generates its slice (HTML / CSS / copy) and the injector splices it into the skeleton as a JSON-encoded variable.',
        'Quality Validation — heuristics catch placeholder text, empty sections, and obvious LLM hallucinations.',
        'Syntax Validation — parses the generated Python (and embedded HTML/CSS) to catch malformed output.',
        'File Writing — persists the final artifact to disk under generated_agents/run_*.py.',
      ],
    },
    {
      title: 'Validator',
      tag: 'stage 4',
      body: (
        <>
          Imports the generated module, executes it inside a sandboxed Python interpreter, captures the rendered
          {' '}{domainLabel.toLowerCase()}, and scores it 0–100 on completeness, structure, and stylistic correctness.
          The score you see at the top of the page comes from here.
        </>
      ),
    },
    {
      title: 'Persistence & Telemetry',
      tag: 'after',
      body: (
        <>
          The successful run is embedded and stored in the Qdrant <code style={ex.code}>run_store</code> collection
          (so similar future prompts can reuse the result), token usage is debited from your credit ledger, and the
          full event stream is checkpointed so you can resume or replay the run later.
        </>
      ),
    },
  ];

  return (
    <div style={ex.root}>
      <p style={ex.lead}>
        Every run flows through a LangGraph pipeline of five distinct stages. Each stage produces a typed artifact
        that the next stage consumes, with an LLM call fronted by a provider fallback chain
        (<strong style={ex.strong}>Gemini</strong> primary,
        {' '}<strong style={ex.strong}>Groq</strong> fallback) so a single quota or outage never breaks the whole run.
      </p>
      <ol style={ex.timeline}>
        {stages.map((st) => (
          <li key={st.title} style={ex.item}>
            <div style={ex.head}>
              <span style={ex.title}>{st.title}</span>
              <span style={ex.tag}>{st.tag}</span>
            </div>
            <div style={ex.body}>{st.body}</div>
            {st.substeps && (
              <ul style={ex.subList}>
                {st.substeps.map((line) => {
                  const [name, ...rest] = line.split(' — ');
                  return (
                    <li key={name} style={ex.subItem}>
                      <strong style={ex.strong}>{name}</strong>
                      {rest.length > 0 && <> — {rest.join(' — ')}</>}
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

const ex: Record<string, React.CSSProperties> = {
  root: { fontSize: 14, color: '#94A3B8', lineHeight: 1.7, fontFamily: 'Inter, sans-serif' },
  lead: { margin: '0 0 20px', color: '#CBD5E1' },
  timeline: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 18 },
  item: { position: 'relative', paddingLeft: 18, borderLeft: '2px solid rgba(124,58,237,0.35)' },
  head: { display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 },
  title: { color: '#E2E8F0', fontWeight: 700, fontSize: 15, letterSpacing: '0.01em' },
  tag: { fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#A78BFA', background: 'rgba(124,58,237,0.12)', padding: '2px 8px', borderRadius: 100 },
  body: { color: '#94A3B8' },
  subList: { listStyle: 'disc', paddingLeft: 22, margin: '10px 0 0', color: '#94A3B8' },
  subItem: { margin: '4px 0' },
  strong: { color: '#E2E8F0', fontWeight: 600 },
  code: { fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#67E8F9', background: 'rgba(103,232,249,0.08)', padding: '1px 6px', borderRadius: 4, margin: '0 1px' },
};

const s: Record<string, React.CSSProperties> = {
  root: { maxWidth: 1280, margin: '0 auto', padding: '32px 24px 80px', position: 'relative', zIndex: 1 },
  header: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 },
  back: { background: 'transparent', border: '1px solid rgba(26,39,64,0.8)', color: '#94A3B8', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontFamily: 'Inter, sans-serif' },
  runId: { fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: '#A78BFA', marginLeft: 8 },
  score: { marginLeft: 'auto', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#22C55E', padding: '4px 10px', borderRadius: 100, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' },
  grid: { display: 'grid', gridTemplateColumns: '1fr', gap: 24, marginTop: 32 },
  terminal: { background: '#020608', border: '1px solid rgba(26,39,64,0.6)', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  terminalHeader: { height: 40, background: 'rgba(9,14,26,0.9)', display: 'flex', alignItems: 'center', padding: '0 14px', gap: 14, borderBottom: '1px solid rgba(26,39,64,0.6)' },
  terminalTitle: { fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#475569' },
  dot: { width: 10, height: 10, borderRadius: '50%' },
  logArea: { padding: 20, fontFamily: 'JetBrains Mono, monospace', fontSize: 13, lineHeight: 1.8, flex: 1, overflowY: 'auto', maxHeight: 480 },
  resultPanel: { background: 'rgba(13,20,36,0.7)', backdropFilter: 'blur(20px)', border: '1px solid rgba(26,39,64,0.6)', borderRadius: 16, minHeight: 420, overflow: 'hidden' },
};

const ss: Record<string, React.CSSProperties> = {
  row: { display: 'flex', alignItems: 'flex-start', gap: 16, padding: '0 8px', marginTop: 8 },
  stack: { display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '0 0 auto' },
};
