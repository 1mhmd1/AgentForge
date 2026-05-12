import React, { useRef, useState } from 'react';
import { GlobeIcon, TransformIcon, DocIcon, LayoutIcon, ArrowRightIcon } from '../components/Icons';
import { AGENT_CATALOG, AgentCatalogEntry } from '../api/agents';

const ICON_MAP: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = { GlobeIcon, TransformIcon, DocIcon, LayoutIcon };

const SHADE: Record<string, string> = { '#06B6D4': '#0891B2', '#7C3AED': '#5B21B6', '#3B82F6': '#1D4ED8', '#F59E0B': '#B45309' };

interface AgentsProps {
  onNavigate: (page: string, id?: string) => void;
}

export default function Agents({ onNavigate }: AgentsProps) {
  return (
    <div data-responsive-root style={s.root}>
      <div style={s.header}>
        <h2 style={s.title}>Agents</h2>
        <p style={s.subtitle}>Pre-built specialists. Pick one to get started.</p>
      </div>
      <div style={s.grid}>
        {AGENT_CATALOG.map((a, i) => <AgentCard key={a.id} agent={a} index={i} onPick={() => onNavigate('home')} />)}
      </div>
    </div>
  );
}

function AgentCard({ agent, index, onPick }: { agent: AgentCatalogEntry; index: number; onPick: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState(false);
  const Icon = ICON_MAP[agent.icon];

  const handleMove = (e: React.MouseEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setTilt({ x: (e.clientY - r.top - r.height / 2) * 0.022, y: (e.clientX - r.left - r.width / 2) * 0.022 });
  };

  return (
    <div style={{ perspective: 1000, animation: `fadeUp 500ms var(--ease-spring) ${index * 80}ms both` }}>
      <div ref={ref} onMouseMove={handleMove} onMouseEnter={() => setHover(true)} onMouseLeave={() => { setHover(false); setTilt({ x: 0, y: 0 }); }} style={{ position: 'relative', background: 'rgba(13,20,36,0.7)', backdropFilter: 'blur(16px)', border: `1px solid ${hover ? agent.accent + '99' : 'rgba(26,39,64,0.6)'}`, borderRadius: 18, padding: 28, overflow: 'hidden', transform: `translateY(${hover ? -6 : 0}px) rotateX(${-tilt.x}deg) rotateY(${tilt.y}deg)`, transformStyle: 'preserve-3d', boxShadow: hover ? `0 0 30px ${agent.accent}40, 0 20px 40px rgba(0,0,0,0.5)` : 'none', transition: 'transform 250ms cubic-bezier(0.34, 1.56, 0.64, 1), border-color 250ms ease, box-shadow 250ms ease', cursor: 'pointer', minHeight: 220, fontFamily: 'Inter, sans-serif' }}>
        <div style={{ position: 'absolute', top: 18, right: 18, opacity: 0.06, color: agent.accent }}>
          {Icon && <Icon style={{ width: 80, height: 80 }} />}
        </div>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: `linear-gradient(135deg, ${agent.accent}, ${SHADE[agent.accent] || agent.accent})`, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 20px ${agent.accent}66`, marginBottom: 20 }}>
          {Icon && <Icon style={{ width: 24, height: 24 }} />}
        </div>
        <h3 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em', color: '#E2E8F0', margin: '0 0 8px' }}>{agent.name}</h3>
        <p style={{ fontSize: 14, color: '#94A3B8', lineHeight: 1.6, margin: '0 0 16px' }}>{agent.desc}</p>
        <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: agent.accent, background: agent.accent + '1a', border: `1px solid ${agent.accent}40`, padding: '3px 10px', borderRadius: 100 }}>{agent.tag}</span>
        <div style={{ marginTop: 20, opacity: hover ? 1 : 0, transform: `translateY(${hover ? 0 : 12}px)`, transition: 'all 200ms ease' }}>
          <button type="button" onClick={onPick} style={{ width: '100%', padding: '10px 16px', borderRadius: 10, background: `linear-gradient(135deg, ${agent.accent}, ${SHADE[agent.accent] || agent.accent})`, color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: `0 0 20px ${agent.accent}66` }}>
            Use Agent <ArrowRightIcon style={{ width: 14, height: 14 }} />
          </button>
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: { maxWidth: 1280, margin: '0 auto', padding: '40px 32px 80px', position: 'relative', zIndex: 1 },
  header: { marginBottom: 32 },
  title: { fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em', color: '#E2E8F0', margin: 0 },
  subtitle: { fontSize: 15, color: '#94A3B8', marginTop: 6 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 },
};
