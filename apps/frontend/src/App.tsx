import React, { useEffect, useRef, useState } from 'react';
import BackgroundLayers from './components/BackgroundLayers';
import Navbar from './components/Navbar';
import RoboticCursor from './components/RoboticCursor';
import SleepingMascot from './components/SleepingMascot';
import Home from './pages/Home';
import RunExecution from './pages/RunExecution';
import Runs from './pages/Runs';
import Agents from './pages/Agents';
import Pricing from './pages/Pricing';
import Account from './pages/Account';
import Admin from './pages/Admin';
import Settings from './pages/Settings';
import Login from './pages/Login';
import { AuthProvider, useAuth } from './auth/AuthContext';
import RoleGate, { Forbidden } from './auth/RoleGate';
import { SpinnerIcon } from './components/Icons';

export default function App() {
  return (
    <AuthProvider>
      <BackgroundLayers />
      <AppShell />
    </AuthProvider>
  );
}

function AppShell() {
  const { status, user } = useAuth();
  const [page, setPage] = useState('home');
  const [runId, setRunId] = useState<string | null>(null);
  const [warpKey, setWarpKey] = useState(0);
  const prevStatus = useRef(status);

  // When the user finishes authenticating (loading/unauthenticated -> authenticated),
  // force-land on the home page. Covers Google OAuth callbacks that may bring
  // back a non-home path AND any case where the form submission completes from
  // a deep-linked previous page state.
  useEffect(() => {
    if (prevStatus.current !== 'authenticated' && status === 'authenticated') {
      setPage('home');
      setRunId(null);
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
    prevStatus.current = status;
  }, [status]);

  const navigate = (p: string, id?: string) => {
    setWarpKey((k) => k + 1);
    setPage(p);
    if (id !== undefined) setRunId(id);
    // Every page transition starts at the top -- otherwise users land mid-page
    // (e.g. on the terminal in run-exec) just because the previous page was
    // scrolled. 'auto' is instant so it slides under the warpFlash overlay.
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const goToChat = () => {
    const scrollAndFocus = () => {
      const target = document.getElementById('prompt-section');
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const ta = target.querySelector('textarea') as HTMLTextAreaElement | null;
      if (ta) setTimeout(() => ta.focus(), 700);
    };
    if (page !== 'home') {
      navigate('home');
      setTimeout(scrollAndFocus, 500);
    } else {
      scrollAndFocus();
    }
  };

  if (status === 'loading') return <Splash />;
  if (status === 'unauthenticated') return <Login />;

  let content: React.ReactNode;
  switch (page) {
    case 'run-exec': content = <RunExecution runId={runId} onNavigate={navigate} />; break;
    case 'runs':     content = <Runs onNavigate={navigate} />; break;
    case 'agents':   content = <Agents onNavigate={navigate} />; break;
    case 'pricing':  content = <Pricing />; break;
    case 'account':  content = <Account />; break;
    case 'admin':    content = <RoleGate allow={['ADMIN', 'SUPER_ADMIN']} fallback={<Forbidden />}><Admin /></RoleGate>; break;
    case 'settings': content = <Settings />; break;
    default:         content = <Home onNavigate={navigate} />;
  }

  return (
    <>
      <Navbar current={page === 'run-exec' ? 'runs' : page === 'home' ? null : page} onNavigate={navigate} />
      <SleepingMascot onGoToChat={goToChat} userName={
        (user as any)?.name?.split(' ')[0] ||
        user?.email?.split('@')[0]?.replace(/[._-]/g, ' ')?.split(' ')[0]?.replace(/^\w/, (c: string) => c.toUpperCase()) ||
        'there'
      } />
      <RoboticCursor />
      <div key={page} data-page-root="" style={{ animation: 'pageIn 350ms var(--ease-spring) forwards', position: 'relative', zIndex: 1 }}>
        {content}
      </div>
      <div
        key={warpKey}
        style={{
          position: 'fixed', inset: 0, zIndex: 200, pointerEvents: 'none',
          background: 'linear-gradient(90deg, transparent 0%, rgba(124,58,237,0.5) 30%, rgba(59,130,246,0.7) 50%, rgba(6,182,212,0.5) 70%, transparent 100%)',
          mixBlendMode: 'screen',
          animation: 'warpFlash 280ms ease-out forwards',
          opacity: 0,
        }}
      />
    </>
  );
}

function Splash() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, position: 'relative', zIndex: 1 }}>
      <SpinnerIcon size={22} />
      <div style={{ color: '#94A3B8', fontSize: 13, fontFamily: 'Inter, sans-serif' }}>Loading session...</div>
    </div>
  );
}
