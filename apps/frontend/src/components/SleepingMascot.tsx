import React, { useEffect, useRef, useState } from "react";
import { useViewport } from "../hooks/useViewport";

type State = "sleeping" | "waking" | "awake";

interface Props {
  onGoToChat?: () => void;
  userName?: string;
}

export default function SleepingMascot({ onGoToChat, userName }: Props) {
  const [state, setState] = useState<State>("sleeping");
  const [hover, setHover] = useState(false);
  const sleepTimerRef = useRef<number | null>(null);
  const { isMobile, isTablet } = useViewport();

  const scale = isMobile ? 0.72 : isTablet ? 0.85 : 1;
  const offset = isMobile ? 12 : isTablet ? 18 : 24;

  // Wake-up cinematic timeline
  useEffect(() => {
    if (state !== "waking") return;
    const t = setTimeout(() => setState("awake"), 1400);
    return () => clearTimeout(t);
  }, [state]);

  useEffect(() => {
    if (hover || state !== "awake") {
      if (sleepTimerRef.current) {
        window.clearTimeout(sleepTimerRef.current);
        sleepTimerRef.current = null;
      }
      return;
    }
    sleepTimerRef.current = window.setTimeout(() => {
      setState("sleeping");
    }, 5000);
    return () => {
      if (sleepTimerRef.current) {
        window.clearTimeout(sleepTimerRef.current);
        sleepTimerRef.current = null;
      }
    };
  }, [hover, state]);

  const onClick = () => {
    if (sleepTimerRef.current) {
      window.clearTimeout(sleepTimerRef.current);
      sleepTimerRef.current = null;
    }
    if (state === "sleeping") {
      setState("waking");
      // Direct user to the chat — handled by parent so it works cross-page.
      onGoToChat?.();
    } else if (state === "awake") {
      // Re-trigger navigation when already awake — quality-of-life
      onGoToChat?.();
    }
  };

  const eyesGlow = state === "sleeping" ? 0 : state === "waking" ? 0.6 : 1;
  const headTilt = state === "sleeping" ? 14 : state === "waking" ? 6 : 0;

  return (
    <div
      data-cursor="hover"
      role="button"
      aria-label={
        state === "sleeping" ? "Wake AI assistant" : "Put assistant to sleep"
      }
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "fixed",
        bottom: offset,
        left: offset,
        width: 132,
        height: 156,
        zIndex: 80,
        cursor: "pointer",
        userSelect: "none",
        animation:
          state === "sleeping"
            ? "mascot-breathe 4s ease-in-out infinite"
            : undefined,
        transition:
          "filter 280ms ease, transform 280ms cubic-bezier(0.34,1.56,0.64,1)",
        filter: hover
          ? "drop-shadow(0 0 26px rgba(124,58,237,0.6)) drop-shadow(0 12px 28px rgba(0,0,0,0.55))"
          : "drop-shadow(0 0 18px rgba(124,58,237,0.35)) drop-shadow(0 10px 22px rgba(0,0,0,0.5))",
        transform: hover
          ? `translateY(-3px) scale(${scale})`
          : `scale(${scale})`,
        transformOrigin: "bottom left",
      }}
    >
      {/* Zzz particles when sleeping */}
      {state === "sleeping" && (
        <>
          <span style={zzz(0)}>Z</span>
          <span style={zzz(1.4)}>Z</span>
          <span style={zzz(2.8)}>z</span>
        </>
      )}

      {/* Wake flash */}
      {state === "waking" && (
        <span
          style={{
            position: "absolute",
            left: 66,
            top: 76,
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: "#A78BFA",
            transformOrigin: "center",
            animation: "mascot-wakeflash 900ms ease-out forwards",
            boxShadow: "0 0 24px rgba(167,139,250,0.9)",
          }}
        />
      )}

      <svg
        width="100%"
        height="100%"
        viewBox="0 0 132 156"
        style={{ overflow: "visible", display: "block" }}
      >
        <defs>
          <linearGradient id="mascotBody" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#1a2740" />
            <stop offset="1" stopColor="#0a1020" />
          </linearGradient>
          <linearGradient id="mascotHead" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#1f2c4a" />
            <stop offset="1" stopColor="#0d1424" />
          </linearGradient>
          <radialGradient id="mascotEye" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#A78BFA" />
            <stop offset="0.6" stopColor="#7C3AED" />
            <stop offset="1" stopColor="rgba(124,58,237,0)" />
          </radialGradient>
        </defs>

        {/* Charging dock pad */}
        <ellipse
          cx="66"
          cy="142"
          rx="48"
          ry="6"
          fill="rgba(124,58,237,0.22)"
          style={{
            animation: "mascot-dock 2.4s ease-in-out infinite",
            transformOrigin: "66px 142px",
          }}
        />
        <ellipse
          cx="66"
          cy="142"
          rx="34"
          ry="3"
          fill="rgba(167,139,250,0.55)"
        />

        {/* Body — squat, sitting/leaning forward when sleeping */}
        <g
          style={{
            transform: `translateY(${state === "sleeping" ? 4 : 0}px)`,
            transition: "transform 600ms cubic-bezier(0.34,1.56,0.64,1)",
          }}
        >
          <rect
            x="32"
            y="84"
            width="68"
            height="56"
            rx="14"
            fill="url(#mascotBody)"
            stroke="#2a3a5c"
            strokeWidth="1"
          />
          {/* Side vents */}
          <rect
            x="36"
            y="100"
            width="4"
            height="22"
            rx="2"
            fill="#06B6D4"
            opacity="0.4"
          />
          <rect
            x="92"
            y="100"
            width="4"
            height="22"
            rx="2"
            fill="#06B6D4"
            opacity="0.4"
          />
          {/* Chest core */}
          <circle
            cx="66"
            cy="112"
            r="8"
            fill="#7C3AED"
            opacity={0.55 + eyesGlow * 0.4}
            style={{
              animation: "mascot-coreglow 2s ease-in-out infinite",
              color: "#7C3AED",
            }}
          />
          <circle cx="66" cy="112" r="3.5" fill="#A78BFA" />
          {/* Status LEDs */}
          <circle
            cx="50"
            cy="92"
            r="1.6"
            fill="#22C55E"
            opacity={0.7 + eyesGlow * 0.3}
          />
          <circle cx="58" cy="92" r="1.6" fill="#F59E0B" opacity="0.6" />
          <circle
            cx="66"
            cy="92"
            r="1.6"
            fill="#06B6D4"
            opacity={0.5 + eyesGlow * 0.5}
          />

          {/* Arms — relaxed at sides while sleeping, slightly raised when awake */}
          <g
            style={{
              transform:
                state === "awake" ? "translateY(-4px) rotate(-6deg)" : "none",
              transformOrigin: "32px 96px",
              transition: "transform 700ms cubic-bezier(0.34,1.56,0.64,1)",
            }}
          >
            <rect
              x="22"
              y="92"
              width="14"
              height="34"
              rx="6"
              fill="url(#mascotBody)"
              stroke="#2a3a5c"
              strokeWidth="1"
            />
            <circle
              cx="29"
              cy="92"
              r="6"
              fill="#1a2740"
              stroke="#2a3a5c"
              strokeWidth="1"
            />
          </g>
          <g
            style={{
              transform:
                state === "awake" ? "translateY(-4px) rotate(6deg)" : "none",
              transformOrigin: "100px 96px",
              transition: "transform 700ms cubic-bezier(0.34,1.56,0.64,1)",
            }}
          >
            <rect
              x="96"
              y="92"
              width="14"
              height="34"
              rx="6"
              fill="url(#mascotBody)"
              stroke="#2a3a5c"
              strokeWidth="1"
            />
            <circle
              cx="103"
              cy="92"
              r="6"
              fill="#1a2740"
              stroke="#2a3a5c"
              strokeWidth="1"
            />
          </g>
        </g>

        {/* Head — tilted forward when sleeping */}
        <g
          style={{
            transform: `rotate(${headTilt}deg)`,
            transformOrigin: "66px 80px",
            transition: "transform 700ms cubic-bezier(0.34,1.56,0.64,1)",
          }}
        >
          {/* Antenna */}
          <line
            x1="66"
            y1="32"
            x2="66"
            y2="22"
            stroke="#2a3a5c"
            strokeWidth="2"
          />
          <circle
            cx="66"
            cy="20"
            r="3"
            fill="#06B6D4"
            opacity={0.5 + eyesGlow * 0.5}
            style={{ filter: `drop-shadow(0 0 ${4 + eyesGlow * 6}px #06B6D4)` }}
          />

          {/* Head shell */}
          <rect
            x="40"
            y="32"
            width="52"
            height="46"
            rx="14"
            fill="url(#mascotHead)"
            stroke="#2a3a5c"
            strokeWidth="1"
          />
          {/* Visor recess */}
          <rect x="44" y="44" width="44" height="20" rx="8" fill="#02060c" />

          {/* Eyes — closed lines when sleeping, open glowing dots otherwise */}
          {state === "sleeping" ? (
            <>
              <path
                d="M 50 56 Q 56 50 62 56"
                stroke="#06B6D4"
                strokeWidth="1.6"
                fill="none"
                opacity="0.75"
              />
              <path
                d="M 70 56 Q 76 50 82 56"
                stroke="#06B6D4"
                strokeWidth="1.6"
                fill="none"
                opacity="0.75"
              />
            </>
          ) : (
            <>
              <circle
                cx="56"
                cy="54"
                r={3 + eyesGlow * 1.2}
                fill="url(#mascotEye)"
              />
              <circle
                cx="76"
                cy="54"
                r={3 + eyesGlow * 1.2}
                fill="url(#mascotEye)"
              />
              <circle cx="56" cy="54" r="1.5" fill="#fff" opacity={eyesGlow} />
              <circle cx="76" cy="54" r="1.5" fill="#fff" opacity={eyesGlow} />
            </>
          )}

          {/* Cheek vents */}
          <rect
            x="40"
            y="64"
            width="8"
            height="3"
            rx="1.5"
            fill="#06B6D4"
            opacity={0.35 + eyesGlow * 0.3}
          />
          <rect
            x="84"
            y="64"
            width="8"
            height="3"
            rx="1.5"
            fill="#06B6D4"
            opacity={0.35 + eyesGlow * 0.3}
          />

          {/* Ears / side caps */}
          <rect
            x="34"
            y="44"
            width="8"
            height="20"
            rx="3"
            fill="#0d1424"
            stroke="#2a3a5c"
            strokeWidth="1"
          />
          <rect
            x="90"
            y="44"
            width="8"
            height="20"
            rx="3"
            fill="#0d1424"
            stroke="#2a3a5c"
            strokeWidth="1"
          />
          <circle
            cx="38"
            cy="54"
            r="1.6"
            fill="#7C3AED"
            opacity={0.7 + eyesGlow * 0.3}
          />
          <circle
            cx="94"
            cy="54"
            r="1.6"
            fill="#7C3AED"
            opacity={0.7 + eyesGlow * 0.3}
          />
        </g>
      </svg>

      {/* Awake-state speech bubble */}
      {state === "awake" && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: -4,
            top: -76,
            background: "rgba(8, 12, 24, 0.95)",
            border: "1px solid rgba(124,58,237,0.45)",
            borderRadius: 10,
            padding: "8px 14px",
            minWidth: 148,
            boxShadow:
              "0 4px 24px rgba(0,0,0,0.55), 0 0 16px rgba(124,58,237,0.12)",
            animation: "mascot-arrow-pulse 1.4s ease-in-out infinite",
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "#A78BFA",
              fontWeight: 700,
              marginBottom: 3,
            }}
          >
            Hi, {userName || "there"}!
          </div>
          <div
            style={{
              fontSize: 10,
              color: "#06B6D4",
              letterSpacing: "0.06em",
              display: "flex",
              alignItems: "center",
              gap: 4,
              textShadow: "0 0 8px rgba(6,182,212,0.6)",
            }}
          >
            <span>Let's start</span>
            <span style={{ fontSize: 13 }}>↗</span>
          </div>
          {/* tail */}
          <div
            style={{
              position: "absolute",
              bottom: -7,
              left: 28,
              width: 12,
              height: 12,
              background: "rgba(8, 12, 24, 0.95)",
              borderRight: "1px solid rgba(124,58,237,0.45)",
              borderBottom: "1px solid rgba(124,58,237,0.45)",
              transform: "rotate(45deg)",
            }}
          />
        </div>
      )}
    </div>
  );
}

const zzz = (delaySec: number): React.CSSProperties => ({
  position: "absolute",
  left: 92,
  top: 36,
  fontFamily: "JetBrains Mono, monospace",
  fontWeight: 700,
  fontSize: 14,
  color: "#A78BFA",
  textShadow: "0 0 8px rgba(167,139,250,0.7)",
  opacity: 0,
  animation: `mascot-zzz 3.6s ease-out ${delaySec}s infinite`,
  pointerEvents: "none",
});
