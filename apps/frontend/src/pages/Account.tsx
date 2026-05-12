import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { listRuns, RunSummary } from '../api/runs';
import { toApiError } from '../api/client';
import { useViewport } from '../hooks/useViewport';

export default function Account() {
  const { user, logout } = useAuth();
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isMobile, isTablet } = useViewport();

  useEffect(() => {
    let cancelled = false;
    listRuns({ page: 1, perPage: 10 })
      .then((res) => {
        if (cancelled) return;
        setRuns(res.items ?? []);
        setTotal(res.total ?? 0);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(toApiError(err).message);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const displayName = user?.name || user?.email?.split('@')[0] || 'You';
  const displayEmail = user?.email || '';
  const initials =
    displayName
      .split(/[\s.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'U';

  const completed = runs.filter((r) => r.status === 'COMPLETED').length;
  const failed = runs.filter((r) => r.status === 'FAILED' || r.status === 'INTERRUPTED').length;
  const successRate = runs.length > 0 ? (completed / runs.length) * 100 : 0;

  // Responsive overrides for the page's rigid grids. Composed onto the base
  // style objects via spread so the desktop layout is preserved when these
  // booleans are false.
  const titleSize = isMobile ? 28 : isTablet ? 36 : 44;
  const rootPadding = isMobile ? '36px 14px 80px' : isTablet ? '48px 20px 100px' : '64px 32px 100px';
  const mainGridCols = isTablet ? '1fr' : 'repeat(2, 1fr)';
  const statGridCols = isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)';
  const fieldRowDir: React.CSSProperties['flexDirection'] = isMobile ? 'column' : 'row';

  return (
    <div data-responsive-root style={{ ...s.root, padding: rootPadding }}>
      <div style={s.headerRow}>
        <div>
          <div style={{ ...s.eyebrow, animation: 'fadeUp 500ms var(--ease-spring) both' }}>ACCOUNT</div>
          <h1 style={{ ...s.title, fontSize: titleSize, animation: 'fadeUp 600ms var(--ease-spring) 80ms both' }}>
            Your <span style={s.gradient}>workspace</span>
          </h1>
        </div>
        <div style={{ ...s.planBadge, animation: 'fadeUp 600ms var(--ease-spring) 200ms both' }}>
          <span style={s.planDot} />
          <span style={{ color: '#94A3B8', fontSize: 11, letterSpacing: '0.15em', fontWeight: 600 }}>ROLE</span>
          <span style={s.planName}>{user?.role ?? 'USER'}</span>
        </div>
      </div>

      <div style={{ ...s.grid, gridTemplateColumns: mainGridCols }}>
        <section style={{ ...s.card, animation: 'cardEntry 700ms var(--ease-spring) 300ms both' }}>
          <SectionTitle>Profile</SectionTitle>
          <div style={s.avatarRow}>
            <div style={s.avatar}><span>{initials}</span><span style={s.avatarRing} /></div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#E2E8F0', fontFamily: 'Inter, sans-serif' }}>{displayName}</div>
              <div style={{ fontSize: 13, color: '#94A3B8' }}>{displayEmail}</div>
            </div>
          </div>
          <div style={{ ...s.fieldRow, flexDirection: fieldRowDir }}>
            <Field label="Role" value={user?.role ?? 'USER'} />
            <Field label="User ID" value={user?.id ? user.id.slice(0, 12) : '—'} />
          </div>
          <div style={s.actionRow}>
            <Btn onClick={() => { logout().catch(() => { /* ignore */ }); }}>Sign out</Btn>
          </div>
        </section>

        <section style={{ ...s.card, animation: 'cardEntry 700ms var(--ease-spring) 400ms both' }}>
          <SectionTitle>Your runs</SectionTitle>
          {loading ? (
            <Skeleton />
          ) : error ? (
            <div style={s.errorBanner}>{error}</div>
          ) : total === 0 ? (
            <div style={{ padding: '20px 0', color: '#94A3B8', fontSize: 14 }}>
              You haven&apos;t kicked off any runs yet. Head back home to start one.
            </div>
          ) : (
            <>
              <div style={s.usageRow}>
                <span style={{ fontSize: 13, color: '#94A3B8' }}>Total runs</span>
                <span style={{ fontSize: 18, fontFamily: 'JetBrains Mono, monospace', color: '#E2E8F0', fontWeight: 700 }}>
                  {total.toLocaleString('en-US')}
                </span>
              </div>
              <div style={{ ...s.statGrid, gridTemplateColumns: statGridCols }}>
                <Stat label="Completed (recent)" value={String(completed)} tint="#22C55E" />
                <Stat label="Failed (recent)" value={String(failed)} tint="#EF4444" />
                <Stat label="Success rate" value={`${successRate.toFixed(1)}%`} tint={successRate >= 80 ? '#22C55E' : '#F59E0B'} />
                <Stat label="Recent window" value={String(runs.length)} tint="#06B6D4" />
              </div>
            </>
          )}
        </section>

        <section style={{ ...s.card, gridColumn: '1 / -1', animation: 'cardEntry 700ms var(--ease-spring) 500ms both' }}>
          <SectionTitle>Recent activity</SectionTitle>
          {loading ? (
            <Skeleton rows={4} />
          ) : error ? (
            <div style={s.errorBanner}>{error}</div>
          ) : runs.length === 0 ? (
            <div style={{ padding: '20px 0', color: '#94A3B8', fontSize: 14 }}>No activity yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {runs.map((r, i) => {
                const tint = statusTint(r.status);
                if (isMobile) {
                  // Mobile: dot + prompt on top row, status + time on bottom row.
                  // Keeps the prompt readable without truncation pressure from
                  // the two metadata cells crowding it on a narrow viewport.
                  return (
                    <div key={r.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 14px', borderRadius: 10, background: 'rgba(9,14,26,0.5)', border: '1px solid rgba(26,39,64,0.4)', animation: `fadeUp 400ms ease ${i * 40}ms both` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: tint, boxShadow: `0 0 8px ${tint}99`, flex: '0 0 8px' }} />
                        <span style={{ fontSize: 13, color: '#E2E8F0', fontFamily: 'Inter, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{r.prompt}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: 18, fontFamily: 'JetBrains Mono, monospace' }}>
                        <span style={{ fontSize: 11, color: '#94A3B8' }}>{r.status}</span>
                        <span style={{ fontSize: 11, color: '#475569' }}>{formatWhen(r.createdAt)}</span>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '24px 1fr auto auto', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 10, background: 'rgba(9,14,26,0.5)', border: '1px solid rgba(26,39,64,0.4)', animation: `fadeUp 400ms ease ${i * 40}ms both` }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: tint, boxShadow: `0 0 8px ${tint}99` }} />
                    <span style={{ fontSize: 14, color: '#E2E8F0', fontFamily: 'Inter, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.prompt}</span>
                    <span style={{ fontSize: 12, color: '#94A3B8', fontFamily: 'JetBrains Mono, monospace' }}>{r.status}</span>
                    <span style={{ fontSize: 11, color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>{formatWhen(r.createdAt)}</span>
                  </div>
                );
              })}
            </div>
          )}
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

function Btn({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  const [hover, setHover] = useState(false);
  return <button type="button" onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{ padding: '10px 16px', borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 500, background: hover ? 'rgba(124,58,237,0.08)' : 'transparent', border: `1px solid ${hover ? 'rgba(124,58,237,0.4)' : 'rgba(26,39,64,0.8)'}`, color: hover ? '#E2E8F0' : '#94A3B8', transition: 'all 200ms ease' }}>{children}</button>;
}

function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 8 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ height: 36, borderRadius: 10, background: 'linear-gradient(90deg, rgba(26,39,64,0.3), rgba(26,39,64,0.6), rgba(26,39,64,0.3))', backgroundSize: '200% 100%', animation: 'shimmer 1.5s linear infinite' }} />
      ))}
    </div>
  );
}

function statusTint(status: string): string {
  if (status === 'COMPLETED') return '#22C55E';
  if (status === 'FAILED' || status === 'INTERRUPTED') return '#EF4444';
  if (status === 'CANCELLED') return '#94A3B8';
  return '#3B82F6';
}

function formatWhen(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
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
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 28 },
  errorBanner: { padding: '14px 18px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.4)', color: '#FCA5A5', fontSize: 13 },
};
