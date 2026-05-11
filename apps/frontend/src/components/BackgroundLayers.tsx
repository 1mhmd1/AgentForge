import React, { useMemo } from 'react';

const PARTICLE_COLORS = ['#7C3AED', '#3B82F6', '#06B6D4', '#A78BFA'];

export default function BackgroundLayers() {
  const particles = useMemo(() => {
    return Array.from({ length: 36 }, (_, i) => ({
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
            willChange: 'transform, opacity',
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
  orb: { position: 'absolute', borderRadius: '50%', pointerEvents: 'none', willChange: 'transform' },
  orb1: {
    width: 720, height: 720, background: '#7C3AED', opacity: 0.18,
    filter: 'blur(70px)', top: -200, left: -160,
    animation: 'float-orb-1 32s ease-in-out infinite alternate',
  },
  orb2: {
    width: 600, height: 600, background: '#3B82F6', opacity: 0.16,
    filter: 'blur(80px)', bottom: -180, right: -140,
    animation: 'float-orb-2 34s ease-in-out infinite alternate-reverse',
  },
};
