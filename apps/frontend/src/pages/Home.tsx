import React, { useState, useRef } from 'react';
import { ArrowRightIcon, ChevronDownIcon, SpinnerIcon, SparkleIcon } from '../components/Icons';
import { MOCK_AGENTS, MOCK_RUNS } from '../data/mockData';

interface HomeProps {
  onNavigate: (page: string, id?: string) => void;
  onSubmit: (data: { prompt: string; agent: string }) => void;
}

export default function Home({ onNavigate, onSubmit }: HomeProps) {
  const [prompt, setPrompt] = useState('');
  const [agent, setAgent] = useState(MOCK_AGENTS[0]);
  const [agentOpen, setAgentOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [running, setRunning] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(300, Math.max(120, el.scrollHeight)) + 'px';
  };

  const handleRun = () => {
    if (running) return;
    setRunning(true);
    setTimeout(() => {
      onSubmit({ prompt: prompt || 'Research top 10 AI startups in 2025', agent: agent.name });
    }, 3000);
  };

  return (
    <div style={s.root}>
      <section style={s.hero}>
        <div style={{ ...s.eyebrow, animation: 'fadeUp 600ms var(--ease-spring) both' }}>
          <SparkleIcon style={{ width: 12, height: 12 }} /> NEXT-GEN AI INFRASTRUCTURE
        </div>
        <h1 style={s.heading}>
          {['Build', 'AI', 'Agents'].map((w, i) => (
            <span key={i} style={{ display: 'inline-block', animation: `fadeUp 750ms var(--ease-spring) ${i * 120}ms both`, marginRight: '0.25em' }}>{w}</span>
          ))}
          <br />
          <span style={{ display: 'inline-block', animation: 'fadeUp 750ms var(--ease-spring) 480ms both', background: 'linear-gradient(135deg, #7C3AED 0%, #3B82F6 50%, #06B6D4 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Instantly.
          </span>
        </h1>
        <p style={{ ...s.subtitle, animation: 'fadeUp 600ms var(--ease-spring) 400ms both' }}>
          Describe what you want. AgentForge builds, tests, and deploys your AI pipeline — in seconds.
        </p>
        <div style={{ ...s.ctaRow, animation: 'fadeUp 600ms var(--ease-spring) 500ms both' }}>
          <PrimaryCTA onClick={() => taRef.current?.focus()}>Start Building <ArrowRightIcon style={{ width: 14, height: 14 }} /></PrimaryCTA>
          <GhostCTA>View Demo</GhostCTA>
        </div>
      </section>

      <section style={{ ...s.promptWrap, animation: 'cardEntry 800ms var(--ease-spring) 700ms both' }}>
        <div style={{ ...s.promptCard, ...(focused ? { borderColor: 'rgba(124,58,237,0.4)' } : {}) }}>
          {focused && <div style={s.conicBorder} />}
          <textarea
            ref={taRef}
            value={prompt}
            onChange={(e) => { setPrompt(e.target.value); autoResize(e.target); }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Describe what you want the agent to do…"
            style={s.textarea}
          />
          <div style={s.promptBottom}>
            <AgentSelector value={agent} onChange={setAgent} open={agentOpen} setOpen={setAgentOpen} />
            <RunButton running={running} onClick={handleRun} />
          </div>
        </div>
      </section>

      <section style={s.recentWrap}>
        <div style={s.recentLabel}>Recent Runs</div>
        <div style={s.recentList}>
          {MOCK_RUNS.slice(0, 3).map((r, i) => (
            <RunRowCard key={r.id} run={r} index={i} onClick={() => onNavigate('run-exec', r.id)} />
          ))}
        </div>
      </section>
    </div>
  );
}

function PrimaryCTA({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 32px', borderRadius: 10, background: 'linear-gradient(135deg, #7C3AED, #3B82F6)', color: 'white', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 15, border: 'none', cursor: 'pointer', boxShadow: hover ? '0 0 50px rgba(124,58,237,0.6), 0 4px 15px rgba(0,0,0,0.3)' : '0 0 30px rgba(124,58,237,0.4), 0 4px 15px rgba(0,0,0,0.3)', transform: hover ? 'scale(1.04)' : 'scale(1)', transition: 'all 200ms cubic-bezier(0.34, 1.56, 0.64, 1)' }}>{children}</button>
  );
}

function GhostCTA({ children }: { children: React.ReactNode }) {
  const [hover, setHover] = useState(false);
  return (
    <button onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{ padding: '14px 32px', borderRadius: 10, background: hover ? 'rgba(124,58,237,0.08)' : 'transparent', border: `1px solid ${hover ? 'rgba(124,58,237,0.5)' : 'rgba(148,163,184,0.3)'}`, color: hover ? '#E2E8F0' : '#94A3B8', fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 15, cursor: 'pointer', transition: 'all 200ms ease' }}>{children}</button>
  );
}

function AgentSelector({ value, onChange, open, setOpen }: { value: typeof MOCK_AGENTS[0]; onChange: (a: typeof MOCK_AGENTS[0]) => void; open: boolean; setOpen: (v: boolean) => void }) {
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'rgba(9,14,26,0.9)', border: '1px solid rgba(26,39,64,0.8)', borderRadius: 10, padding: '10px 16px', color: '#94A3B8', fontSize: 14, fontFamily: 'Inter, sans-serif', cursor: 'pointer' }}>
        <span>{value.emoji}</span>
        <span>{value.name}</span>
        <ChevronDownIcon style={{ width: 14, height: 14, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease' }} />
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, minWidth: 240, background: 'rgba(9,14,26,0.98)', backdropFilter: 'blur(20px)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 12, boxShadow: '0 20px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(124,58,237,0.15)', padding: 6, zIndex: 50, transformOrigin: 'top left', animation: 'dropIn 150ms ease' }}>
          {MOCK_AGENTS.map((a) => (
            <DropdownOption key={a.id} agent={a} active={a.id === value.id} onClick={() => { onChange(a); setOpen(false); }} />
          ))}
        </div>
      )}
    </div>
  );
}

function DropdownOption({ agent, active, onClick }: { agent: typeof MOCK_AGENTS[0]; active: boolean; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', background: hover ? 'rgba(124,58,237,0.12)' : 'transparent', border: 'none', borderLeft: `2px solid ${hover ? '#7C3AED' : 'transparent'}`, color: hover || active ? '#E2E8F0' : '#94A3B8', fontSize: 14, fontFamily: 'Inter, sans-serif', cursor: 'pointer', textAlign: 'left', borderRadius: 6, transition: 'all 150ms ease' }}>
      <span>{agent.emoji}</span>
      <span>{agent.name}</span>
    </button>
  );
}

function RunButton({ running, onClick }: { running: boolean; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} disabled={running} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderRadius: 10, background: running ? 'linear-gradient(90deg, #7C3AED, #3B82F6, #06B6D4, #7C3AED)' : 'linear-gradient(135deg, #7C3AED, #3B82F6)', backgroundSize: running ? '300% 100%' : '100% 100%', animation: running ? 'shimmer 1.5s linear infinite' : 'none', color: 'white', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 15, border: 'none', cursor: running ? 'not-allowed' : 'pointer', boxShadow: hover && !running ? '0 0 45px rgba(124,58,237,0.55), 0 0 80px rgba(59,130,246,0.2)' : '0 0 25px rgba(124,58,237,0.35)', transform: hover && !running ? 'scale(1.04)' : 'scale(1)', transition: 'transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 200ms ease' }}>
      {running ? <><SpinnerIcon size={14} /> Running…</> : 'Run Agent'}
    </button>
  );
}

function RunRowCard({ run, index, onClick }: { run: typeof MOCK_RUNS[0]; index: number; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  const colors: Record<string, string> = { success: '#22C55E', running: '#3B82F6', failed: '#EF4444' };
  const c = colors[run.status];
  return (
    <button onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{ display: 'flex', alignItems: 'center', gap: 16, width: '100%', background: 'rgba(13,20,36,0.6)', border: `1px solid ${hover ? 'rgba(124,58,237,0.4)' : 'rgba(26,39,64,0.6)'}`, borderRadius: 14, padding: '16px 20px', cursor: 'pointer', textAlign: 'left', transform: hover ? 'translateY(-3px)' : 'translateY(0)', boxShadow: hover ? '0 0 20px rgba(124,58,237,0.15), 0 8px 30px rgba(0,0,0,0.4)' : 'none', transition: 'all 200ms ease', animation: `fadeUp 300ms ease ${index * 60}ms both`, fontFamily: 'Inter, sans-serif' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, flex: '0 0 8px', boxShadow: `0 0 8px ${c}99`, animation: run.status === 'running' ? 'pulse-status 1.2s ease-in-out infinite' : 'none' }} />
      <span style={{ fontSize: 14, color: '#94A3B8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{run.prompt}</span>
      <span style={{ fontSize: 11, color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>{run.timestamp}</span>
      <span style={{ color: '#475569', transform: hover ? 'translateX(4px)' : 'translateX(0)', transition: 'transform 200ms ease' }}>→</span>
    </button>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: { maxWidth: 1180, margin: '0 auto', padding: '0 32px 80px', position: 'relative', zIndex: 1 },
  hero: { paddingTop: 120, paddingBottom: 60, textAlign: 'center' },
  eyebrow: { display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', color: '#06B6D4', border: '1px solid rgba(6,182,212,0.3)', background: 'rgba(6,182,212,0.08)', borderRadius: 100, padding: '6px 16px', marginBottom: 24 },
  heading: { fontSize: 72, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.05, color: '#E2E8F0', margin: '0 0 24px' },
  subtitle: { fontSize: 18, fontWeight: 400, color: '#94A3B8', maxWidth: 520, margin: '0 auto 32px', lineHeight: 1.55 },
  ctaRow: { display: 'flex', gap: 16, justifyContent: 'center' },
  promptWrap: { maxWidth: 720, margin: '40px auto 0', position: 'relative', zIndex: 10 },
  promptCard: { position: 'relative', background: 'rgba(13, 20, 36, 0.8)', backdropFilter: 'blur(24px)', border: '1px solid rgba(26, 39, 64, 0.9)', borderRadius: 20, padding: 32, boxShadow: '0 0 0 1px rgba(124,58,237,0.1), 0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)', transition: 'border-color 300ms ease' },
  conicBorder: { position: 'absolute', inset: -1, borderRadius: 21, background: 'conic-gradient(from 0deg, #7C3AED, #3B82F6, #06B6D4, #7C3AED)', animation: 'spin-conic 3s linear infinite', opacity: 0.4, zIndex: -1, filter: 'blur(2px)' },
  textarea: { width: '100%', minHeight: 120, maxHeight: 300, background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontFamily: 'Inter, sans-serif', fontSize: 15, color: '#E2E8F0', lineHeight: 1.65, caretColor: '#7C3AED', padding: 0, boxSizing: 'border-box' },
  promptBottom: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingTop: 20, borderTop: '1px solid rgba(26,39,64,0.6)' },
  recentWrap: { maxWidth: 720, margin: '60px auto 0' },
  recentLabel: { fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: '#475569', textTransform: 'uppercase', marginBottom: 16 },
  recentList: { display: 'flex', flexDirection: 'column', gap: 10 },
};
