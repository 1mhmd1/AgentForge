import React, { useState, useEffect } from 'react';

const ACTIVITY = [
  { id: 1, text: 'Run completed', detail: 'Web Research · 5.3s', time: '2 min ago', tint: '#22C55E' },
  { id: 2, text: 'API key generated', detail: 'production-key-04', time: '1 hr ago', tint: '#06B6D4' },
  { id: 3, text: 'Run failed', detail: 'Website Builder · timeout', time: '3 hr ago', tint: '#EF4444' },
  { id: 4, text: 'Plan upgraded', detail: 'Free → Pro', time: 'Yesterday', tint: '#7C3AED' },
  { id: 5, text: 'Run completed', detail: 'Data Transform · 3.1s', time: 'Yesterday', tint: '#22C55E' },
];

export default function Account() {
  const [meterFill, setMeterFill] = useState(0);
  useEffect(() => { const t = setTimeout(() => setMeterFill(74.2), 200); return () => clearTimeout(t); }, []);

  return (
    <div style={s.root}>
      <div style={s.headerRow}>
        <div>
          <div style={{ ...s.eyebrow, animation: 'fadeUp 500ms var(--ease-spring) both' }}>ACCOUNT</div>
          <h1 style={{ ...s.title, animation: 'fadeUp 600ms var(--ease-spring) 80ms both' }}>
            Your <span style={s.gradient}>workspace</span>
          </h1>
        </div>
        <div style={{ ...s.planBadge, animation: 'fadeUp 600ms var(--ease-spring) 200ms both' }}>
          <span style={s.planDot} />
          <span style={{ color: '#94A3B8', fontSize: 11, letterSpacing: '0.15em', fontWeight: 600 }}>CURRENT PLAN</span>
          <span style={s.planName}>Pro</span>
        </div>
      </div>

      <div style={s.grid}>
        <section style={{ ...s.card, animation: 'cardEntry 700ms var(--ease-spring) 300ms both' }}>
          <SectionTitle>Profile</SectionTitle>
          <div style={s.avatarRow}>
            <div style={s.avatar}><span>EJ</span><span style={s.avatarRing} /></div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#E2E8F0', fontFamily: 'Inter, sans-serif' }}>Elena Jansen</div>
              <div style={{ fontSize: 13, color: '#94A3B8' }}>elena@blackforge.io</div>
            </div>
          </div>
          <div style={s.fieldRow}><Field label="Workspace" value="BlackForge Labs" /><Field label="Role" value="Owner" /></div>
          <div style={s.fieldRow}><Field label="Joined" value="Jan 15, 2025" /><Field label="Region" value="us-west-2" /></div>
          <div style={s.actionRow}><Btn>Edit profile</Btn><Btn>Manage API keys</Btn></div>
        </section>

        <section style={{ ...s.card, animation: 'cardEntry 700ms var(--ease-spring) 400ms both' }}>
          <SectionTitle>Usage this month</SectionTitle>
          <div style={s.usageRow}>
            <span style={{ fontSize: 13, color: '#94A3B8' }}>Runs</span>
            <span style={{ fontSize: 18, fontFamily: 'JetBrains Mono, monospace' }}>
              <span style={{ color: '#E2E8F0', fontWeight: 700 }}>742</span>
              <span style={{ color: '#475569' }}> / 1,000</span>
            </span>
          </div>
          <div style={s.meter}>
            <div style={{ ...s.meterFill, width: `${meterFill}%`, transition: 'width 1.6s cubic-bezier(0.16, 1, 0.3, 1)' }}>
              <div style={s.meterShine} />
            </div>
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              {[0, 25, 50, 75, 100].map((t) => (
                <div key={t} style={{ position: 'absolute', left: `${t}%`, top: 0, bottom: 0, width: 1, background: 'rgba(26,39,64,0.6)' }} />
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
            <span style={{ color: '#475569', fontSize: 12 }}>Resets in 18 days</span>
            <span style={{ color: '#22C55E', fontSize: 12, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' }}>74.2%</span>
          </div>
          <div style={s.statGrid}>
            <Stat label="Avg duration" value="4.2s" tint="#06B6D4" />
            <Stat label="Success rate" value="98.4%" tint="#22C55E" />
            <Stat label="Active agents" value="4" tint="#7C3AED" />
            <Stat label="API calls" value="1.2k" tint="#3B82F6" />
          </div>
          <div style={{ ...s.actionRow, marginTop: 24 }}>
            <PriBtn>Manage subscription</PriBtn>
            <Btn>View invoices</Btn>
          </div>
        </section>

        <section style={{ ...s.card, gridColumn: '1 / -1', animation: 'cardEntry 700ms var(--ease-spring) 500ms both' }}>
          <SectionTitle>Recent activity</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ACTIVITY.map((a, i) => (
              <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '24px 1fr auto auto', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 10, background: 'rgba(9,14,26,0.5)', border: '1px solid rgba(26,39,64,0.4)', animation: `fadeUp 400ms ease ${i * 60}ms both` }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: a.tint, boxShadow: `0 0 8px ${a.tint}99` }} />
                <span style={{ fontSize: 14, color: '#E2E8F0', fontFamily: 'Inter, sans-serif' }}>{a.text}</span>
                <span style={{ fontSize: 12, color: '#94A3B8', fontFamily: 'JetBrains Mono, monospace' }}>{a.detail}</span>
                <span style={{ fontSize: 11, color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>{a.time}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.15em', color: '#475569', marginBottom: 6 }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: 14, color: '#E2E8F0', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>{value}</div>
    </div>
  );
}

function Stat({ label, value, tint }: { label: string; value: string; tint: string }) {
  return (
    <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(9,14,26,0.6)', border: '1px solid rgba(26,39,64,0.5)' }}>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.15em', color: '#475569', marginBottom: 6 }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: tint, fontFamily: 'JetBrains Mono, monospace', textShadow: `0 0 12px ${tint}66` }}>{value}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: '#475569', textTransform: 'uppercase', margin: '0 0 24px', fontFamily: 'Inter, sans-serif' }}>{children}</h2>;
}

function PriBtn({ children }: { children: React.ReactNode }) {
  const [hover, setHover] = useState(false);
  return <button onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{ padding: '10px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600, color: 'white', background: 'linear-gradient(135deg, #7C3AED, #3B82F6)', boxShadow: hover ? '0 0 24px rgba(124,58,237,0.5)' : '0 0 12px rgba(124,58,237,0.25)', transform: hover ? 'scale(1.03)' : 'scale(1)', transition: 'all 200ms cubic-bezier(0.34, 1.56, 0.64, 1)' }}>{children}</button>;
}

function Btn({ children }: { children: React.ReactNode }) {
  const [hover, setHover] = useState(false);
  return <button onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{ padding: '10px 16px', borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 500, background: hover ? 'rgba(124,58,237,0.08)' : 'transparent', border: `1px solid ${hover ? 'rgba(124,58,237,0.4)' : 'rgba(26,39,64,0.8)'}`, color: hover ? '#E2E8F0' : '#94A3B8', transition: 'all 200ms ease' }}>{children}</button>;
}

const s: Record<string, React.CSSProperties> = {
  root: { maxWidth: 1080, margin: '0 auto', padding: '64px 32px 100px', position: 'relative', zIndex: 1 },
  headerRow: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 48, gap: 24, flexWrap: 'wrap' },
  eyebrow: { display: 'inline-block', fontSize: 11, fontWeight: 600, letterSpacing: '0.18em', color: '#A78BFA', marginBottom: 12 },
  title: { fontSize: 44, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.1, color: '#E2E8F0', margin: 0 },
  gradient: { background: 'linear-gradient(135deg, #7C3AED, #3B82F6, #06B6D4)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  planBadge: { display: 'inline-flex', alignItems: 'center', gap: 10, padding: '8px 16px', borderRadius: 100, background: 'rgba(13,20,36,0.7)', backdropFilter: 'blur(12px)', border: '1px solid rgba(124,58,237,0.3)', boxShadow: '0 0 24px rgba(124,58,237,0.2)' },
  planDot: { width: 8, height: 8, borderRadius: '50%', background: '#A78BFA', boxShadow: '0 0 8px #A78BFA' },
  planName: { fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 700, color: '#E2E8F0' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 },
  card: { padding: 28, borderRadius: 18, background: 'rgba(13,20,36,0.7)', backdropFilter: 'blur(20px)', border: '1px solid rgba(26,39,64,0.6)', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' },
  avatarRow: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 },
  avatar: { position: 'relative', width: 60, height: 60, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #7C3AED, #3B82F6, #06B6D4)', color: 'white', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 22, boxShadow: '0 0 30px rgba(124,58,237,0.5)' },
  avatarRing: { position: 'absolute', inset: -4, borderRadius: '50%', border: '2px solid rgba(124,58,237,0.4)', animation: 'humanoidRing 2.4s ease-out infinite' },
  fieldRow: { display: 'flex', gap: 24, marginBottom: 20 },
  actionRow: { display: 'flex', gap: 10, marginTop: 28, flexWrap: 'wrap' },
  usageRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 },
  meter: { position: 'relative', height: 12, background: 'rgba(9,14,26,0.9)', borderRadius: 100, overflow: 'hidden', border: '1px solid rgba(26,39,64,0.6)' },
  meterFill: { position: 'relative', height: '100%', background: 'linear-gradient(90deg, #7C3AED, #3B82F6, #06B6D4)', borderRadius: 100, boxShadow: '0 0 20px rgba(124,58,237,0.6), inset 0 1px 0 rgba(255,255,255,0.3)' },
  meterShine: { position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)', backgroundSize: '50% 100%', backgroundRepeat: 'no-repeat', animation: 'meterShine 2.4s ease-in-out infinite' },
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 28 },
};
