import React from 'react';

const STAGE_ORDER = ['planning', 'building', 'validating'];

interface SubAgent { id: number; task: string; done: boolean; }

interface WorkflowTheaterProps {
  stage: string;
  subAgents?: SubAgent[];
}

export default function WorkflowTheater({ stage, subAgents = [] }: WorkflowTheaterProps) {
  return (
    <div style={ts.root}>
      <div style={ts.skyGlow} />
      <div style={ts.fogBottom} />
      <div style={ts.header}>
        <div style={ts.headerLabel}>
          <span style={{ ...ts.liveDot, animation: 'pulse-status 1.2s ease-in-out infinite' }} />
          WORKFLOW THEATER · LIVE
        </div>
        <div style={ts.stageTag}>
          {stage === 'completed' ? 'ALL STAGES COMPLETE' : `STAGE: ${stage.toUpperCase()}`}
        </div>
      </div>

      <div style={ts.scene}>
        <div style={ts.world}>
          <Floor />
          <EnergyBeam active={stage === 'building' || STAGE_ORDER.indexOf(stage) > 1 || stage === 'completed'} from="planner" to="builder" color="#7C3AED" />
          <EnergyBeam active={stage === 'validating' || stage === 'completed'} from="builder" to="validator" color="#3B82F6" />
          <Humanoid tier="upper" x={-310} z={0} color="#7C3AED" glow="rgba(124,58,237,0.85)" label="PLANNER" role="thinking" state={agentState(stage, 'planning')} />
          <Humanoid tier="upper" x={0} z={0} color="#3B82F6" glow="rgba(59,130,246,0.85)" label="BUILDER" role="building" state={agentState(stage, 'building')} />
          <Humanoid tier="upper" x={310} z={0} color="#22C55E" glow="rgba(34,197,94,0.85)" label="VALIDATOR" role="inspecting" state={agentState(stage, 'validating')} />
        </div>
      </div>

      <InspectionBeam active={stage === 'validating'} subAgentCount={subAgents.length} />
      <SubAgentRow subAgents={subAgents} />
    </div>
  );
}

function InspectionBeam({ active, subAgentCount }: { active: boolean; subAgentCount: number }) {
  if (!active || !subAgentCount) return null;
  return (
    <svg
      style={{
        position: 'absolute',
        left: '50%',
        top: 250,
        width: 360,
        height: 170,
        marginLeft: -10,
        overflow: 'visible',
        pointerEvents: 'none',
        zIndex: 8,
      }}
      viewBox="0 0 360 170"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="inspectGrad" x1="100%" x2="0%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#22C55E" stopOpacity="1" />
          <stop offset="100%" stopColor="#86EFAC" stopOpacity="0.85" />
        </linearGradient>
      </defs>
      <path
        d="M 320 30 Q 200 90 10 160"
        fill="none"
        stroke="url(#inspectGrad)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.9"
        style={{ filter: 'drop-shadow(0 0 6px #22C55E) drop-shadow(0 0 14px rgba(34,197,94,0.6))', animation: 'beamPulse 1.6s ease-in-out infinite' }}
      />
      {[0, 1, 2].map((i) => (
        <circle key={i} r="3.5" fill="#86EFAC" style={{ filter: 'drop-shadow(0 0 8px #22C55E)' }}>
          <animateMotion dur="1.8s" repeatCount="indefinite" begin={`${i * 0.5}s`} path="M 320 30 Q 200 90 10 160" />
        </circle>
      ))}
    </svg>
  );
}

function SubAgentRow({ subAgents }: { subAgents: SubAgent[] }) {
  if (!subAgents.length) return null;
  const n = subAgents.length;
  const spacing = n > 8 ? 80 : 100;
  const rowWidth = Math.max((n - 1) * spacing, spacing);
  const fanHeight = 175;

  return (
    <>
      <svg
        style={{
          position: 'absolute', left: '50%', bottom: 50,
          width: rowWidth, height: fanHeight,
          marginLeft: -rowWidth / 2,
          overflow: 'visible', pointerEvents: 'none', zIndex: 9,
        }}
        viewBox={`${-rowWidth / 2} 0 ${rowWidth} ${fanHeight}`}
        preserveAspectRatio="none"
      >
        <defs>
          {subAgents.map((sub) => (
            <linearGradient key={sub.id} id={`fan-${sub.id}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.95" />
              <stop offset="100%" stopColor={sub.done ? '#22C55E' : '#06B6D4'} stopOpacity="0.95" />
            </linearGradient>
          ))}
        </defs>
        {subAgents.map((sub, i) => {
          const x = (i - (n - 1) / 2) * spacing;
          const color = sub.done ? '#22C55E' : '#06B6D4';
          const cx = x * 0.5;
          const cy = fanHeight * 0.55;
          return (
            <g key={sub.id}>
              <path
                d={`M 0 0 Q ${cx} ${cy} ${x} ${fanHeight}`}
                fill="none" stroke={`url(#fan-${sub.id})`}
                strokeWidth="1.5" strokeLinecap="round" opacity="0.85"
                style={{ filter: `drop-shadow(0 0 4px ${color})` }}
              />
              {!sub.done && (
                <circle r="3.5" fill="#67E8F9" style={{ filter: `drop-shadow(0 0 6px ${color})` }}>
                  <animateMotion dur="1.6s" repeatCount="indefinite"
                    path={`M 0 0 Q ${cx} ${cy} ${x} ${fanHeight}`}
                    begin={`${i * 0.15}s`} />
                </circle>
              )}
            </g>
          );
        })}
        <circle cx="0" cy="0" r="5" fill="#67E8F9" style={{ filter: 'drop-shadow(0 0 10px #3B82F6) drop-shadow(0 0 4px #06B6D4)' }}>
          <animate attributeName="r" values="5;7;5" dur="1.6s" repeatCount="indefinite" />
        </circle>
        <circle cx="0" cy="0" r="12" fill="none" stroke="#3B82F6" strokeWidth="1" opacity="0.4">
          <animate attributeName="r" values="5;18;5" dur="2.2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.6;0;0.6" dur="2.2s" repeatCount="indefinite" />
        </circle>
      </svg>

      <div style={{ position: 'absolute', left: '50%', bottom: 24, transform: 'translateX(-50%)', display: 'flex', alignItems: 'flex-end', zIndex: 10 }}>
        {subAgents.map((sub, i) => (
          <div key={sub.id} style={{ width: spacing, display: 'flex', justifyContent: 'center' }}>
            <FlatSubAgent sub={sub} index={i} />
          </div>
        ))}
      </div>
    </>
  );
}

function FlatSubAgent({ sub, index }: { sub: SubAgent; index: number }) {
  const color = '#06B6D4';
  const done = sub.done;
  return (
    <div style={{
      position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      animation: `subSpawn 500ms cubic-bezier(0.34, 1.56, 0.64, 1) ${index * 80}ms both, subFloat 2.6s ease-in-out ${index * 120}ms infinite`,
    }}>
      <div style={{ position: 'relative', width: 36, height: 56 }}>
        <div style={{ position: 'absolute', left: '50%', bottom: 0, marginLeft: -12, width: 24, height: 30, borderRadius: 5, background: `linear-gradient(160deg, ${color}, rgba(0,0,0,0.4))`, boxShadow: `0 0 12px ${color}, inset 0 1px 0 rgba(255,255,255,0.2)`, border: `1px solid ${color}` }} />
        <div style={{ position: 'absolute', left: '50%', bottom: 30, marginLeft: -10, width: 20, height: 22, borderRadius: 6, background: `linear-gradient(160deg, ${color}, rgba(0,0,0,0.4))`, boxShadow: `0 0 14px ${color}`, border: `1px solid ${color}` }}>
          <div style={{ position: 'absolute', left: 3, right: 3, top: 8, height: 3, borderRadius: 1, background: '#67E8F9', boxShadow: '0 0 6px #67E8F9' }} />
        </div>
        {!done ? (
          <div style={{ position: 'absolute', left: '50%', top: -16, marginLeft: -7, width: 14, height: 14, borderRadius: '50%', border: `2px solid ${color}`, borderTopColor: 'transparent', borderRightColor: 'transparent', animation: 'spin-conic 0.9s linear infinite' }} />
        ) : (
          <div style={{ position: 'absolute', left: '50%', top: -18, marginLeft: -8, width: 16, height: 16, borderRadius: '50%', background: 'rgba(34,197,94,0.25)', border: '1.5px solid #22C55E', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22C55E', fontSize: 10, fontWeight: 700 }}>✓</div>
        )}
      </div>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, fontWeight: 500, color: '#67E8F9', textShadow: `0 0 6px ${color}`, letterSpacing: '0.05em', whiteSpace: 'nowrap', textAlign: 'center' }}>{sub.task}</div>
    </div>
  );
}

function agentState(currentStage: string, agentStage: string) {
  if (currentStage === 'completed') return 'done';
  const cur = STAGE_ORDER.indexOf(currentStage);
  const own = STAGE_ORDER.indexOf(agentStage);
  if (cur === own) return 'active';
  if (cur > own) return 'done';
  return 'idle';
}

function Floor() {
  return (
    <div style={ts.floor}>
      <div style={ts.floorGrid} />
      <div style={ts.floorGlow} />
    </div>
  );
}

function EnergyBeam({ active, from, to, color }: { active: boolean; from: string; to: string; color: string }) {
  if (!active) return null;
  const positions: Record<string, number> = { planner: -310, builder: 0, validator: 310 };
  const fromX = positions[from];
  const toX = positions[to];
  const dir = toX > fromX ? 1 : -1;
  const x1 = fromX + dir * 40;
  const x2 = toX - dir * 40;
  const cx = (x1 + x2) / 2;
  const len = Math.abs(x2 - x1);
  return (
    <div style={{ position: 'absolute', left: '50%', top: '49%', transform: `translate(-50%, 0) translate3d(${cx}px, 0, 20px)`, width: len, height: 3, transformStyle: 'preserve-3d' }}>
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg, transparent, ${color} 50%, transparent)`, boxShadow: `0 0 16px ${color}, 0 0 32px ${color}`, opacity: 0.9, animation: 'beamPulse 1.6s ease-in-out infinite' }} />
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} style={{ position: 'absolute', top: '50%', left: 0, width: 6, height: 6, borderRadius: '50%', background: '#E2E8F0', boxShadow: `0 0 12px ${color}, 0 0 24px ${color}`, transform: 'translate(0, -50%)', animation: `beamParticle 1.4s linear ${i * 0.28}s infinite` }} />
      ))}
    </div>
  );
}

function Humanoid({ x, z, color, glow, label, role, state, tier = 'upper' }: { x: number; z: number; color: string; glow: string; label: string; role: string; state: string; tier?: string }) {
  const anchorBottom = tier === 'upper' ? '36%' : '14%';
  const active = state === 'active';
  const done = state === 'done';
  const idle = state === 'idle';
  const intensity = active ? 1 : done ? 0.6 : 0.25;
  const bodyColor = idle ? '#1A2740' : color;
  const emit = idle ? 'rgba(26,39,64,0.4)' : glow;

  return (
    <div style={{ position: 'absolute', left: '50%', bottom: anchorBottom, transformStyle: 'preserve-3d', transform: `translate(-50%, 0) translate3d(${x}px, 0, ${z}px)` }}>
      <div style={{ position: 'relative', width: 80, transformStyle: 'preserve-3d', animation: active ? 'humanoidBob 2.4s ease-in-out infinite' : 'none' }}>
        <div style={{ position: 'absolute', left: '50%', top: 0, width: 140, height: 30, marginLeft: -70, marginTop: 6, borderRadius: '50%', background: `radial-gradient(ellipse at center, ${emit}, transparent 70%)`, opacity: intensity * 1.5, transform: 'rotateX(75deg) translateZ(-1px)', filter: 'blur(4px)' }} />
        {active && (
          <div style={{ position: 'absolute', left: '50%', top: 0, width: 120, height: 120, marginLeft: -60, marginTop: -2, borderRadius: '50%', border: `2px solid ${color}`, transform: 'rotateX(75deg)', animation: 'humanoidRing 2s ease-out infinite' }} />
        )}
        <div style={{ position: 'relative', width: 80, height: 180, transformStyle: 'preserve-3d' }}>
          <BodyPart x={-12} y={0} w={14} h={56} color={bodyColor} emit={emit} intensity={intensity} radius={3} />
          <BodyPart x={12} y={0} w={14} h={56} color={bodyColor} emit={emit} intensity={intensity} radius={3} />
          <BodyPart x={0} y={56} w={50} h={64} color={bodyColor} emit={emit} intensity={intensity} radius={6} />
          <div style={{ position: 'absolute', left: '50%', bottom: 90, marginLeft: -16, width: 32, height: 3, borderRadius: 2, background: idle ? '#243B5E' : color, boxShadow: idle ? 'none' : `0 0 8px ${color}` }} />
          <Arm side="left" role={role} state={state} color={bodyColor} emit={emit} intensity={intensity} />
          <Arm side="right" role={role} state={state} color={bodyColor} emit={emit} intensity={intensity} />
          <div style={{ position: 'absolute', left: '50%', bottom: 124, marginLeft: -18, width: 36, height: 40, borderRadius: 12, background: `linear-gradient(160deg, ${bodyColor} 0%, rgba(0,0,0,0.4) 100%)`, boxShadow: idle ? 'inset 0 1px 0 rgba(255,255,255,0.05)' : `0 0 24px ${emit}, 0 0 48px ${emit}, inset 0 1px 0 rgba(255,255,255,0.2)`, border: `1px solid ${idle ? '#243B5E' : color}` }}>
            <div style={{ position: 'absolute', left: 6, right: 6, top: 14, height: 6, borderRadius: 2, background: idle ? '#0D1424' : '#67E8F9', boxShadow: idle ? 'none' : `0 0 8px #67E8F9, 0 0 16px ${color}`, animation: active ? 'visorScan 2.4s ease-in-out infinite' : 'none' }} />
          </div>
          {done && (
            <div style={{ position: 'absolute', left: '50%', bottom: 174, marginLeft: -14, width: 28, height: 28, borderRadius: '50%', background: 'rgba(34,197,94,0.2)', border: '2px solid #22C55E', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22C55E', fontSize: 14, fontWeight: 700, boxShadow: '0 0 16px rgba(34,197,94,0.6)', animation: 'fadeUp 400ms ease both' }}>✓</div>
          )}
          {active && role === 'thinking' && <ThinkBubbles color={color} />}
          {active && role === 'building' && <BuildSparks color={color} />}
          {active && role === 'inspecting' && <InspectGlass color={color} />}
        </div>
        <div style={{ position: 'absolute', left: '50%', top: 188, marginLeft: -50, width: 100, textAlign: 'center', fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: idle ? '#475569' : '#E2E8F0', textShadow: idle ? 'none' : `0 0 12px ${emit}` }}>{label}</div>
      </div>
    </div>
  );
}

function BodyPart({ x, y, w, h, color, emit, intensity, radius }: { x: number; y: number; w: number; h: number; color: string; emit: string; intensity: number; radius: number }) {
  return (
    <div style={{ position: 'absolute', left: '50%', bottom: y, marginLeft: -w / 2 + x, width: w, height: h, borderRadius: radius, background: `linear-gradient(160deg, ${color} 0%, rgba(0,0,0,0.5) 100%)`, boxShadow: `0 0 ${12 * intensity}px ${emit}, 0 0 ${24 * intensity}px ${emit}, inset 0 1px 0 rgba(255,255,255,0.15)`, border: `1px solid ${color}` }} />
  );
}

function Arm({ side, role, state, color, emit, intensity }: { side: string; role: string; state: string; color: string; emit: string; intensity: number }) {
  const left = side === 'left';
  const xBase = left ? -28 : 28;
  let rotZ = left ? 8 : -8;
  let animation = 'none';
  if (state === 'active') {
    if (role === 'thinking') rotZ = left ? 18 : -45;
    if (role === 'building') { rotZ = left ? -10 : -20; animation = `${left ? 'armSwingL' : 'armSwingR'} 1.2s ease-in-out infinite`; }
    if (role === 'inspecting') rotZ = left ? 10 : -55;
  }
  return (
    <div style={{ position: 'absolute', left: '50%', bottom: 92, marginLeft: xBase - 5, width: 10, height: 52, borderRadius: 4, background: `linear-gradient(160deg, ${color} 0%, rgba(0,0,0,0.5) 100%)`, boxShadow: `0 0 ${10 * intensity}px ${emit}`, border: `1px solid ${color}`, transformOrigin: 'top center', transform: `rotate(${rotZ}deg)`, animation, transition: 'transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1)' }} />
  );
}

function ThinkBubbles({ color }: { color: string }) {
  return (
    <div style={{ position: 'absolute', left: '100%', bottom: 140, marginLeft: 4, transformStyle: 'preserve-3d' }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ position: 'absolute', left: i * 6, bottom: i * 10, width: 6 + i * 4, height: 6 + i * 4, borderRadius: '50%', background: '#A78BFA', boxShadow: `0 0 10px ${color}, 0 0 20px ${color}`, opacity: 0, animation: `thinkBubble 2.4s ease-in-out ${i * 0.3}s infinite` }} />
      ))}
    </div>
  );
}

function BuildSparks({ color }: { color: string }) {
  return (
    <div style={{ position: 'absolute', left: '50%', bottom: 86, marginLeft: -8, transformStyle: 'preserve-3d' }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} style={{ position: 'absolute', width: 3, height: 3, borderRadius: '50%', background: '#FCD34D', boxShadow: '0 0 6px #FCD34D, 0 0 12px #F59E0B', animation: `spark 1.4s ease-out ${i * 0.18}s infinite` }} />
      ))}
      <div style={{ position: 'absolute', left: 16, top: -8, width: 14, height: 14, borderRadius: 3, background: color, boxShadow: `0 0 12px ${color}`, animation: 'buildHammer 0.9s ease-in-out infinite' }} />
    </div>
  );
}

function InspectGlass({ color }: { color: string }) {
  return (
    <div style={{ position: 'absolute', left: '100%', bottom: 96, marginLeft: -4, animation: 'inspectScan 3s ease-in-out infinite', transformStyle: 'preserve-3d' }}>
      <div style={{ width: 22, height: 22, borderRadius: '50%', border: `3px solid ${color}`, background: 'rgba(34,197,94,0.15)', boxShadow: `0 0 12px ${color}, inset 0 0 8px ${color}` }} />
      <div style={{ position: 'absolute', left: 18, top: 20, width: 3, height: 14, borderRadius: 2, background: color, transform: 'rotate(-30deg)', transformOrigin: 'top left' }} />
    </div>
  );
}

const ts: Record<string, React.CSSProperties> = {
  root: { position: 'relative', width: '100%', height: 620, borderRadius: 18, overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 60%, #0A1428 0%, #050A12 70%)', border: '1px solid rgba(124,58,237,0.25)', boxShadow: '0 0 0 1px rgba(124,58,237,0.15), 0 30px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)', marginBottom: 24 },
  skyGlow: { position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 0%, rgba(124,58,237,0.18), transparent 60%)', pointerEvents: 'none' },
  fogBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 60, background: 'linear-gradient(to top, rgba(5,10,18,0.7), transparent)', pointerEvents: 'none', zIndex: 5 },
  header: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, height: 44, padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(to bottom, rgba(5,10,18,0.85), rgba(5,10,18,0))' },
  headerLabel: { display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', color: '#A78BFA' },
  liveDot: { width: 8, height: 8, borderRadius: '50%', background: '#22C55E', boxShadow: '0 0 8px #22C55E' },
  stageTag: { fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 600, letterSpacing: '0.18em', color: '#67E8F9', padding: '4px 10px', borderRadius: 100, background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.3)' },
  scene: { position: 'absolute', inset: 0, perspective: '1100px', perspectiveOrigin: '50% 30%' },
  world: { position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transform: 'rotateX(26deg)' },
  floor: { position: 'absolute', left: '50%', bottom: '0%', width: 1800, height: 1100, marginLeft: -900, transformOrigin: 'center top', transform: 'rotateX(90deg) translateZ(-1px)', transformStyle: 'preserve-3d' },
  floorGrid: { position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(124,58,237,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.18) 1px, transparent 1px)', backgroundSize: '60px 60px', maskImage: 'radial-gradient(ellipse at 50% 30%, black 0%, transparent 65%)', WebkitMaskImage: 'radial-gradient(ellipse at 50% 30%, black 0%, transparent 65%)' },
  floorGlow: { position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 30%, rgba(59,130,246,0.15), transparent 60%)' },
};
