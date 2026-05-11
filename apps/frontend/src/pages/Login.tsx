import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { apiBaseUrl, toApiError } from '../api/client';
import { EyeIcon, EyeOffIcon, SparkleIcon, SpinnerIcon } from '../components/Icons';

type Mode = 'login' | 'register';

export default function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // The backend's Google OAuth flow lives at GET /api/auth/google. We must
  // do a full-page navigation (NOT XHR/fetch) because Passport redirects to
  // Google's consent screen. The callback handler on the backend then
  // redirects back to the frontend with cookies set.
  const googleHref = `${apiBaseUrl().replace(/\/$/, '')}/auth/google`;

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
          <div style={s.passwordWrap}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? 'At least 8 characters' : 'Your password'}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={mode === 'register' ? 8 : 1}
              required
              style={{ ...s.input, paddingRight: 44 }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              style={s.eyeBtn}
              tabIndex={-1}
            >
              {showPassword ? <EyeOffIcon style={{ width: 18, height: 18 }} /> : <EyeIcon style={{ width: 18, height: 18 }} />}
            </button>
          </div>
        </label>

        {error && <div style={s.error}>{error}</div>}

        <button type="submit" disabled={busy} style={{ ...s.cta, opacity: busy ? 0.75 : 1, cursor: busy ? 'not-allowed' : 'pointer' }}>
          {busy ? <><SpinnerIcon size={14} /> {mode === 'login' ? 'Signing in...' : 'Creating account...'}</> : (mode === 'login' ? 'Sign in' : 'Create account')}
        </button>

        <div style={s.dividerRow}>
          <span style={s.dividerLine} />
          <span style={s.dividerText}>OR</span>
          <span style={s.dividerLine} />
        </div>

        <a href={googleHref} style={s.googleBtn}>
          <GoogleLogo />
          <span>Continue with Google</span>
        </a>

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

function GoogleLogo() {
  // Official Google "G" mark, multi-color brand SVG.
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/>
    </svg>
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
  input: { width: '100%', boxSizing: 'border-box', background: 'rgba(9,14,26,0.9)', border: '1px solid rgba(26,39,64,0.8)', borderRadius: 10, padding: '12px 14px', color: '#E2E8F0', fontSize: 14, fontFamily: 'Inter, sans-serif', outline: 'none' },
  passwordWrap: { position: 'relative', display: 'flex', alignItems: 'stretch' },
  eyeBtn: { position: 'absolute', top: 0, right: 0, bottom: 0, width: 40, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 0 },
  error: { fontSize: 13, color: '#FCA5A5', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', padding: '10px 12px', borderRadius: 8 },
  cta: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px 24px', borderRadius: 10, background: 'linear-gradient(135deg, #7C3AED, #3B82F6)', color: 'white', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 15, border: 'none', boxShadow: '0 0 30px rgba(124,58,237,0.4), 0 4px 15px rgba(0,0,0,0.3)' },
  switch: { background: 'transparent', border: 'none', color: '#A78BFA', fontSize: 13, fontFamily: 'Inter, sans-serif', cursor: 'pointer', padding: '4px 0', textAlign: 'center' },
  dividerRow: { display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0' },
  dividerLine: { flex: 1, height: 1, background: 'rgba(26,39,64,0.8)' },
  dividerText: { fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: '#475569', fontFamily: 'Inter, sans-serif' },
  googleBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '12px 18px', borderRadius: 10, background: '#FFFFFF', color: '#1F2937', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 14, textDecoration: 'none', border: '1px solid rgba(26,39,64,0.8)', cursor: 'pointer', transition: 'transform 200ms ease, box-shadow 200ms ease' },
};
