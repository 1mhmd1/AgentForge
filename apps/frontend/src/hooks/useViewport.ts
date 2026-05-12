import { useEffect, useState } from 'react';

export interface Viewport {
  width: number;
  height: number;
  /** width < 640 — narrow phones */
  isMobile: boolean;
  /** width < 1024 — phones + small tablets / landscape phones */
  isTablet: boolean;
}

const MOBILE_BREAKPOINT = 640;
const TABLET_BREAKPOINT = 1024;

function snapshot(): Viewport {
  if (typeof window === 'undefined') {
    return { width: 1280, height: 720, isMobile: false, isTablet: false };
  }
  const w = window.innerWidth;
  const h = window.innerHeight;
  return {
    width: w,
    height: h,
    isMobile: w < MOBILE_BREAKPOINT,
    isTablet: w < TABLET_BREAKPOINT,
  };
}

/**
 * Subscribes to `window.resize` (rAF-throttled) and re-renders the component
 * when the viewport crosses a breakpoint. Used by inline-styled components
 * that can't rely on CSS media queries.
 *
 * Cost: one resize listener per mounted consumer. The shared `snapshot()` is
 * cheap (single property read); no layout thrash.
 */
export function useViewport(): Viewport {
  const [v, setV] = useState<Viewport>(snapshot);

  useEffect(() => {
    let rafId: number | null = null;
    const onResize = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        setV(snapshot());
      });
    };
    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('orientationchange', onResize, { passive: true });
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  return v;
}
