import React, { useState } from 'react';
import BackgroundLayers from './components/BackgroundLayers';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import RunExecution from './pages/RunExecution';
import Runs from './pages/Runs';
import Agents from './pages/Agents';
import Pricing from './pages/Pricing';
import Account from './pages/Account';
import Admin from './pages/Admin';
import Settings from './pages/Settings';

export default function App() {
  const [page, setPage] = useState('home');
  const [runId, setRunId] = useState<string | null>(null);
  const [warpKey, setWarpKey] = useState(0);

  const navigate = (p: string, id?: string) => {
    setWarpKey((k) => k + 1);
    setPage(p);
    if (id !== undefined) setRunId(id);
    if (p === 'run-exec' && id === undefined) setRunId('run_' + Math.random().toString(16).slice(2, 8));
  };

  const handleSubmit = () => {
    setWarpKey((k) => k + 1);
    setRunId('run_' + Math.random().toString(16).slice(2, 8));
    setPage('run-exec');
  };

  let content: React.ReactNode;
  switch (page) {
    case 'run-exec': content = <RunExecution runId={runId} onNavigate={navigate} />; break;
    case 'runs':     content = <Runs onNavigate={navigate} />; break;
    case 'agents':   content = <Agents />; break;
    case 'pricing':  content = <Pricing />; break;
    case 'account':  content = <Account />; break;
    case 'admin':    content = <Admin />; break;
    case 'settings': content = <Settings />; break;
    default:         content = <Home onNavigate={navigate} onSubmit={handleSubmit} />;
  }

  return (
    <>
      <BackgroundLayers />
      <Navbar current={page === 'run-exec' ? 'runs' : page === 'home' ? null : page} onNavigate={navigate} />
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
