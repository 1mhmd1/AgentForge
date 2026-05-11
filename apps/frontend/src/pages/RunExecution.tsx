import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckIcon, XIcon, CopyIcon, SpinnerIcon } from '../components/Icons';
import WorkflowTheater from '../components/WorkflowTheater';
import { getRun, getRunCode, openRunStream, RunDetail, RunStreamEvent } from '../api/runs';

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

export default function RunExecution({ runId, onNavigate }: RunExecProps) {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [stageStates, setStageStates] = useState<StageState[]>(['idle', 'idle', 'idle']);
  const [completed, setCompleted] = useState(false);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<'output' | 'explanation'>('output');
  const [copied, setCopied] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [subAgents, setSubAgents] = useState<SubAgent[]>([]);
  const [code, setCode] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [validationScore, setValidationScore] = useState<number | null>(null);

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
            const steps: any[] = Array.isArray(plan?.steps) ? plan.steps
              : Array.isArray(plan) ? plan
              : Array.isArray(ev.data?.spec?.steps) ? ev.data.spec.steps
              : [];
            if (steps.length) {
              const ents: SubAgent[] = steps.map((step, i) => ({
                id: i + 1,
                task: String(step?.id ?? step?.name ?? step?.task ?? `Step ${i + 1}`).slice(0, 18),
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
    <div style={s.root}>
      <div style={s.header}>
        <button type="button" onClick={() => onNavigate('runs')} style={s.back}>← Runs</button>
        <span style={s.runId}>{runId ?? 'no run selected'}</span>
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
              : <ResultComplete tab={tab} setTab={setTab} copied={copied} onCopy={handleCopy} code={code} />}
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

function ResultComplete({ tab, setTab, copied, onCopy, code }: { tab: 'output' | 'explanation'; setTab: (t: 'output' | 'explanation') => void; copied: boolean; onCopy: () => void; code: string }) {
  const display = code || '// Generated code will appear here once the run completes.';
  return (
    <div style={{ padding: 20, animation: 'fadeUp 500ms ease both' }}>
      <div style={{ display: 'flex', gap: 24, marginBottom: 16, borderBottom: '1px solid rgba(26,39,64,0.6)' }}>
        {(['output', 'explanation'] as const).map((t) => (
          <button type="button" key={t} onClick={() => setTab(t)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px 0', fontSize: 13, fontWeight: 600, fontFamily: 'Inter, sans-serif', color: tab === t ? '#E2E8F0' : '#475569', textTransform: 'capitalize', position: 'relative' }}>
            {t}
            {tab === t && <span style={{ position: 'absolute', left: 0, bottom: -1, width: '100%', height: 2, background: 'linear-gradient(90deg, #7C3AED, #06B6D4)', borderRadius: 1 }} />}
          </button>
        ))}
      </div>
      {tab === 'output' ? (
        <div style={{ position: 'relative', background: '#020608', borderRadius: 10, padding: 20, maxHeight: 480, overflow: 'auto' }}>
          <button type="button" onClick={onCopy} disabled={!code} style={{ position: 'absolute', top: 12, right: 12, background: 'transparent', border: 'none', cursor: code ? 'pointer' : 'not-allowed', color: copied ? '#22C55E' : '#475569', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontFamily: 'Inter, sans-serif', transition: 'color 200ms ease' }}>
            {copied ? <CheckIcon style={{ width: 14, height: 14 }} /> : <CopyIcon style={{ width: 14, height: 14 }} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <pre style={{ margin: 0, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#E2E8F0', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{display}</pre>
        </div>
      ) : (
        <div style={{ fontSize: 14, color: '#94A3B8', lineHeight: 1.7, fontFamily: 'Inter, sans-serif' }}>
          <p style={{ marginBottom: 12 }}>The pipeline ran in <span style={{ color: '#A78BFA' }}>3 stages</span>:</p>
          <ul style={{ paddingLeft: 18, color: '#94A3B8' }}>
            <li><strong style={{ color: '#E2E8F0' }}>Planner</strong> rewrote the prompt and broke the task into an execution plan.</li>
            <li><strong style={{ color: '#E2E8F0' }}>Builder</strong> ran sub-agents and assembled the final artifact.</li>
            <li><strong style={{ color: '#E2E8F0' }}>Validator</strong> verified syntax, executed the output in a sandbox, and persisted the run.</li>
          </ul>
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: { maxWidth: 1280, margin: '0 auto', padding: '32px 24px 80px', position: 'relative', zIndex: 1 },
  header: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 },
  back: { background: 'transparent', border: '1px solid rgba(26,39,64,0.8)', color: '#94A3B8', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontFamily: 'Inter, sans-serif' },
  runId: { fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: '#A78BFA', marginLeft: 8 },
  score: { marginLeft: 'auto', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#22C55E', padding: '4px 10px', borderRadius: 100, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' },
  grid: { display: 'grid', gridTemplateColumns: '6fr 4fr', gap: 24, marginTop: 32, minHeight: 420 },
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
