import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { HexIcon, RunsIcon, AgentsIcon, PricingIcon, UserCircleIcon, ShieldIcon } from './Icons';
import { useAuth } from '../auth/AuthContext';
import { isAdmin } from '../auth/roles';
import { useViewport } from '../hooks/useViewport';

interface NavbarProps {
  current: string | null;
  onNavigate: (page: string) => void;
}

type NavItem = {
  id: string;
  label: string;
  Icon: React.FC<React.SVGProps<SVGSVGElement>>;
  iconOnly?: boolean;
};

export default function Navbar({ current, onNavigate }: NavbarProps) {
  const { user } = useAuth();
  const { isTablet } = useViewport();
  const [menuOpen, setMenuOpen] = useState(false);

  const items = useMemo<NavItem[]>(() => {
    const base: NavItem[] = [
      { id: 'runs',    label: 'Runs',    Icon: RunsIcon },
      { id: 'agents',  label: 'Agents',  Icon: AgentsIcon },
      { id: 'pricing', label: 'Pricing', Icon: PricingIcon },
      { id: 'account', label: 'Account', Icon: UserCircleIcon, iconOnly: true },
    ];
    if (isAdmin(user)) {
      base.splice(3, 0, { id: 'admin', label: 'Admin', Icon: ShieldIcon });
    }
    return base;
  }, [user]);

  const [hovered, setHovered] = useState<string | null>(null);

  // Close the mobile sheet when we cross back to desktop.
  useEffect(() => {
    if (!isTablet && menuOpen) setMenuOpen(false);
  }, [isTablet, menuOpen]);

  // Close on Esc.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const navigate = (id: string) => {
    setMenuOpen(false);
    onNavigate(id);
  };

  return (
    <nav style={{ ...s.root, padding: isTablet ? '0 16px' : '0 32px', gap: isTablet ? 12 : 24 }}>
      <button type="button" style={s.logoBtn} onClick={() => navigate('home')} aria-label="Go to home">
        <span style={s.logoIcon}><HexIcon size={18} /></span>
        <span style={s.logoText}>AgentForge</span>
      </button>

      {isTablet ? (
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          {...{ 'aria-expanded': menuOpen ? 'true' : 'false' }}
          style={{ ...s.hamburger, marginLeft: 'auto' }}
        >
          <HamburgerIcon open={menuOpen} />
        </button>
      ) : (
        <div style={s.links}>
          {items.map((it) => {
            const active = current === it.id || (it.id === 'runs' && current === 'run-exec');
            const showUnderline = active || hovered === it.id;
            const col = active ? '#A78BFA' : hovered === it.id ? '#E2E8F0' : '#94A3B8';
            return (
              <button
                key={it.id}
                onClick={() => navigate(it.id)}
                onMouseEnter={() => setHovered(it.id)}
                onMouseLeave={() => setHovered(null)}
                aria-label={it.iconOnly ? it.label : undefined}
                style={{
                  ...s.link,
                  color: col,
                  textShadow: hovered === it.id ? '0 0 20px rgba(124,58,237,0.6)' : 'none',
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  ...(it.iconOnly ? { padding: '4px 2px' } : {}),
                }}
              >
                <it.Icon
                  width={it.iconOnly ? 18 : 14}
                  height={it.iconOnly ? 18 : 14}
                  style={{ flexShrink: 0, color: col }}
                />
                {!it.iconOnly && <span>{it.label}</span>}
                {!it.iconOnly && <span style={{ ...s.underline, width: showUnderline ? '100%' : '0%' }} />}
              </button>
            );
          })}
        </div>
      )}

      {isTablet && menuOpen && ReactDOM.createPortal(
        <>
          <div
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
            style={s.scrim}
          />
          <div role="dialog" aria-modal="true" aria-label="Navigation menu" style={s.sheet}>
            {items.map((it) => {
              const active = current === it.id || (it.id === 'runs' && current === 'run-exec');
              const col = active ? '#A78BFA' : '#E2E8F0';
              return (
                <button
                  type="button"
                  key={it.id}
                  onClick={() => navigate(it.id)}
                  style={{
                    ...s.sheetItem,
                    color: col,
                    background: active ? 'rgba(124,58,237,0.12)' : 'transparent',
                    borderLeft: active ? '2px solid #7C3AED' : '2px solid transparent',
                  }}
                >
                  <it.Icon width={16} height={16} style={{ flexShrink: 0, color: col, marginRight: 2 }} />
                  {it.label}
                </button>
              );
            })}
          </div>
        </>,
        document.body
      )}
    </nav>
  );
}

function HamburgerIcon({ open }: { open: boolean }) {
  const common: React.CSSProperties = { position: 'absolute', left: 0, height: 2, width: 20, background: '#E2E8F0', borderRadius: 2, transition: 'transform 200ms ease, opacity 200ms ease' };
  return (
    <span aria-hidden="true" style={{ position: 'relative', width: 20, height: 14, display: 'inline-block' }}>
      <span style={{ ...common, top: open ? 6 : 0,  transform: open ? 'rotate(45deg)' : 'none' }} />
      <span style={{ ...common, top: 6,             opacity: open ? 0 : 1 }} />
      <span style={{ ...common, top: open ? 6 : 12, transform: open ? 'rotate(-45deg)' : 'none' }} />
    </span>
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
  hamburger: {
    width: 40, height: 40, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: 'transparent', border: '1px solid rgba(26,39,64,0.8)', borderRadius: 8, cursor: 'pointer',
  },
  // Scrim: heavier dark wash so the hero behind reads as "dismissed" and
  // there's a clear visual separation from the panel. Use rgba (no
  // backdrop-filter -- the latter ships with rendering bugs in mobile Chrome
  // that made the previous build look transparent).
  scrim: {
    position: 'fixed', inset: 0, top: 64, background: 'rgba(2,5,10,0.82)',
    zIndex: 99, animation: 'fadeIn 200ms ease both',
  },
  // Sheet: SOLID background, no alpha + no backdrop-filter. The earlier
  // `rgba(9,14,26,0.96) + blur(20px)` combo was the source of the
  // "transparent menu floating on the 3D scene" bug -- on mobile Chrome the
  // backdrop-filter creates a new stacking context that prevents the rgba
  // from ever painting opaquely. Solid color sidesteps the issue entirely.
  sheet: {
    position: 'fixed', top: 64, right: 0, bottom: 0, width: 'min(280px, 78vw)',
    background: '#0A0F1C',
    borderLeft: '1px solid rgba(124,58,237,0.4)',
    boxShadow: '-20px 0 50px rgba(0,0,0,0.7)',
    zIndex: 101, padding: '14px 0', display: 'flex', flexDirection: 'column',
    animation: 'fadeSlide 220ms cubic-bezier(0.16, 1, 0.3, 1) both',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  sheetItem: {
    display: 'flex', alignItems: 'center', padding: '14px 22px', fontSize: 15, fontWeight: 500,
    background: 'transparent', border: 'none', borderLeft: '2px solid transparent', cursor: 'pointer',
    color: '#E2E8F0', textAlign: 'left',
    transition: 'background 150ms ease, border-color 150ms ease',
  },
};
