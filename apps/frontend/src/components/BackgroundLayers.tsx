import React, { useMemo } from 'react';

const PARTICLE_COLORS = ['#7C3AED', '#3B82F6', '#06B6D4', '#A78BFA'];

export default function BackgroundLayers() {
  const particles = useMemo(() => {
    return Array.from({ length: 120 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() < 0.5 ? 1 : 2,
      color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
      opacity: 0.35 + Math.random() * 0.5,
      duration: 4 + Math.random() * 6,
      delay: Math.random() * 5,
    }));
  }, []);

  return (
    <div style={s.root} aria-hidden="true">
      <div style={s.grid} />
      <div style={{ ...s.orb, ...s.orb1 }} />
      <div style={{ ...s.orb, ...s.orb2 }} />
      <div style={{ ...s.orb, ...s.orb3 }} />
      <div style={{ ...s.orb, ...s.orb4 }} />
      {particles.map((p) => (
        <span
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            background: p.color,
            opacity: p.opacity,
            boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
            animation: `particleFloat${p.id % 3} ${p.duration}s ease-in-out ${p.delay}s infinite alternate`,
            pointerEvents: 'none',
          }}
        />
      ))}
      <div style={s.scanlines} />
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: { position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 },
  grid: {
    position: 'absolute', inset: 0,
    backgroundImage: 'linear-gradient(rgba(59,130,246,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.05) 1px, transparent 1px)',
    backgroundSize: '40px 40px',
    WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 85%)',
    maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 85%)',
  },
  scanlines: {
    position: 'absolute', inset: 0,
    backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.02) 0 1px, transparent 1px 4px)',
    pointerEvents: 'none',
    mixBlendMode: 'overlay',
  },
  orb: { position: 'absolute', borderRadius: '50%', pointerEvents: 'none' },
  orb1: {
    width: 900, height: 900, background: '#7C3AED', opacity: 0.16,
    filter: 'blur(110px)', top: -220, left: -180,
    animation: 'float-orb-1 28s ease-in-out infinite alternate',
  },
  orb2: {
    width: 750, height: 750, background: '#3B82F6', opacity: 0.14,
    filter: 'blur(130px)', bottom: -220, right: -160,
    animation: 'float-orb-2 30s ease-in-out infinite alternate-reverse',
  },
  orb3: {
    width: 450, height: 450, background: '#06B6D4', opacity: 0.12,
    filter: 'blur(80px)', top: '38%', right: '12%',
    animation: 'float-orb-3 25s ease-in-out infinite alternate',
  },
  orb4: {
    width: 500, height: 500, background: '#A78BFA', opacity: 0.10,
    filter: 'blur(100px)', top: '32%', left: '8%',
    animation: 'float-orb-2 27s ease-in-out infinite alternate',
  },
};
