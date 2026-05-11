import React, { useCallback, useEffect, useState } from 'react';
import {
  AdminUser,
  AnalyticsOverview,
  AuditLogEntry,
  Role,
  analyticsOverview,
  cancelAllActiveRuns,
  deleteUser,
  grantCredits,
  listAuditLogs,
  listUsers,
  suspendUser,
  unsuspendUser,
  updateUserRole,
} from '../api/admin';
import { toApiError } from '../api/client';

const ADMIN_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'members', label: 'Members' },
  { id: 'keys', label: 'API Keys' },
  { id: 'audit', label: 'Audit Log' },
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
            <div style={{ fontSize: 14, fontWeight: 700, color: '#E2E8F0', fontFamily: 'Inter, sans-serif' }}>AgentForge</div>
          </div>
          <div style={s.healthBadge}><span style={s.healthDot} />LIVE</div>
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

// ─── Overview ───────────────────────────────────────────────────────────────

function OverviewTab() {
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    analyticsOverview()
      .then((res) => { if (!cancelled) { setData(res); setLoading(false); } })
      .catch((err) => { if (!cancelled) { setError(toApiError(err).message); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  const onCancelAll = async () => {
    if (!confirm('Cancel ALL active runs system-wide?\n\nThis transitions every run in STARTED / PLANNING / BUILDING / VALIDATING to CANCELLED. Use this when stuck runs are blocking the concurrency guard.')) return;
    setCancelling(true);
    try {
      const res = await cancelAllActiveRuns();
      alert(`Cancelled ${res.cancelled} active run${res.cancelled === 1 ? '' : 's'}.`);
    } catch (err) {
      alert(`Cancel failed: ${toApiError(err).message}`);
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <CardSkeleton />;
  if (error) return <ErrorBanner message={error} />;
  if (!data) return <EmptyState message="No analytics data available yet." />;

  const failureRate = data.runs.failureRateLast30d;
  const successRate = 1 - failureRate;
  const stats = [
    { label: 'TOTAL RUNS', value: fmt(data.runs.total), sub: `${fmt(data.runs.last24h)} in last 24h`, tint: '#7C3AED' },
    { label: 'RUNS · 30 DAYS', value: fmt(data.runs.last30d), sub: `${fmt(data.runs.failedLast30d)} failed`, tint: '#3B82F6' },
    { label: 'MEMBERS', value: fmt(data.users.total), sub: `${fmt(data.users.active)} active · ${fmt(data.users.suspended)} suspended`, tint: '#06B6D4' },
    { label: 'SUCCESS RATE', value: `${(successRate * 100).toFixed(1)}%`, sub: `Quality score ${data.quality.avgValidationScore.toFixed(1)}`, tint: '#22C55E' },
  ];

  return (
    <div>
      <div style={s.statRow}>
        {stats.map((st, i) => (
          <div key={st.label} style={{ ...s.statCard, animation: `cardEntry 600ms var(--ease-spring) ${i * 80}ms both` }}>
            <div style={{ fontSize: 10, letterSpacing: '0.18em', color: '#475569', fontWeight: 600 }}>{st.label}</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: st.tint, fontFamily: 'JetBrains Mono, monospace', textShadow: `0 0 18px ${st.tint}66`, marginTop: 8 }}>{st.value}</div>
            <div style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'JetBrains Mono, monospace', marginTop: 6 }}>{st.sub}</div>
            <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 80% 0%, ${st.tint}33, transparent 60%)`, pointerEvents: 'none' }} />
          </div>
        ))}
      </div>
      <div style={{ ...s.card, animation: 'cardEntry 700ms var(--ease-spring) 320ms both', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div>
          <SectionTitle>Operations</SectionTitle>
          <div style={{ fontSize: 13, color: '#94A3B8', fontFamily: 'Inter, sans-serif', maxWidth: 600 }}>
            Cancel every non-terminal run in the system. Useful when stuck runs are tripping the concurrency guard and new submissions return 429.
          </div>
        </div>
        <button
          type="button"
          onClick={onCancelAll}
          disabled={cancelling}
          style={{ padding: '10px 18px', borderRadius: 10, background: cancelling ? 'rgba(239,68,68,0.4)' : 'linear-gradient(135deg, #EF4444, #F59E0B)', color: 'white', border: 'none', fontWeight: 700, fontSize: 13, fontFamily: 'Inter, sans-serif', cursor: cancelling ? 'wait' : 'pointer', boxShadow: cancelling ? 'none' : '0 0 24px rgba(239,68,68,0.4)', opacity: cancelling ? 0.6 : 1, transition: 'all 200ms ease', whiteSpace: 'nowrap' }}
        >
          {cancelling ? 'Cancelling…' : 'Cancel all active runs'}
        </button>
      </div>
      <div style={s.twoCol}>
        <div style={{ ...s.card, animation: 'cardEntry 700ms var(--ease-spring) 400ms both' }}>
          <SectionTitle>Templates &amp; subscriptions</SectionTitle>
          <KeyValueRow label="Templates indexed" value={fmt(data.templates.total)} />
          <KeyValueRow label="Active subscriptions" value={fmt(data.subscriptions.active)} />
          <KeyValueRow label="Total sessions" value={fmt(data.sessions.total)} />
          <KeyValueRow label="Avg semantic score" value={data.quality.avgSemanticScore.toFixed(2)} />
        </div>
        <div style={{ ...s.card, animation: 'cardEntry 700ms var(--ease-spring) 480ms both' }}>
          <SectionTitle>Recent failure rate</SectionTitle>
          <div style={{ fontSize: 48, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: failureRate > 0.05 ? '#F59E0B' : '#22C55E', textShadow: `0 0 20px ${failureRate > 0.05 ? '#F59E0B' : '#22C55E'}44`, marginTop: 4 }}>
            {(failureRate * 100).toFixed(2)}<span style={{ fontSize: 22, color: '#475569' }}>%</span>
          </div>
          <div style={{ fontSize: 13, color: '#94A3B8', marginTop: 8 }}>
            {fmt(data.runs.failedLast30d)} of {fmt(data.runs.last30d)} runs failed in the last 30 days.
          </div>
        </div>
      </div>
    </div>
  );
}

function KeyValueRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(26,39,64,0.4)' }}>
      <span style={{ fontSize: 13, color: '#94A3B8' }}>{label}</span>
      <span style={{ fontSize: 13, color: '#E2E8F0', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>{value}</span>
    </div>
  );
}

// ─── Members ────────────────────────────────────────────────────────────────

const ROLES: Role[] = ['USER', 'ADMIN', 'SUPER_ADMIN'];

function MembersTab() {
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [items, setItems] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 220);
    return () => clearTimeout(t);
  }, [q]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listUsers({ page, perPage, q: debouncedQ || undefined });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setLoading(false);
    }
  }, [page, perPage, debouncedQ]);

  useEffect(() => { reload(); }, [reload]);

  const onRoleChange = async (user: AdminUser, role: Role) => {
    if (role === user.role) return;
    setPendingId(user.id);
    try {
      await updateUserRole(user.id, role);
      await reload();
    } catch (err) {
      alert(`Role change failed: ${toApiError(err).message}`);
    } finally {
      setPendingId(null);
    }
  };

  const onSuspendToggle = async (user: AdminUser) => {
    setPendingId(user.id);
    try {
      if (user.isSuspended) await unsuspendUser(user.id);
      else await suspendUser(user.id, 'admin action from console');
      await reload();
    } catch (err) {
      alert(`Action failed: ${toApiError(err).message}`);
    } finally {
      setPendingId(null);
    }
  };

  const onDelete = async (user: AdminUser) => {
    if (!confirm(`Delete ${user.email}? This cannot be undone.`)) return;
    setPendingId(user.id);
    try {
      await deleteUser(user.id, 'admin action from console');
      await reload();
    } catch (err) {
      alert(`Delete failed: ${toApiError(err).message}`);
    } finally {
      setPendingId(null);
    }
  };

  const [grantTarget, setGrantTarget] = useState<AdminUser | null>(null);

  const onGrantSubmit = async (amount: number, reason: string) => {
    if (!grantTarget) return;
    const target = grantTarget;
    setPendingId(target.id);
    setGrantTarget(null);
    try {
      await grantCredits(target.id, amount, reason || undefined);
      await reload();
      alert(`Granted ${amount.toLocaleString('en-US')} credits to ${target.email}.`);
    } catch (err) {
      alert(`Grant failed: ${toApiError(err).message}`);
    } finally {
      setPendingId(null);
    }
  };

  const lastPage = Math.max(1, Math.ceil(total / perPage));

  return (
    <div style={{ ...s.card, animation: 'cardEntry 600ms var(--ease-spring) both' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
        <SectionTitle>Members · {fmt(total)}</SectionTitle>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} placeholder="Search by email or name…" style={s.searchInput} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.9fr 0.9fr 0.5fr 1fr', gap: 16, padding: '0 14px 12px', fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', color: '#475569', borderBottom: '1px solid rgba(26,39,64,0.5)' }}>
        <span>USER</span><span>ROLE</span><span>STATUS</span><span style={{ textAlign: 'right' }}>RUNS</span><span style={{ textAlign: 'right' }}>ACTIONS</span>
      </div>

      {loading && <SkeletonRows count={6} />}
      {!loading && error && <ErrorBanner message={error} />}
      {!loading && !error && items.length === 0 && <EmptyState message={debouncedQ ? `No users match "${debouncedQ}".` : 'No users yet.'} />}

      {!loading && !error && items.map((m, i) => {
        const initials = (m.name || m.email).split(/\s|@/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('') || '?';
        const tint = pickTint(m.id);
        const sc = m.isSuspended ? '#F59E0B' : m.isActive ? '#22C55E' : '#94A3B8';
        const isBusy = pendingId === m.id;
        return (
          <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.9fr 0.9fr 0.5fr 1fr', gap: 16, alignItems: 'center', padding: '14px', borderBottom: '1px solid rgba(26,39,64,0.3)', opacity: isBusy ? 0.6 : 1, animation: `fadeUp 380ms ease ${i * 30}ms both` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: `linear-gradient(135deg, ${tint}, ${tint}88)`, color: 'white', fontWeight: 700, fontSize: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 16px ${tint}66`, flex: '0 0 auto' }}>{initials}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, color: '#E2E8F0', fontWeight: 500, fontFamily: 'Inter, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name || m.email}</div>
                <div style={{ fontSize: 12, color: '#94A3B8', fontFamily: 'JetBrains Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</div>
              </div>
            </div>
            <select
              value={m.role}
              disabled={isBusy}
              onChange={(e) => onRoleChange(m, e.target.value as Role)}
              style={s.select}
            >
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#E2E8F0', fontFamily: 'JetBrains Mono, monospace' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc, boxShadow: `0 0 8px ${sc}` }} />
              {m.isSuspended ? 'suspended' : m.isActive ? 'active' : 'inactive'}
            </span>
            <span style={{ fontSize: 12, color: '#64748B', fontFamily: 'JetBrains Mono, monospace', textAlign: 'right' }}>{m._count?.runs ?? 0}</span>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <SecBtn onClick={() => setGrantTarget(m)} disabled={isBusy}>+ Credits</SecBtn>
              <SecBtn onClick={() => onSuspendToggle(m)} disabled={isBusy}>{m.isSuspended ? 'Unsuspend' : 'Suspend'}</SecBtn>
              <IconBtn onClick={() => onDelete(m)} disabled={isBusy} danger>×</IconBtn>
            </div>
          </div>
        );
      })}

      {!loading && !error && total > perPage && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, padding: '0 8px' }}>
          <span style={{ fontSize: 12, color: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}>
            Page {page} of {lastPage} · {fmt(total)} users
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <SecBtn onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>← Prev</SecBtn>
            <SecBtn onClick={() => setPage((p) => Math.min(lastPage, p + 1))} disabled={page >= lastPage}>Next →</SecBtn>
          </div>
        </div>
      )}

      {grantTarget && (
        <GrantCreditsModal
          user={grantTarget}
          onCancel={() => setGrantTarget(null)}
          onSubmit={onGrantSubmit}
        />
      )}
    </div>
  );
}

const GRANT_PRESETS = [
  { label: '$10', amount: 1000 },
  { label: '$100', amount: 10000 },
  { label: '$1,000', amount: 100000 },
  { label: '$10,000', amount: 1000000 },
];

function GrantCreditsModal({
  user,
  onCancel,
  onSubmit,
}: {
  user: AdminUser;
  onCancel: () => void;
  onSubmit: (amount: number, reason: string) => void;
}) {
  const [amount, setAmount] = useState('100000');
  const [reason, setReason] = useState('');

  const parsed = parseInt(amount.trim(), 10);
  const valid = Number.isInteger(parsed) && parsed > 0;

  const submit = () => {
    if (!valid) return;
    onSubmit(parsed, reason.trim());
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      onClick={onCancel}
      style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,12,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, animation: 'fadeIn 200ms ease both' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(440px, 92vw)', padding: 28, borderRadius: 16, background: 'rgba(13,20,36,0.96)', border: '1px solid rgba(124,58,237,0.4)', boxShadow: '0 30px 80px rgba(0,0,0,0.6), 0 0 24px rgba(124,58,237,0.2)', animation: 'cardEntry 320ms var(--ease-spring) both' }}
      >
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', color: '#A78BFA', marginBottom: 6, fontFamily: 'JetBrains Mono, monospace' }}>◈ GRANT CREDITS</div>
        <h3 style={{ fontSize: 18, color: '#E2E8F0', margin: '0 0 6px', fontFamily: 'Inter, sans-serif', fontWeight: 700 }}>Top up {user.name || user.email}</h3>
        <div style={{ fontSize: 12, color: '#64748B', fontFamily: 'JetBrains Mono, monospace', marginBottom: 22 }}>{user.email}</div>

        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: '#475569', marginBottom: 8, fontFamily: 'Inter, sans-serif' }}>AMOUNT (CENTS)</label>
        <input
          type="number"
          min={1}
          step={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          autoFocus
          style={{ width: '100%', padding: '12px 14px', borderRadius: 10, background: 'rgba(9,14,26,0.8)', border: `1px solid ${valid ? 'rgba(124,58,237,0.4)' : 'rgba(239,68,68,0.5)'}`, color: '#E2E8F0', fontFamily: 'JetBrains Mono, monospace', fontSize: 14, outline: 'none' }}
        />
        <div style={{ fontSize: 11, color: '#64748B', marginTop: 6, fontFamily: 'JetBrains Mono, monospace' }}>
          {valid ? `≈ $${(parsed / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}` : 'Enter a positive integer.'}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {GRANT_PRESETS.map((p) => (
            <button
              key={p.amount}
              type="button"
              onClick={() => setAmount(String(p.amount))}
              style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.3)', color: '#A78BFA', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, cursor: 'pointer' }}
            >
              {p.label}
            </button>
          ))}
        </div>

        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: '#475569', marginTop: 22, marginBottom: 8, fontFamily: 'Inter, sans-serif' }}>REASON (OPTIONAL)</label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          placeholder="e.g. promotional credit, refund, dev top-up"
          maxLength={500}
          style={{ width: '100%', padding: '12px 14px', borderRadius: 10, background: 'rgba(9,14,26,0.8)', border: '1px solid rgba(26,39,64,0.8)', color: '#E2E8F0', fontFamily: 'Inter, sans-serif', fontSize: 13, outline: 'none' }}
        />

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
          <SecBtn onClick={onCancel}>Cancel</SecBtn>
          <button
            type="button"
            onClick={submit}
            disabled={!valid}
            style={{ padding: '8px 16px', borderRadius: 8, background: valid ? 'linear-gradient(135deg, #7C3AED, #3B82F6)' : 'rgba(26,39,64,0.6)', color: 'white', border: 'none', fontWeight: 700, fontSize: 13, fontFamily: 'Inter, sans-serif', cursor: valid ? 'pointer' : 'not-allowed', boxShadow: valid ? '0 0 20px rgba(124,58,237,0.4)' : 'none', opacity: valid ? 1 : 0.5, transition: 'all 200ms ease' }}
          >
            Grant credits
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Audit Log ──────────────────────────────────────────────────────────────

function AuditTab() {
  const [items, setItems] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const perPage = 30;
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listAuditLogs({ page, perPage, action: actionFilter.trim() || undefined })
      .then((res) => { if (!cancelled) { setItems(res.items); setTotal(res.total); setLoading(false); } })
      .catch((err) => { if (!cancelled) { setError(toApiError(err).message); setLoading(false); } });
    return () => { cancelled = true; };
  }, [page, actionFilter]);

  return (
    <div style={{ ...s.card, animation: 'cardEntry 600ms var(--ease-spring) both' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <SectionTitle>Audit log · {fmt(total)}</SectionTitle>
        <input
          value={actionFilter}
          onChange={(e) => { setPage(1); setActionFilter(e.target.value); }}
          placeholder="Filter by action (e.g. ADMIN_USER_SUSPEND)…"
          style={{ ...s.searchInput, width: 320 }}
        />
      </div>
      {loading && <SkeletonRows count={6} />}
      {!loading && error && <ErrorBanner message={error} />}
      {!loading && !error && items.length === 0 && <EmptyState message="No audit events found." />}
      {!loading && !error && items.map((a, i) => (
        <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '110px 16px 1fr 180px 80px', gap: 14, alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid rgba(26,39,64,0.3)', animation: `fadeSlide 380ms ease ${i * 25}ms both` }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#475569' }}>{formatTime(a.createdAt)}</span>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: actionTint(a.action), boxShadow: `0 0 8px ${actionTint(a.action)}` }} />
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: actionTint(a.action), fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.action}</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.resource ?? '—'}{a.resourceId ? ` · ${a.resourceId.slice(0, 8)}` : ''}</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#475569', textAlign: 'right' }}>{a.userId ? a.userId.slice(0, 8) : 'system'}</span>
        </div>
      ))}
      {!loading && !error && total > perPage && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, padding: '0 8px' }}>
          <span style={{ fontSize: 12, color: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}>Page {page} of {Math.max(1, Math.ceil(total / perPage))}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <SecBtn onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>← Prev</SecBtn>
            <SecBtn onClick={() => setPage((p) => p + 1)} disabled={page * perPage >= total}>Next →</SecBtn>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Keys + Billing (no admin endpoint yet; show clean empty-state pointers) ─

function KeysTab() {
  return (
    <div style={{ ...s.card, animation: 'cardEntry 600ms var(--ease-spring) both' }}>
      <SectionTitle>Organization API keys</SectionTitle>
      <EmptyState
        message="Organization-level API keys aren't surfaced from a single admin endpoint yet."
        hint="API keys are scoped per user. View and rotate your own keys from Account, or look up a specific user's keys via Members → user detail."
      />
    </div>
  );
}

function BillingTab() {
  return (
    <div style={{ ...s.card, animation: 'cardEntry 600ms var(--ease-spring) both' }}>
      <SectionTitle>Billing</SectionTitle>
      <EmptyState
        message="Billing data isn't exposed through the admin console yet."
        hint="Subscriptions are tracked per user. Use Members → role/plan controls to adjust an individual account's plan."
      />
    </div>
  );
}

// ─── Shared primitives ──────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: '#475569', textTransform: 'uppercase', margin: '0 0 18px', fontFamily: 'Inter, sans-serif' }}>{children}</h2>;
}

function CardSkeleton() {
  return (
    <div style={{ ...s.card, animation: 'cardEntry 600ms var(--ease-spring) both' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ height: 18, borderRadius: 6, background: 'linear-gradient(90deg, rgba(26,39,64,0.4), rgba(26,39,64,0.7), rgba(26,39,64,0.4))', backgroundSize: '200% 100%', animation: 'shimmer 1.5s linear infinite' }} />
        ))}
      </div>
    </div>
  );
}

function SkeletonRows({ count }: { count: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 14 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ height: 48, borderRadius: 10, background: 'linear-gradient(90deg, rgba(26,39,64,0.3), rgba(26,39,64,0.6), rgba(26,39,64,0.3))', backgroundSize: '200% 100%', animation: 'shimmer 1.5s linear infinite' }} />
      ))}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div style={{ padding: '14px 18px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.4)', color: '#FCA5A5', fontSize: 13 }}>
      {message}
    </div>
  );
}

function EmptyState({ message, hint }: { message: string; hint?: string }) {
  return (
    <div style={{ padding: '36px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: 14, color: '#94A3B8', marginBottom: hint ? 8 : 0 }}>{message}</div>
      {hint && <div style={{ fontSize: 12, color: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}>{hint}</div>}
    </div>
  );
}

function SecBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      disabled={disabled}
      style={{ padding: '7px 12px', borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 500, background: hover && !disabled ? 'rgba(124,58,237,0.08)' : 'transparent', border: `1px solid ${hover && !disabled ? 'rgba(124,58,237,0.4)' : 'rgba(26,39,64,0.8)'}`, color: hover && !disabled ? '#E2E8F0' : '#94A3B8', opacity: disabled ? 0.5 : 1, transition: 'all 200ms ease' }}
    >
      {children}
    </button>
  );
}

function IconBtn({ children, onClick, danger, disabled }: { children: React.ReactNode; onClick?: () => void; danger?: boolean; disabled?: boolean }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      disabled={disabled}
      style={{ width: 32, height: 32, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: hover && !disabled ? (danger ? 'rgba(239,68,68,0.12)' : 'rgba(124,58,237,0.12)') : 'rgba(9,14,26,0.6)', border: `1px solid ${hover && !disabled ? (danger ? 'rgba(239,68,68,0.5)' : 'rgba(124,58,237,0.5)') : 'rgba(26,39,64,0.6)'}`, color: danger ? (hover && !disabled ? '#EF4444' : '#94A3B8') : (hover && !disabled ? '#A78BFA' : '#94A3B8'), fontSize: 14, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, transition: 'all 180ms ease' }}
    >
      {children}
    </button>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  return n.toLocaleString('en-US');
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', month: 'short', day: '2-digit' });
}

const TINTS = ['#7C3AED', '#3B82F6', '#06B6D4', '#22C55E', '#A78BFA', '#EC4899', '#F59E0B'];
function pickTint(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return TINTS[hash % TINTS.length];
}

function actionTint(action: string): string {
  if (action.includes('DELETE') || action.includes('FAIL')) return '#EF4444';
  if (action.includes('SUSPEND')) return '#F59E0B';
  if (action.includes('ROLE')) return '#7C3AED';
  if (action.includes('PLAN')) return '#A78BFA';
  if (action.includes('LOGIN') || action.includes('AUTH')) return '#06B6D4';
  return '#3B82F6';
}

// ─── Styles ─────────────────────────────────────────────────────────────────

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
  tab: { position: 'relative', padding: '8px 16px', borderRadius: 8, borderWidth: 1, borderStyle: 'solid', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 500, transition: 'all 200ms ease' },
  tabUnderline: { position: 'absolute', left: 12, right: 12, bottom: -17, height: 2, background: 'linear-gradient(90deg, #7C3AED, #06B6D4)', boxShadow: '0 0 8px rgba(124,58,237,0.6)', borderRadius: 2 },
  card: { padding: 28, borderRadius: 18, background: 'rgba(13,20,36,0.7)', backdropFilter: 'blur(20px)', border: '1px solid rgba(26,39,64,0.6)', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' },
  twoCol: { display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 },
  statRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 },
  statCard: { position: 'relative', overflow: 'hidden', padding: 20, borderRadius: 14, background: 'rgba(13,20,36,0.7)', backdropFilter: 'blur(16px)', border: '1px solid rgba(26,39,64,0.6)' },
  searchInput: { padding: '8px 14px', borderRadius: 8, background: 'rgba(9,14,26,0.7)', border: '1px solid rgba(26,39,64,0.6)', color: '#E2E8F0', fontFamily: 'Inter, sans-serif', fontSize: 13, outline: 'none', width: 240 },
  select: { padding: '6px 10px', borderRadius: 8, background: 'rgba(9,14,26,0.7)', border: '1px solid rgba(26,39,64,0.6)', color: '#E2E8F0', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, outline: 'none', cursor: 'pointer' },
};
