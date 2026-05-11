import React, { useState } from 'react';
import { MOCK_RUNS } from '../data/mockData';

export default function Runs({ onNavigate }: { onNavigate: (page: string, id?: string) => void }) {
  return (
    <div style={s.root}>
      <div style={s.header}>
        <h2 style={s.title}>Runs</h2>
        <p style={s.subtitle}>Every agent execution, logged.</p>
      </div>
      <div style={s.table}>
        <div style={s.headerRow}>
          <span style={{ flex: '0 0 130px' }}>ID</span>
          <span style={{ flex: 1 }}>Prompt</span>
          <span style={{ flex: '0 0 140px' }}>Agent</span>
          <span style={{ flex: '0 0 110px' }}>Status</span>
          <span style={{ flex: '0 0 90px' }}>Duration</span>
          <span style={{ flex: '0 0 90px', textAlign: 'right' }}>When</span>
        </div>
        {MOCK_RUNS.map((r, i) => (
          <RunRow key={r.id} run={r} index={i} onClick={() => onNavigate('run-exec', r.id)} />
        ))}
      </div>
    </div>
  );
}

function RunRow({ run, index, onClick }: { run: typeof MOCK_RUNS[0]; index: number; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  const badges: Record<string, { bg: string; color: string; border: string; label: string }> = {
    success: { bg: 'rgba(34,197,94,0.12)', color: '#22C55E', border: 'rgba(34,197,94,0.25)', label: 'Success' },
    running: { bg: 'rgba(59,130,246,0.12)', color: '#3B82F6', border: 'rgba(59,130,246,0.25)', label: 'Running' },
    failed:  { bg: 'rgba(239,68,68,0.12)', color: '#EF4444', border: 'rgba(239,68,68,0.25)', label: 'Failed' },
  };
  const b = badges[run.status];
  return (
    <div onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 24px', borderBottom: '1px solid rgba(26,39,64,0.3)', background: hover ? 'rgba(124,58,237,0.06)' : 'transparent', position: 'relative', cursor: 'pointer', transition: 'background 150ms ease', animation: `fadeUp 300ms ease ${index * 40}ms both`, fontFamily: 'Inter, sans-serif' }}>
      <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: hover ? 2 : 0, background: '#7C3AED', transition: 'width 150ms ease' }} />
      <span style={{ flex: '0 0 130px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#A78BFA' }}>{run.id}</span>
      <span style={{ flex: 1, fontSize: 14, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{run.prompt}</span>
      <span style={{ flex: '0 0 140px', fontSize: 13, color: '#94A3B8' }}>{run.agent}</span>
      <span style={{ flex: '0 0 110px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 100, background: b.bg, color: b.color, border: `1px solid ${b.border}` }}>
          {run.status === 'running' && <span style={{ width: 5, height: 5, borderRadius: '50%', background: b.color, animation: 'pulse-status 1.2s infinite' }} />}
          {b.label}
        </span>
      </span>
      <span style={{ flex: '0 0 90px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#475569' }}>{run.duration}</span>
      <span style={{ flex: '0 0 90px', fontSize: 12, color: '#475569', textAlign: 'right' }}>{run.timestamp}</span>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: { maxWidth: 1280, margin: '0 auto', padding: '40px 32px 80px', position: 'relative', zIndex: 1 },
  header: { marginBottom: 32 },
  title: { fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em', color: '#E2E8F0', margin: 0 },
  subtitle: { fontSize: 15, color: '#94A3B8', marginTop: 6 },
  table: { background: 'rgba(13,20,36,0.6)', border: '1px solid rgba(26,39,64,0.6)', borderRadius: 16, overflow: 'hidden' },
  headerRow: { display: 'flex', alignItems: 'center', gap: 16, padding: '14px 24px', background: 'rgba(9,14,26,0.8)', borderBottom: '1px solid rgba(26,39,64,0.6)', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#475569', fontFamily: 'Inter, sans-serif' },
};
