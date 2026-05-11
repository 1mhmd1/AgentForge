import React, { useState } from 'react';

const ADMIN_TABS = [
  { id: 'overview', label: 'Overview' }, { id: 'members', label: 'Members' },
  { id: 'keys', label: 'API Keys' }, { id: 'audit', label: 'Audit Log' },
  { id: 'billing', label: 'Billing' },
];

export default function Admin() {
  const [tab, setTab] = useState('overview');
  return (
    <div style={s.root}>
      <div style={s.headerRow}>
        <div>
          <div style={{ ...s.eyebrow, animation: 'fadeUp 500ms var(--ease-spring) both' }}>◈ ADMIN CONSOLE</div>
          <h1 style={{ ...s.title, animation: 'fadeUp 600ms var(--ease-spring) 80ms both' }}>
            Workspace <span style={s.gradient}>command</span>
          </h1>
        </div>
        <div style={{ ...s.orgBadge, animation: 'fadeUp 600ms var(--ease-spring) 200ms both' }}>
          <span style={s.orgRing} />
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.18em', color: '#475569', fontWeight: 600 }}>ORGANIZATION</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#E2E8F0', fontFamily: 'Inter, sans-serif' }}>BlackForge Labs</div>
          </div>
          <div style={s.healthBadge}><span style={s.healthDot} />HEALTHY</div>
        </div>
      </div>

      <div style={s.tabStrip}>
        {ADMIN_TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ ...s.tab, color: active ? '#E2E8F0' : '#64748B', borderColor: active ? 'rgba(124,58,237,0.5)' : 'rgba(26,39,64,0.6)', background: active ? 'rgba(124,58,237,0.08)' : 'transparent', boxShadow: active ? '0 0 18px rgba(124,58,237,0.25), inset 0 0 12px rgba(124,58,237,0.1)' : 'none' }}>
              {t.label}
              {active && <span style={s.tabUnderline} />}
            </button>
          );
        })}
      </div>

      <div key={tab} style={{ animation: 'pageIn 350ms var(--ease-spring) both' }}>
        {tab === 'overview' && <OverviewTab />}
        {tab === 'members' && <MembersTab />}
        {tab === 'keys' && <KeysTab />}
        {tab === 'audit' && <AuditTab />}
        {tab === 'billing' && <BillingTab />}
      </div>
    </div>
  );
}

function OverviewTab() {
  const stats = [
    { label: 'TOTAL RUNS', value: '14,832', delta: '+18%', tint: '#7C3AED' },
    { label: 'ACTIVE AGENTS', value: '12', delta: '+2', tint: '#3B82F6' },
    { label: 'MEMBERS', value: '24', delta: '+3', tint: '#06B6D4' },
    { label: 'SUCCESS RATE', value: '98.4%', delta: '+0.6pp', tint: '#22C55E' },
  ];
  return (
    <div>
      <div style={s.statRow}>
        {stats.map((st, i) => (
          <div key={st.label} style={{ ...s.statCard, animation: `cardEntry 600ms var(--ease-spring) ${i * 80}ms both` }}>
            <div style={{ fontSize: 10, letterSpacing: '0.18em', color: '#475569', fontWeight: 600 }}>{st.label}</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: st.tint, fontFamily: 'JetBrains Mono, monospace', textShadow: `0 0 18px ${st.tint}66`, marginTop: 8 }}>{st.value}</div>
            <div style={{ fontSize: 11, color: '#22C55E', fontFamily: 'JetBrains Mono, monospace', marginTop: 6 }}>▲ {st.delta} this month</div>
            <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 80% 0%, ${st.tint}33, transparent 60%)`, pointerEvents: 'none' }} />
          </div>
        ))}
      </div>
      <div style={s.twoCol}>
        <div style={{ ...s.card, animation: 'cardEntry 700ms var(--ease-spring) 400ms both' }}>
          <SectionTitle>Run volume · last 14 days</SectionTitle>
          <Sparkline />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 11, color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
            <span>Apr 21</span><span style={{ color: '#A78BFA' }}>peak: 1,842 runs</span><span>May 04</span>
          </div>
        </div>
        <div style={{ ...s.card, animation: 'cardEntry 700ms var(--ease-spring) 480ms both' }}>
          <SectionTitle>System status</SectionTitle>
          {[['API Gateway', 'ok', '42ms p95'], ['Orchestrator', 'ok', 'all regions'], ['Vector store', 'warn', 'elevated latency'], ['Webhooks', 'ok', '0 failures / 24h'], ['Model providers', 'ok', '4/4 online']].map(([label, status, detail]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(26,39,64,0.4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: status === 'ok' ? '#22C55E' : '#F59E0B', boxShadow: `0 0 8px ${status === 'ok' ? '#22C55E' : '#F59E0B'}` }} />
                <span style={{ fontSize: 13, color: '#E2E8F0' }}>{label}</span>
              </div>
              <span style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'JetBrains Mono, monospace' }}>{detail}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Sparkline() {
  const data = [42, 58, 51, 68, 72, 64, 88, 96, 81, 92, 110, 124, 102, 138];
  const max = Math.max(...data);
  const w = 600; const h = 120;
  const pts = data.map((d, i) => `${(i / (data.length - 1)) * w},${h - (d / max) * (h - 12) - 6}`);
  const path = `M ${pts.join(' L ')}`;
  const fill = `M 0,${h} L ${pts.join(' L ')} L ${w},${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 120, display: 'block' }}>
      <defs>
        <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#7C3AED" stopOpacity="0.5" /><stop offset="100%" stopColor="#7C3AED" stopOpacity="0" /></linearGradient>
        <linearGradient id="spark-line" x1="0" x2="1" y1="0" y2="0"><stop offset="0%" stopColor="#7C3AED" /><stop offset="50%" stopColor="#3B82F6" /><stop offset="100%" stopColor="#06B6D4" /></linearGradient>
      </defs>
      <path d={fill} fill="url(#spark-fill)" />
      <path d={path} fill="none" stroke="url(#spark-line)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 6px rgba(124,58,237,0.6))' }} />
    </svg>
  );
}

const MEMBERS = [
  { id: 1, name: 'Elena Jansen', email: 'elena@blackforge.io', role: 'Owner', status: 'active', initials: 'EJ', tint: '#7C3AED', last: '2m ago' },
  { id: 2, name: 'Marcus Reid', email: 'marcus@blackforge.io', role: 'Admin', status: 'active', initials: 'MR', tint: '#3B82F6', last: '14m ago' },
  { id: 3, name: 'Priya Shah', email: 'priya@blackforge.io', role: 'Developer', status: 'active', initials: 'PS', tint: '#06B6D4', last: '1h ago' },
  { id: 4, name: 'Tom Yamamoto', email: 'tom@blackforge.io', role: 'Developer', status: 'active', initials: 'TY', tint: '#22C55E', last: '3h ago' },
  { id: 5, name: 'Sara Okafor', email: 'sara@blackforge.io', role: 'Viewer', status: 'invited', initials: 'SO', tint: '#A78BFA', last: 'pending' },
  { id: 6, name: 'Liam Park', email: 'liam@blackforge.io', role: 'Developer', status: 'active', initials: 'LP', tint: '#EC4899', last: '2d ago' },
];

function MembersTab() {
  const [filter, setFilter] = useState('');
  const filtered = MEMBERS.filter((m) => m.name.toLowerCase().includes(filter.toLowerCase()) || m.email.toLowerCase().includes(filter.toLowerCase()));
  const roleMap: Record<string, { bg: string; border: string; color: string }> = { Owner: { bg: 'rgba(124,58,237,0.15)', border: 'rgba(124,58,237,0.45)', color: '#A78BFA' }, Admin: { bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.45)', color: '#60A5FA' }, Developer: { bg: 'rgba(6,182,212,0.12)', border: 'rgba(6,182,212,0.4)', color: '#67E8F9' }, Viewer: { bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.35)', color: '#94A3B8' } };
  return (
    <div style={{ ...s.card, animation: 'cardEntry 600ms var(--ease-spring) both' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
        <SectionTitle>Members · {MEMBERS.length}</SectionTitle>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search members…" style={s.searchInput} />
          <PriBtn>+ Invite</PriBtn>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.8fr 0.8fr 0.6fr', gap: 16, padding: '0 14px 12px', fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', color: '#475569', borderBottom: '1px solid rgba(26,39,64,0.5)' }}>
        <span>NAME</span><span>ROLE</span><span>STATUS</span><span style={{ textAlign: 'right' }}>LAST ACTIVE</span>
      </div>
      {filtered.map((m, i) => {
        const rc = roleMap[m.role] || roleMap.Viewer;
        const sc = m.status === 'active' ? '#22C55E' : '#F59E0B';
        return (
          <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.8fr 0.8fr 0.6fr', gap: 16, alignItems: 'center', padding: '14px', borderBottom: '1px solid rgba(26,39,64,0.3)', animation: `fadeUp 380ms ease ${i * 50}ms both` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: `linear-gradient(135deg, ${m.tint}, ${m.tint}88)`, color: 'white', fontWeight: 700, fontSize: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 16px ${m.tint}66`, flex: '0 0 auto' }}>{m.initials}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, color: '#E2E8F0', fontWeight: 500, fontFamily: 'Inter, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                <div style={{ fontSize: 12, color: '#94A3B8', fontFamily: 'JetBrains Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</div>
              </div>
            </div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 100, background: rc.bg, border: `1px solid ${rc.border}`, fontSize: 11, fontWeight: 600, color: rc.color, letterSpacing: '0.05em' }}>{m.role}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#E2E8F0', fontFamily: 'JetBrains Mono, monospace' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: sc, boxShadow: `0 0 8px ${sc}` }} />{m.status}</span>
            <span style={{ fontSize: 12, color: '#64748B', fontFamily: 'JetBrains Mono, monospace', textAlign: 'right' }}>{m.last}</span>
          </div>
        );
      })}
    </div>
  );
}

const KEYS = [
  { id: 1, name: 'production-key-04', prefix: 'sk_live_a8f2', created: 'Apr 14, 2025', last: '2m ago', env: 'prod' },
  { id: 2, name: 'staging-key', prefix: 'sk_test_4c91', created: 'Mar 02, 2025', last: '1d ago', env: 'staging' },
  { id: 3, name: 'ci-runner', prefix: 'sk_live_de77', created: 'Feb 18, 2025', last: '4h ago', env: 'prod' },
  { id: 4, name: 'priya-local', prefix: 'sk_test_ff10', created: 'Jan 30, 2025', last: '12d ago', env: 'dev' },
];

const ENV_MAP: Record<string, { color: string; bg: string; border: string }> = { prod: { color: '#EF4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.4)' }, staging: { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.4)' }, dev: { color: '#06B6D4', bg: 'rgba(6,182,212,0.12)', border: 'rgba(6,182,212,0.4)' } };

function KeysTab() {
  const [revealed, setRevealed] = useState<number | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  return (
    <div style={{ ...s.card, animation: 'cardEntry 600ms var(--ease-spring) both' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <SectionTitle>API Keys · {KEYS.length}</SectionTitle>
        <PriBtn>+ Generate key</PriBtn>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {KEYS.map((k, i) => {
          const ec = ENV_MAP[k.env];
          return (
            <div key={k.id} style={{ display: 'flex', alignItems: 'center', gap: 18, padding: 16, borderRadius: 12, background: 'rgba(9,14,26,0.5)', border: '1px solid rgba(26,39,64,0.5)', animation: `fadeUp 400ms ease ${i * 60}ms both` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, flex: 1 }}>
                <span style={{ width: 36, height: 36, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(6,182,212,0.2))', border: '1px solid rgba(124,58,237,0.4)', color: '#A78BFA', fontSize: 18, boxShadow: '0 0 12px rgba(124,58,237,0.25)' }}>⌬</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 14, color: '#E2E8F0', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>{k.name}</span>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', background: ec.bg, border: `1px solid ${ec.border}`, color: ec.color, fontFamily: 'JetBrains Mono, monospace' }}>{k.env}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#94A3B8', fontFamily: 'JetBrains Mono, monospace', marginTop: 4 }}>
                    {revealed === k.id ? `${k.prefix}••••••••••••••••••••${k.id}af` : `${k.prefix}${'•'.repeat(20)}`}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: '#64748B', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap' }}>created {k.created} · last {k.last}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <IconBtn onClick={() => setRevealed(revealed === k.id ? null : k.id)}>{revealed === k.id ? '⊘' : '⊙'}</IconBtn>
                <IconBtn onClick={() => { setCopied(k.id); setTimeout(() => setCopied(null), 1200); }}>{copied === k.id ? '✓' : '⧉'}</IconBtn>
                <IconBtn danger>×</IconBtn>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const AUDIT = [
  { time: '14:08:22', actor: 'elena@blackforge.io', action: 'role.update', target: 'liam → Developer', tint: '#7C3AED' },
  { time: '13:51:04', actor: 'system', action: 'agent.deploy', target: 'web_research_v3', tint: '#3B82F6' },
  { time: '13:42:19', actor: 'marcus@blackforge.io', action: 'key.create', target: 'sk_live_a8f2…', tint: '#06B6D4' },
  { time: '12:18:55', actor: 'priya@blackforge.io', action: 'run.cancel', target: 'run_8f2c9a', tint: '#F59E0B' },
  { time: '11:04:12', actor: 'elena@blackforge.io', action: 'member.invite', target: 'sara@blackforge.io', tint: '#22C55E' },
  { time: '10:33:08', actor: 'system', action: 'billing.charge', target: '$240.00 · Pro', tint: '#A78BFA' },
  { time: '09:51:47', actor: 'tom@blackforge.io', action: 'agent.update', target: 'data_transform_v2', tint: '#3B82F6' },
  { time: '09:14:02', actor: 'system', action: 'webhook.fail', target: 'https://hooks.slack…', tint: '#EF4444' },
];

function AuditTab() {
  return (
    <div style={{ ...s.card, animation: 'cardEntry 600ms var(--ease-spring) both' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <SectionTitle>Audit log · 24h</SectionTitle>
        <div style={{ display: 'flex', gap: 8 }}><SecBtn>Filter</SecBtn><SecBtn>Export CSV</SecBtn></div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {AUDIT.map((a, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '80px 16px 200px 160px 1fr', gap: 14, alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid rgba(26,39,64,0.3)', animation: `fadeSlide 380ms ease ${i * 40}ms both` }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#475569' }}>{a.time}</span>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: a.tint, boxShadow: `0 0 8px ${a.tint}` }} />
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.actor}</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: a.tint, fontWeight: 600 }}>{a.action}</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#E2E8F0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.target}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BillingTab() {
  const invoices = [
    { id: 'INV-0428', period: 'Mar 04 → Apr 04', amount: '$1,108.20', status: 'paid' },
    { id: 'INV-0392', period: 'Feb 04 → Mar 04', amount: '$994.50', status: 'paid' },
    { id: 'INV-0356', period: 'Jan 04 → Feb 04', amount: '$842.10', status: 'paid' },
    { id: 'INV-0321', period: 'Dec 04 → Jan 04', amount: '$612.00', status: 'paid' },
  ];
  return (
    <div style={s.twoCol}>
      <div style={{ ...s.card, animation: 'cardEntry 600ms var(--ease-spring) both' }}>
        <SectionTitle>Current cycle</SectionTitle>
        <div style={{ fontSize: 48, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#E2E8F0', textShadow: '0 0 20px rgba(124,58,237,0.4)' }}>$1,284<span style={{ fontSize: 22, color: '#475569' }}>.50</span></div>
        <div style={{ fontSize: 13, color: '#94A3B8', marginTop: 6 }}>Apr 04 → May 04 · Pro plan</div>
        <div style={{ height: 1, background: 'rgba(26,39,64,0.6)', margin: '24px 0' }} />
        {[['Base subscription', '$240.00'], ['Run overage (842 × $0.04)', '$33.68'], ['API requests (104k × $0.001)', '$104.00'], ['Premium models', '$906.82']].map(([label, value]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(26,39,64,0.3)' }}>
            <span style={{ fontSize: 13, color: '#94A3B8' }}>{label}</span>
            <span style={{ fontSize: 13, color: '#E2E8F0', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>{value}</span>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}><PriBtn>Upgrade plan</PriBtn><SecBtn>Update card</SecBtn></div>
      </div>
      <div style={{ ...s.card, animation: 'cardEntry 600ms var(--ease-spring) 100ms both' }}>
        <SectionTitle>Recent invoices</SectionTitle>
        {invoices.map((inv, i) => (
          <div key={inv.id} style={{ display: 'grid', gridTemplateColumns: '110px 1fr auto auto', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: '1px solid rgba(26,39,64,0.4)', animation: `fadeUp 400ms ease ${i * 60}ms both` }}>
            <span style={{ fontSize: 12, color: '#A78BFA', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>{inv.id}</span>
            <span style={{ fontSize: 12, color: '#94A3B8', fontFamily: 'JetBrains Mono, monospace' }}>{inv.period}</span>
            <span style={{ fontSize: 13, color: '#E2E8F0', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>{inv.amount}</span>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 4, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.4)', color: '#22C55E', fontFamily: 'JetBrains Mono, monospace' }}>{inv.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: '#475569', textTransform: 'uppercase', margin: '0 0 18px', fontFamily: 'Inter, sans-serif' }}>{children}</h2>;
}

function PriBtn({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  const [hover, setHover] = useState(false);
  return <button onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{ padding: '9px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600, color: 'white', background: 'linear-gradient(135deg, #7C3AED, #3B82F6)', boxShadow: hover ? '0 0 24px rgba(124,58,237,0.5)' : '0 0 12px rgba(124,58,237,0.25)', transform: hover ? 'scale(1.03)' : 'scale(1)', transition: 'all 200ms cubic-bezier(0.34, 1.56, 0.64, 1)' }}>{children}</button>;
}

function SecBtn({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  const [hover, setHover] = useState(false);
  return <button onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{ padding: '9px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 500, background: hover ? 'rgba(124,58,237,0.08)' : 'transparent', border: `1px solid ${hover ? 'rgba(124,58,237,0.4)' : 'rgba(26,39,64,0.8)'}`, color: hover ? '#E2E8F0' : '#94A3B8', transition: 'all 200ms ease' }}>{children}</button>;
}

function IconBtn({ children, onClick, danger }: { children: React.ReactNode; onClick?: () => void; danger?: boolean }) {
  const [hover, setHover] = useState(false);
  return <button onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{ width: 32, height: 32, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: hover ? (danger ? 'rgba(239,68,68,0.12)' : 'rgba(124,58,237,0.12)') : 'rgba(9,14,26,0.6)', border: `1px solid ${hover ? (danger ? 'rgba(239,68,68,0.5)' : 'rgba(124,58,237,0.5)') : 'rgba(26,39,64,0.6)'}`, color: danger ? (hover ? '#EF4444' : '#94A3B8') : (hover ? '#A78BFA' : '#94A3B8'), fontSize: 14, cursor: 'pointer', transition: 'all 180ms ease' }}>{children}</button>;
}

const s: Record<string, React.CSSProperties> = {
  root: { maxWidth: 1180, margin: '0 auto', padding: '64px 32px 100px', position: 'relative', zIndex: 1 },
  headerRow: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, marginBottom: 36, flexWrap: 'wrap' },
  eyebrow: { display: 'inline-block', fontSize: 11, fontWeight: 600, letterSpacing: '0.18em', color: '#A78BFA', marginBottom: 12, fontFamily: 'JetBrains Mono, monospace' },
  title: { fontSize: 44, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.1, color: '#E2E8F0', margin: 0, fontFamily: 'Inter, sans-serif' },
  gradient: { background: 'linear-gradient(135deg, #7C3AED, #3B82F6, #06B6D4)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  orgBadge: { position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 14, padding: '12px 18px', borderRadius: 14, background: 'rgba(13,20,36,0.7)', backdropFilter: 'blur(16px)', border: '1px solid rgba(124,58,237,0.3)', boxShadow: '0 0 24px rgba(124,58,237,0.2)' },
  orgRing: { width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #7C3AED, #06B6D4)', boxShadow: '0 0 20px rgba(124,58,237,0.6), inset 0 1px 0 rgba(255,255,255,0.2)' },
  healthBadge: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 100, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.4)', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#22C55E', fontFamily: 'JetBrains Mono, monospace' },
  healthDot: { width: 6, height: 6, borderRadius: '50%', background: '#22C55E', boxShadow: '0 0 8px #22C55E', animation: 'pulse-status 1.4s ease-in-out infinite', marginRight: 4 },
  tabStrip: { display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap', paddingBottom: 16, borderBottom: '1px solid rgba(26,39,64,0.5)' },
  tab: { position: 'relative', padding: '8px 16px', borderRadius: 8, border: '1px solid', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 500, transition: 'all 200ms ease' },
  tabUnderline: { position: 'absolute', left: 12, right: 12, bottom: -17, height: 2, background: 'linear-gradient(90deg, #7C3AED, #06B6D4)', boxShadow: '0 0 8px rgba(124,58,237,0.6)', borderRadius: 2 },
  card: { padding: 28, borderRadius: 18, background: 'rgba(13,20,36,0.7)', backdropFilter: 'blur(20px)', border: '1px solid rgba(26,39,64,0.6)', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' },
  twoCol: { display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 },
  statRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 },
  statCard: { position: 'relative', overflow: 'hidden', padding: 20, borderRadius: 14, background: 'rgba(13,20,36,0.7)', backdropFilter: 'blur(16px)', border: '1px solid rgba(26,39,64,0.6)' },
  searchInput: { padding: '8px 14px', borderRadius: 8, background: 'rgba(9,14,26,0.7)', border: '1px solid rgba(26,39,64,0.6)', color: '#E2E8F0', fontFamily: 'Inter, sans-serif', fontSize: 13, outline: 'none', width: 220 },
};
