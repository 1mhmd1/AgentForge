import React, { useMemo, useState } from 'react';
import { HexIcon } from './Icons';
import { useAuth } from '../auth/AuthContext';
import { isAdmin } from '../auth/roles';

interface NavbarProps {
  current: string | null;
  onNavigate: (page: string) => void;
}

export default function Navbar({ current, onNavigate }: NavbarProps) {
  const { user } = useAuth();
  const items = useMemo(() => {
    const base = [
      { id: 'runs', label: 'Runs' },
      { id: 'agents', label: 'Agents' },
      { id: 'pricing', label: 'Pricing' },
      { id: 'account', label: 'Account' },
    ];
    // Admin entry is only rendered for admin/super-admin users.
    // Normal users have no way to discover the route from the UI.
    if (isAdmin(user)) {
      base.splice(3, 0, { id: 'admin', label: 'Admin' });
    }
    return base;
  }, [user]);
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <nav style={s.root}>
      <button style={s.logoBtn} onClick={() => onNavigate('home')}>
        <span style={s.logoIcon}><HexIcon size={18} /></span>
        <span style={s.logoText}>AgentForge</span>
      </button>
      <div style={s.links}>
        {items.map((it) => {
          const active = current === it.id || (it.id === 'runs' && current === 'run-exec');
          const showUnderline = active || hovered === it.id;
          return (
            <button
              key={it.id}
              onClick={() => onNavigate(it.id)}
              onMouseEnter={() => setHovered(it.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                ...s.link,
                color: active ? '#A78BFA' : hovered === it.id ? '#E2E8F0' : '#94A3B8',
                textShadow: hovered === it.id ? '0 0 20px rgba(124,58,237,0.6)' : 'none',
              }}
            >
              {it.label}
              <span style={{ ...s.underline, width: showUnderline ? '100%' : '0%' }} />
            </button>
          );
        })}
      </div>
    </nav>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: {
    position: 'sticky', top: 0, zIndex: 100, height: 64,
    background: 'rgba(5, 10, 18, 0.75)',
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    borderBottom: '1px solid rgba(26, 39, 64, 0.8)',
    display: 'flex', alignItems: 'center', padding: '0 32px', gap: 24,
  },
  logoBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 10,
    background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
  },
  logoIcon: { display: 'inline-flex', filter: 'drop-shadow(0 0 12px rgba(124,58,237,0.5))' },
  logoText: {
    fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 800, fontSize: 20,
    letterSpacing: '-0.02em',
    background: 'linear-gradient(135deg, #7C3AED 0%, #3B82F6 50%, #06B6D4 100%)',
    WebkitBackgroundClip: 'text', backgroundClip: 'text',
    WebkitTextFillColor: 'transparent', color: 'transparent',
  },
  links: { marginLeft: 'auto', display: 'flex', gap: 32 },
  link: {
    position: 'relative', background: 'transparent', border: 'none', cursor: 'pointer',
    fontFamily: 'Inter, system-ui, sans-serif', fontSize: 13, fontWeight: 500,
    padding: '4px 0', transition: 'color 200ms ease, text-shadow 200ms ease',
  },
  underline: {
    position: 'absolute', left: 0, bottom: 0, height: 1,
    background: 'linear-gradient(90deg, #7C3AED, #06B6D4)',
    transition: 'width 250ms cubic-bezier(0.4, 0, 0.2, 1)',
  },
};
