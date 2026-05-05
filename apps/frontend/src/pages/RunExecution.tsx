import React, { useState, useEffect, useRef, useMemo } from 'react';
import { CheckIcon, XIcon, CopyIcon, SpinnerIcon } from '../components/Icons';
import WorkflowTheater from '../components/WorkflowTheater';
import { MOCK_LOGS, MOCK_RESULT } from '../data/mockData';

const SUB_TASK_POOL = [
  'Fetch sources', 'Parse schema', 'GPT-4o run', 'Transform', 'Validate', 'Format',
  'Optimize', 'Package', 'Crawl URLs', 'Extract text', 'Embed', 'Index',
  'Dedupe', 'Summarize', 'Classify', 'Diff schema', 'Lint output',
];

// 🌐 Backend integration point
// Replace planSubAgents() with the real Builder output:
//   const tasks = await api.getRunSubTasks(runId)         (REST)
//   eventSource.on('subtask:create', t => addSubAgent(t)) (SSE/WS stream)
// The shape `{ id: number; task: string }` is what the WorkflowTheater consumes.
function planSubAgents(): { id: number; task: string }[] {
  const count = 5 + Math.floor(Math.random() * 5);
  const shuffled = [...SUB_TASK_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((task, i) => ({ id: i + 1, task }));
}

interface RunExecProps {
  runId: string | null;
  onNavigate: (page: string, id?: string) => void;
}

export default function RunExecution({ runId, onNavigate }: RunExecProps) {
  const [logs, setLogs] = useState<typeof MOCK_LOGS>([]);
  const [stageStates, setStageStates] = useState(['running', 'idle', 'idle']);
  const [completed, setCompleted] = useState(false);
  const [tab, setTab] = useState('output');
  const [copied, setCopied] = useState(false);
  const [streaming, setStreaming] = useState(true);
  const [subAgents, setSubAgents] = useState<{ id: number; task: string; done: boolean }[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  const theaterStage = useMemo(() => {
    if (completed) return 'completed';
    if (stageStates[2] === 'running') return 'validating';
    if (stageStates[1] === 'running') return 'building';
    return 'planning';
  }, [stageStates, completed]);

  useEffect(() => {
    setSubAgents([]);
  }, [runId]);

  useEffect(() => {
    if (stageStates[1] === 'running' && subAgents.length === 0) {
      const tasks = planSubAgents();
      tasks.forEach((t, i) => {
        setTimeout(() => setSubAgents((prev) => [...prev, { ...t, done: false }]), i * 250);
      });
    }
    if (stageStates[1] === 'done') {
      setSubAgents((prev) => prev.map((s) => ({ ...s, done: true })));
    }
  }, [stageStates[1]]);

  useEffect(() => {
    let i = 0;
    const stages = ['running', 'idle', 'idle'];
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (i >= MOCK_LOGS.length) { setCompleted(true); setStreaming(false); return; }
      const line = MOCK_LOGS[i];
      setLogs((prev) => [...prev, { ...line, id: i } as any]);
      const newStages = [...stages];
      if (line.stage > 0 && newStages[line.stage] === 'idle') newStages[line.stage] = 'running';
      if ((line as any).stageDone !== undefined) {
        newStages[(line as any).stageDone] = 'done';
        if ((line as any).stageDone + 1 < 3) newStages[(line as any).stageDone + 1] = 'running';
      }
      stages[0] = newStages[0]; stages[1] = newStages[1]; stages[2] = newStages[2];
      setStageStates([...newStages]);
      i++;
      timer = setTimeout(tick, 300 + Math.random() * 600);
    };
    timer = setTimeout(tick, 200);
    return () => clearTimeout(timer);
  }, [runId]);

  useEffect(() => {
    logEndRef.current?.scrollTo({ top: logEndRef.current.scrollHeight, behavior: 'smooth' });
  }, [logs.length]);

  const handleCopy = () => {
    navigator.clipboard?.writeText(MOCK_RESULT).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={s.root}>
      <div style={s.header}>
        <button onClick={() => onNavigate('runs')} style={s.back}>← Runs</button>
        <span style={s.runId}>{runId || 'run_7f3a1c'}</span>
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
              <LogLine key={(l as any).id ?? idx} line={l} isLast={streaming && idx === logs.length - 1} />
            ))}
            {streaming && logs.length > 0 && (
              <span style={{ color: '#67E8F9', animation: 'cursorBlink 1s steps(2) infinite', marginLeft: 4 }}>▋</span>
            )}
          </div>
        </div>
        <div style={s.resultPanel}>
          {!completed ? <ResultLoading /> : <ResultComplete tab={tab} setTab={setTab} copied={copied} onCopy={handleCopy} />}
        </div>
      </div>
    </div>
  );
}

function Stepper({ states }: { states: string[] }) {
  const steps = [{ id: 0, label: 'Planner' }, { id: 1, label: 'Builder' }, { id: 2, label: 'Validator' }];
  const colors: Record<string, string> = { idle: '#1A2740', running: '#3B82F6', done: '#22C55E', error: '#EF4444' };
  const labelColors: Record<string, string> = { idle: '#475569', running: '#3B82F6', done: '#22C55E', error: '#EF4444' };
  return (
    <div style={ss.row}>
      {steps.map((step, i) => {
        const state = states[i];
        const c = colors[state];
        return (
          <React.Fragment key={step.id}>
            <div style={ss.stack}>
              <div style={{ position: 'relative', width: 36, height: 36, borderRadius: '50%', border: `2px solid ${c}`, background: state === 'idle' ? '#0D1424' : `${c}1a`, color: state === 'idle' ? '#475569' : c, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, transition: 'all 300ms ease' }}>
                {state === 'done' ? <CheckIcon style={{ width: 16, height: 16 }} /> : state === 'error' ? <XIcon style={{ width: 16, height: 16 }} /> : state === 'running' ? <SpinnerIcon size={14} /> : i + 1}
                {state === 'running' && <span style={{ position: 'absolute', inset: -4, borderRadius: '50%', border: `2px solid ${c}`, animation: 'pulse-ring 1s ease-out infinite' }} />}
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: labelColors[state], marginTop: 8, fontFamily: 'Inter, sans-serif' }}>{step.label}</span>
            </div>
            {i < steps.length - 1 && (
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

function LogLine({ line, isLast }: { line: any; isLast: boolean }) {
  const colorMap: Record<string, string> = { info: '#67E8F9', ok: '#22C55E', warn: '#F59E0B', err: '#EF4444' };
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

const skel: React.CSSProperties = { background: 'linear-gradient(90deg, #0D1424 0%, #1A2740 50%, #0D1424 100%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s linear infinite', borderRadius: 4 };

function ResultComplete({ tab, setTab, copied, onCopy }: { tab: string; setTab: (t: string) => void; copied: boolean; onCopy: () => void }) {
  return (
    <div style={{ padding: 20, animation: 'fadeUp 500ms ease both' }}>
      <div style={{ display: 'flex', gap: 24, marginBottom: 16, borderBottom: '1px solid rgba(26,39,64,0.6)' }}>
        {['output', 'explanation'].map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px 0', fontSize: 13, fontWeight: 600, fontFamily: 'Inter, sans-serif', color: tab === t ? '#E2E8F0' : '#475569', textTransform: 'capitalize', position: 'relative' }}>
            {t}
            {tab === t && <span style={{ position: 'absolute', left: 0, bottom: -1, width: '100%', height: 2, background: 'linear-gradient(90deg, #7C3AED, #06B6D4)', borderRadius: 1 }} />}
          </button>
        ))}
      </div>
      {tab === 'output' ? (
        <div style={{ position: 'relative', background: '#020608', borderRadius: 10, padding: 20 }}>
          <button onClick={onCopy} style={{ position: 'absolute', top: 12, right: 12, background: 'transparent', border: 'none', cursor: 'pointer', color: copied ? '#22C55E' : '#475569', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontFamily: 'Inter, sans-serif', transition: 'color 200ms ease' }}>
            {copied ? <CheckIcon style={{ width: 14, height: 14 }} /> : <CopyIcon style={{ width: 14, height: 14 }} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <pre style={{ margin: 0, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#E2E8F0', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{MOCK_RESULT}</pre>
        </div>
      ) : (
        <div style={{ fontSize: 14, color: '#94A3B8', lineHeight: 1.7, fontFamily: 'Inter, sans-serif' }}>
          <p style={{ marginBottom: 12 }}>The agent ran in <span style={{ color: '#A78BFA' }}>3 stages</span>:</p>
          <ul style={{ paddingLeft: 18, color: '#94A3B8' }}>
            <li><strong style={{ color: '#E2E8F0' }}>Planner</strong> decomposed the task into 4 parallel subtasks.</li>
            <li><strong style={{ color: '#E2E8F0' }}>Builder</strong> fetched sources, processed via GPT-4o, and structured the schema.</li>
            <li><strong style={{ color: '#E2E8F0' }}>Validator</strong> confirmed schema and quality checks passed.</li>
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
