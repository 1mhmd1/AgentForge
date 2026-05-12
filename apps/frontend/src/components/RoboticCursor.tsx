import React, { useEffect, useRef, useState } from 'react';

/**
 * Robotic finger cursor. Tip of the finger is at SVG (0,0).
 * - Hides native cursor on pointer-capable devices.
 * - Magnetic-feeling micro-lerp for sub-pixel smoothness.
 * - Pulses + recolors over interactive elements; presses inward on click.
 */
export default function RoboticCursor() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const target = useRef({ x: -100, y: -100 });
  const current = useRef({ x: -100, y: -100 });
  const raf = useRef<number | null>(null);
  const [hover, setHover] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (matchMedia('(hover: none), (pointer: coarse)').matches) return;
    setEnabled(true);
    document.documentElement.classList.add('rcursor-on');

    const move = (e: MouseEvent) => {
      target.current.x = e.clientX;
      target.current.y = e.clientY;
      const t = e.target as HTMLElement | null;
      const interactive = !!t && !!t.closest('button, a, [role="button"], input, textarea, select, label, [data-cursor="hover"]');
      setHover(interactive);
    };
    const down = () => setPressed(true);
    const up = () => setPressed(false);
    const leave = () => { target.current.x = -100; target.current.y = -100; };

    window.addEventListener('mousemove', move, { passive: true });
    window.addEventListener('mousedown', down);
    window.addEventListener('mouseup', up);
    window.addEventListener('mouseleave', leave);

    const tick = () => {
      current.current.x += (target.current.x - current.current.x) * 0.32;
      current.current.y += (target.current.y - current.current.y) * 0.32;
      if (wrapRef.current) {
        wrapRef.current.style.transform = `translate3d(${current.current.x}px, ${current.current.y}px, 0)`;
      }
      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${current.current.x}px, ${current.current.y}px, 0) translate(-50%, -50%)`;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);

    return () => {
      document.documentElement.classList.remove('rcursor-on');
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mousedown', down);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('mouseleave', leave);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  if (!enabled) return null;

  const tipColor = hover ? '#A78BFA' : '#06B6D4';
  const armColor = hover ? '#7C3AED' : '#1A2740';

  return (
    <>
      {/* Magnetic glow ring (centered on cursor) */}
      <div
        ref={ringRef}
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: hover ? 56 : 28,
          height: hover ? 56 : 28,
          borderRadius: '50%',
          border: `1px solid ${hover ? 'rgba(167,139,250,0.7)' : 'rgba(6,182,212,0.5)'}`,
          boxShadow: hover ? '0 0 30px rgba(167,139,250,0.55), inset 0 0 12px rgba(167,139,250,0.3)' : '0 0 18px rgba(6,182,212,0.35)',
          transition: 'width 220ms cubic-bezier(0.34,1.56,0.64,1), height 220ms cubic-bezier(0.34,1.56,0.64,1), border-color 200ms ease, box-shadow 200ms ease',
          pointerEvents: 'none',
          zIndex: 99998,
          mixBlendMode: 'screen',
          willChange: 'transform, width, height',
        }}
      />
      {/* Robotic finger SVG (tip is at SVG (0,0)) */}
      <div
        ref={wrapRef}
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: 0,
          height: 0,
          pointerEvents: 'none',
          zIndex: 99999,
          willChange: 'transform',
        }}
      >
        <svg
          width="46"
          height="46"
          viewBox="-4 -4 46 46"
          style={{
            overflow: 'visible',
            transform: `scale(${pressed ? 0.85 : 1})`,
            transition: 'transform 120ms cubic-bezier(0.34,1.56,0.64,1)',
            filter: hover
              ? 'drop-shadow(0 0 6px rgba(167,139,250,0.95)) drop-shadow(0 0 14px rgba(124,58,237,0.7))'
              : 'drop-shadow(0 0 5px rgba(6,182,212,0.85)) drop-shadow(0 0 12px rgba(6,182,212,0.4))',
          }}
        >
          {/* outer fingertip glow */}
          <circle cx="0" cy="0" r="7" fill={tipColor} opacity="0.18" />
          {/* fingertip core */}
          <circle cx="0" cy="0" r="2.6" fill={tipColor} />
          {/* tip nail plate */}
          <path
            d="M 0 0 L 7 4 L 9 7 L 5 11 L 0 6 Z"
            fill="#0d1424"
            stroke={tipColor}
            strokeWidth="0.9"
            strokeLinejoin="round"
          />
          {/* knuckle 1 */}
          <circle cx="9" cy="9" r="2.4" fill="#101a2c" stroke={tipColor} strokeWidth="0.8" />
          <circle cx="9" cy="9" r="0.8" fill={tipColor} />
          {/* mid finger plate */}
          <path
            d="M 9 9 L 17 14 L 21 18 L 14 22 L 7 14 Z"
            fill="#0d1424"
            stroke={armColor}
            strokeWidth="0.9"
            strokeLinejoin="round"
          />
          {/* knuckle 2 */}
          <circle cx="18" cy="18" r="2.6" fill="#101a2c" stroke={tipColor} strokeWidth="0.8" />
          <circle cx="18" cy="18" r="0.9" fill={tipColor} />
          {/* wrist plate (palm) */}
          <path
            d="M 17 17 L 30 24 L 32 32 L 24 36 L 14 24 Z"
            fill="#0a1020"
            stroke={armColor}
            strokeWidth="0.9"
            strokeLinejoin="round"
          />
          {/* circuit accents on palm */}
          <line x1="20" y1="22" x2="28" y2="26" stroke={tipColor} strokeWidth="0.6" opacity="0.8" />
          <line x1="22" y1="28" x2="26" y2="30" stroke={tipColor} strokeWidth="0.6" opacity="0.6" />
          {/* press-burst pulse (only when pressed) */}
          {pressed && (
            <circle cx="0" cy="0" r="0" fill="none" stroke={tipColor} strokeWidth="1.2" opacity="0.85">
              <animate attributeName="r" from="2" to="18" dur="280ms" fill="freeze" />
              <animate attributeName="opacity" from="0.85" to="0" dur="280ms" fill="freeze" />
            </circle>
          )}
        </svg>
      </div>
    </>
  );
}
