import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { toApiError } from '../api/client';
import { SparkleIcon, SpinnerIcon } from '../components/Icons';

type Mode = 'login' | 'register';

export default function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(email.trim(), password);
      } else {
        await register(email.trim(), password, name.trim() || undefined);
      }
    } catch (err) {
      const api = toApiError(err);
      setError(api.message || 'Authentication failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={s.root}>
      <form style={s.card} onSubmit={submit}>
        <div style={s.eyebrow}>
          <SparkleIcon style={{ width: 12, height: 12 }} />
          {mode === 'login' ? 'WELCOME BACK' : 'CREATE ACCOUNT'}
        </div>
        <h1 style={s.title}>
          {mode === 'login' ? 'Sign in' : 'Sign up'} to{' '}
          <span style={s.gradient}>AgentForge</span>
        </h1>
        <p style={s.subtitle}>
          {mode === 'login'
            ? 'Continue to your orchestration dashboard.'
            : 'Spin up your first AI agent in seconds.'}
        </p>

        {mode === 'register' && (
          <label style={s.field}>
            <span style={s.label}>Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name (optional)"
              autoComplete="name"
              style={s.input}
            />
          </label>
        )}

        <label style={s.field}>
          <span style={s.label}>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
            style={s.input}
          />
        </label>

        <label style={s.field}>
          <span style={s.label}>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === 'register' ? 'At least 8 characters' : 'Your password'}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            minLength={mode === 'register' ? 8 : 1}
            required
            style={s.input}
          />
        </label>

        {error && <div style={s.error}>{error}</div>}

        <button type="submit" disabled={busy} style={{ ...s.cta, opacity: busy ? 0.75 : 1, cursor: busy ? 'not-allowed' : 'pointer' }}>
          {busy ? <><SpinnerIcon size={14} /> {mode === 'login' ? 'Signing in...' : 'Creating account...'}</> : (mode === 'login' ? 'Sign in' : 'Create account')}
        </button>

        <button
          type="button"
          onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}
          style={s.switch}
        >
          {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </form>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', position: 'relative', zIndex: 1 },
  card: { width: '100%', maxWidth: 440, background: 'rgba(13,20,36,0.8)', backdropFilter: 'blur(24px)', border: '1px solid rgba(26,39,64,0.9)', borderRadius: 20, padding: 36, boxShadow: '0 0 0 1px rgba(124,58,237,0.1), 0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: 18 },
  eyebrow: { display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', color: '#06B6D4', border: '1px solid rgba(6,182,212,0.3)', background: 'rgba(6,182,212,0.08)', borderRadius: 100, padding: '6px 14px' },
  title: { fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', color: '#E2E8F0', margin: 0, lineHeight: 1.15 },
  gradient: { background: 'linear-gradient(135deg, #7C3AED 0%, #3B82F6 50%, #06B6D4 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  subtitle: { fontSize: 14, color: '#94A3B8', margin: 0 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', color: '#94A3B8', textTransform: 'uppercase' },
  input: { background: 'rgba(9,14,26,0.9)', border: '1px solid rgba(26,39,64,0.8)', borderRadius: 10, padding: '12px 14px', color: '#E2E8F0', fontSize: 14, fontFamily: 'Inter, sans-serif', outline: 'none' },
  error: { fontSize: 13, color: '#FCA5A5', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', padding: '10px 12px', borderRadius: 8 },
  cta: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px 24px', borderRadius: 10, background: 'linear-gradient(135deg, #7C3AED, #3B82F6)', color: 'white', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 15, border: 'none', boxShadow: '0 0 30px rgba(124,58,237,0.4), 0 4px 15px rgba(0,0,0,0.3)' },
  switch: { background: 'transparent', border: 'none', color: '#A78BFA', fontSize: 13, fontFamily: 'Inter, sans-serif', cursor: 'pointer', padding: '4px 0', textAlign: 'center' },
};
