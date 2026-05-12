import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Sparkles, Html, Line, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';

const PURPLE = '#7C3AED';
const BLUE   = '#3B82F6';
const CYAN   = '#06B6D4';
const VIOLET = '#A78BFA';
const NEON   = '#67E8F9';
const AMBER  = '#F59E0B';

/* ───────────────────────── Floor (cheap, no reflector) ───────────────────────── */
function Floor() {
  return (
    <group position={[0, -1.6, 0]}>
      {/* Solid backdrop plane — slightly lighter so the floor reads as a surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#0d1628" metalness={0.5} roughness={0.7} />
      </mesh>
      {/* Hex / grid overlay (single shader pass, very cheap) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <planeGeometry args={[80, 80, 1, 1]} />
        <shaderMaterial
          transparent
          depthWrite={false}
          uniforms={{
            uColor: { value: new THREE.Color(BLUE) },
          }}
          vertexShader={`
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            varying vec2 vUv;
            uniform vec3 uColor;
            void main() {
              vec2 g = abs(fract(vUv * 36.0) - 0.5);
              float line = smoothstep(0.45, 0.5, max(g.x, g.y));
              float fade = smoothstep(0.5, 0.0, distance(vUv, vec2(0.5)));
              gl_FragColor = vec4(uColor, line * 0.32 * fade);
            }
          `}
        />
      </mesh>
    </group>
  );
}

/* ───────────────────────── Worker Robot ───────────────────────── */
function WorkerRobot({ position, color = CYAN, accent = PURPLE, seed = 0 }: { position: [number, number, number]; color?: string; accent?: string; seed?: number }) {
  const head = useRef<THREE.Group>(null!);
  const armL = useRef<THREE.Group>(null!);
  const armR = useRef<THREE.Group>(null!);
  const visor = useRef<THREE.MeshBasicMaterial>(null!);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed;
    if (head.current) {
      // Looks down at laptop, with subtle side-to-side
      head.current.rotation.y = Math.sin(t * 0.7) * 0.14;
      head.current.rotation.x = 0.18 + Math.sin(t * 1.1) * 0.02;
      head.current.position.y = 0.9 + Math.sin(t * 1.4) * 0.02;
    }
    // Typing-on-keys micro-motion
    if (armL.current) armL.current.rotation.x = -0.55 + Math.sin(t * 7) * 0.12;
    if (armR.current) armR.current.rotation.x = -0.55 + Math.sin(t * 7 + 0.4) * 0.14;
    if (visor.current) {
      const f = 0.7 + Math.abs(Math.sin(t * 2)) * 0.6;
      visor.current.color.setStyle(color);
      visor.current.color.multiplyScalar(f);
    }
  });

  return (
    <group position={position}>
      {/* Stool / chair — short cylinder seat with center post */}
      <mesh position={[0, -0.62, 0]}>
        <cylinderGeometry args={[0.34, 0.34, 0.06, 20]} />
        <meshStandardMaterial color="#3e527c" metalness={0.7} roughness={0.4} emissive="#1a2640" emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[0, -0.85, 0]}>
        <cylinderGeometry args={[0.06, 0.08, 0.42, 10]} />
        <meshStandardMaterial color="#2e3e60" metalness={0.85} roughness={0.3} />
      </mesh>
      <mesh position={[0, -1.08, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 0.04, 14]} />
        <meshStandardMaterial color="#2e3e60" metalness={0.85} roughness={0.3} />
      </mesh>
      <mesh position={[0, -0.59, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.36, 0.4, 24]} />
        <meshBasicMaterial color={accent} transparent opacity={0.7} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>

      {/* Torso — rounded, with emissive self-glow */}
      <RoundedBox args={[0.6, 0.9, 0.42]} radius={0.06} smoothness={2} position={[0, 0.1, 0]} castShadow>
        <meshStandardMaterial color="#6e85b8" metalness={0.5} roughness={0.4} emissive="#3a4d7c" emissiveIntensity={0.55} />
      </RoundedBox>
      {/* Chest screen panel — small dashboard on the bot */}
      <mesh position={[0, 0.18, 0.215]}>
        <planeGeometry args={[0.28, 0.18]} />
        <meshBasicMaterial color={color} transparent opacity={0.55} toneMapped={false} />
      </mesh>
      <lineSegments position={[0, 0.18, 0.216]}>
        <edgesGeometry args={[new THREE.PlaneGeometry(0.28, 0.18)]} />
        <lineBasicMaterial color={color} toneMapped={false} />
      </lineSegments>
      {/* Chest core dot below screen */}
      <mesh position={[0, -0.05, 0.22]}>
        <ringGeometry args={[0.045, 0.07, 18]} />
        <meshBasicMaterial color={accent} toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.05, 0.22]}>
        <circleGeometry args={[0.025, 14]} />
        <meshBasicMaterial color={NEON} toneMapped={false} />
      </mesh>
      {/* Side accent strips (left + right) — emissive lines down the torso */}
      <mesh position={[-0.305, 0.1, 0]}>
        <planeGeometry args={[0.02, 0.7]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} toneMapped={false} />
      </mesh>
      <mesh position={[0.305, 0.1, 0]}>
        <planeGeometry args={[0.02, 0.7]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} toneMapped={false} />
      </mesh>
      {/* Inner self-illumination */}
      <pointLight position={[0, 0.1, 0.45]} color={accent} intensity={0.55} distance={1.6} />

      {/* Shoulders — beveled caps */}
      <mesh position={[-0.38, 0.42, 0]}>
        <sphereGeometry args={[0.13, 14, 14]} />
        <meshStandardMaterial color="#7088ba" metalness={0.65} roughness={0.34} emissive="#3a4d7c" emissiveIntensity={0.45} />
      </mesh>
      <mesh position={[0.38, 0.42, 0]}>
        <sphereGeometry args={[0.13, 14, 14]} />
        <meshStandardMaterial color="#7088ba" metalness={0.65} roughness={0.34} emissive="#3a4d7c" emissiveIntensity={0.45} />
      </mesh>
      {/* Shoulder accent dot */}
      <mesh position={[-0.38, 0.42, 0.13]}>
        <circleGeometry args={[0.025, 12]} />
        <meshBasicMaterial color={accent} toneMapped={false} />
      </mesh>
      <mesh position={[0.38, 0.42, 0.13]}>
        <circleGeometry args={[0.025, 12]} />
        <meshBasicMaterial color={accent} toneMapped={false} />
      </mesh>

      {/* Arms — articulated upper + forearm reaching the terminal */}
      <group ref={armL} position={[-0.38, 0.42, 0]}>
        <RoundedBox args={[0.12, 0.44, 0.12]} radius={0.04} smoothness={2} position={[0, -0.18, 0.18]} rotation={[Math.PI / 4, 0, 0]} castShadow>
          <meshStandardMaterial color="#5670a4" metalness={0.6} roughness={0.4} emissive="#28386a" emissiveIntensity={0.45} />
        </RoundedBox>
        {/* Wrist joint */}
        <mesh position={[0, -0.32, 0.32]}>
          <sphereGeometry args={[0.06, 12, 12]} />
          <meshStandardMaterial color="#54699c" metalness={0.75} roughness={0.35} emissive="#1f2e54" emissiveIntensity={0.3} />
        </mesh>
        {/* Hand / fingertip */}
        <mesh position={[0, -0.38, 0.4]}>
          <sphereGeometry args={[0.05, 10, 10]} />
          <meshBasicMaterial color={accent} toneMapped={false} />
        </mesh>
      </group>
      <group ref={armR} position={[0.38, 0.42, 0]}>
        <RoundedBox args={[0.12, 0.44, 0.12]} radius={0.04} smoothness={2} position={[0, -0.18, 0.18]} rotation={[Math.PI / 4, 0, 0]} castShadow>
          <meshStandardMaterial color="#5670a4" metalness={0.6} roughness={0.4} emissive="#28386a" emissiveIntensity={0.45} />
        </RoundedBox>
        <mesh position={[0, -0.32, 0.32]}>
          <sphereGeometry args={[0.06, 12, 12]} />
          <meshStandardMaterial color="#54699c" metalness={0.75} roughness={0.35} emissive="#1f2e54" emissiveIntensity={0.3} />
        </mesh>
        <mesh position={[0, -0.38, 0.4]}>
          <sphereGeometry args={[0.05, 10, 10]} />
          <meshBasicMaterial color={accent} toneMapped={false} />
        </mesh>
      </group>

      {/* Neck */}
      <mesh position={[0, 0.62, 0]}>
        <cylinderGeometry args={[0.06, 0.09, 0.12, 10]} />
        <meshStandardMaterial color="#3e527c" metalness={0.8} roughness={0.35} />
      </mesh>

      {/* Head — rounded with sleek visor wrap */}
      <group ref={head} position={[0, 0.92, 0]}>
        <RoundedBox args={[0.46, 0.36, 0.4]} radius={0.07} smoothness={2} castShadow>
          <meshStandardMaterial color="#7088ba" metalness={0.65} roughness={0.32} emissive="#3a4d7c" emissiveIntensity={0.5} />
        </RoundedBox>
        {/* Visor — wider wrap around */}
        <mesh position={[0, 0.03, 0.205]}>
          <planeGeometry args={[0.4, 0.14]} />
          <meshBasicMaterial ref={visor} color={color} toneMapped={false} />
        </mesh>
        {/* Visor top frame highlight */}
        <mesh position={[0, 0.105, 0.206]}>
          <planeGeometry args={[0.4, 0.012]} />
          <meshBasicMaterial color={accent} toneMapped={false} />
        </mesh>
        {/* Antennae */}
        <mesh position={[-0.14, 0.22, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.18, 6]} />
          <meshStandardMaterial color="#3e527c" metalness={0.9} roughness={0.2} />
        </mesh>
        <mesh position={[-0.14, 0.33, 0]}>
          <sphereGeometry args={[0.028, 10, 10]} />
          <meshBasicMaterial color={accent} toneMapped={false} />
        </mesh>
        <mesh position={[0.14, 0.22, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.18, 6]} />
          <meshStandardMaterial color="#3e527c" metalness={0.9} roughness={0.2} />
        </mesh>
        <mesh position={[0.14, 0.33, 0]}>
          <sphereGeometry args={[0.028, 10, 10]} />
          <meshBasicMaterial color={accent} toneMapped={false} />
        </mesh>
        {/* Cheek vent */}
        <mesh position={[-0.225, 0, 0]}>
          <planeGeometry args={[0.012, 0.08]} />
          <meshBasicMaterial color={accent} toneMapped={false} />
        </mesh>
        <mesh position={[0.225, 0, 0]}>
          <planeGeometry args={[0.012, 0.08]} />
          <meshBasicMaterial color={accent} toneMapped={false} />
        </mesh>
      </group>

    </group>
  );
}

function CodeLine({ y, maxW, color, seed }: { y: number; maxW: number; color: string; seed: number }) {
  const ref = useRef<THREE.Mesh>(null!);
  const w = useMemo(() => 0.2 + ((Math.sin(seed * 7.3) + 1) / 2) * (maxW - 0.25), [seed, maxW]);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime + seed * 1.7;
    const phase = (t % 4) / 4;
    const sx = Math.min(1, phase * 1.5);
    ref.current.scale.x = sx;
  });
  return (
    <mesh ref={ref} position={[-(maxW / 2) + w / 2, y, 0.001]}>
      <planeGeometry args={[w, 0.018]} />
      <meshBasicMaterial color={color} transparent opacity={0.9} toneMapped={false} />
    </mesh>
  );
}

function CaretBlink({ seed }: { seed: number }) {
  const ref = useRef<THREE.MeshBasicMaterial>(null!);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime + seed;
    ref.current.opacity = Math.sin(t * 4) > 0 ? 1 : 0.05;
  });
  return (
    <mesh position={[0.32, -0.18, 0.001]}>
      <planeGeometry args={[0.02, 0.06]} />
      <meshBasicMaterial ref={ref} color={NEON} transparent opacity={1} toneMapped={false} />
    </mesh>
  );
}

/* ───────────────────────── Thinker Robot ───────────────────────── */
function ThinkerRobot({ position, seed = 0 }: { position: [number, number, number]; seed?: number }) {
  const head = useRef<THREE.Group>(null!);
  const orb = useRef<THREE.Group>(null!);
  const eye = useRef<THREE.MeshBasicMaterial>(null!);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed;
    if (head.current) head.current.rotation.y = Math.sin(t * 0.4) * 0.4;
    if (orb.current) {
      orb.current.rotation.y = t * 0.5;
      orb.current.rotation.x = Math.sin(t * 0.3) * 0.2;
    }
    if (eye.current) {
      eye.current.opacity = 0.5 + Math.abs(Math.sin(t * 1.5)) * 0.5;
    }
  });

  // pre-compute neural sphere connections
  const lines = useMemo(() => {
    const pts: [THREE.Vector3, THREE.Vector3][] = [];
    const nodes: THREE.Vector3[] = [];
    for (let i = 0; i < 14; i++) {
      const phi = Math.acos(1 - 2 * (i + 0.5) / 14);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      nodes.push(new THREE.Vector3(
        Math.cos(theta) * Math.sin(phi),
        Math.sin(theta) * Math.sin(phi),
        Math.cos(phi)
      ).multiplyScalar(0.5));
    }
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        if (nodes[i].distanceTo(nodes[j]) < 0.55) pts.push([nodes[i], nodes[j]]);
      }
    }
    return { nodes, pts };
  }, []);

  return (
    <group position={position}>
      {/* Hover base */}
      <mesh position={[0, -0.55, 0]} castShadow>
        <cylinderGeometry args={[0.46, 0.56, 0.18, 18]} />
        <meshStandardMaterial color="#5670a4" metalness={0.65} roughness={0.4} emissive="#28386a" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0, -0.46, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5, 0.58, 28]} />
        <meshBasicMaterial color={VIOLET} transparent opacity={0.75} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>

      {/* Torso — taller, rounded, with emissive self-glow */}
      <RoundedBox args={[0.7, 1.02, 0.48]} radius={0.07} smoothness={2} position={[0, 0.06, 0]} castShadow>
        <meshStandardMaterial color="#6e85b8" metalness={0.5} roughness={0.4} emissive="#3a4d7c" emissiveIntensity={0.55} />
      </RoundedBox>
      {/* Chest concentric rings */}
      <mesh position={[0, 0.18, 0.245]}>
        <ringGeometry args={[0.085, 0.115, 28]} />
        <meshBasicMaterial color={VIOLET} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.18, 0.245]}>
        <ringGeometry args={[0.04, 0.06, 24]} />
        <meshBasicMaterial color={NEON} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.18, 0.245]}>
        <circleGeometry args={[0.022, 14]} />
        <meshBasicMaterial color={VIOLET} toneMapped={false} />
      </mesh>
      {/* Side accent strips */}
      <mesh position={[-0.355, 0.06, 0]}>
        <planeGeometry args={[0.022, 0.85]} />
        <meshBasicMaterial color={VIOLET} transparent opacity={0.85} toneMapped={false} />
      </mesh>
      <mesh position={[0.355, 0.06, 0]}>
        <planeGeometry args={[0.022, 0.85]} />
        <meshBasicMaterial color={VIOLET} transparent opacity={0.85} toneMapped={false} />
      </mesh>
      <pointLight position={[0, 0.15, 0.5]} color={VIOLET} intensity={0.7} distance={2.4} />

      {/* Folded thinker arms — upper + forearm with elbow joint */}
      <group position={[-0.38, 0.4, 0.05]} rotation={[0, 0, 0.32]}>
        <RoundedBox args={[0.12, 0.42, 0.12]} radius={0.04} smoothness={2} castShadow>
          <meshStandardMaterial color="#5670a4" metalness={0.6} roughness={0.4} emissive="#28386a" emissiveIntensity={0.45} />
        </RoundedBox>
        {/* Elbow */}
        <mesh position={[0, -0.24, 0]}>
          <sphereGeometry args={[0.075, 12, 12]} />
          <meshStandardMaterial color="#54699c" metalness={0.75} roughness={0.32} emissive="#1f2e54" emissiveIntensity={0.3} />
        </mesh>
        <RoundedBox args={[0.11, 0.36, 0.11]} radius={0.04} smoothness={2} position={[0.18, -0.42, 0.05]} rotation={[0, 0, -1.0]} castShadow>
          <meshStandardMaterial color="#5670a4" metalness={0.6} roughness={0.4} emissive="#28386a" emissiveIntensity={0.45} />
        </RoundedBox>
      </group>
      <group position={[0.38, 0.4, 0.05]} rotation={[0, 0, -0.32]}>
        <RoundedBox args={[0.12, 0.42, 0.12]} radius={0.04} smoothness={2} castShadow>
          <meshStandardMaterial color="#5670a4" metalness={0.6} roughness={0.4} emissive="#28386a" emissiveIntensity={0.45} />
        </RoundedBox>
        <mesh position={[0, -0.24, 0]}>
          <sphereGeometry args={[0.075, 12, 12]} />
          <meshStandardMaterial color="#54699c" metalness={0.75} roughness={0.32} emissive="#1f2e54" emissiveIntensity={0.3} />
        </mesh>
        <RoundedBox args={[0.11, 0.36, 0.11]} radius={0.04} smoothness={2} position={[-0.18, -0.42, 0.05]} rotation={[0, 0, 1.0]} castShadow>
          <meshStandardMaterial color="#5670a4" metalness={0.6} roughness={0.4} emissive="#28386a" emissiveIntensity={0.45} />
        </RoundedBox>
      </group>

      {/* Neck */}
      <mesh position={[0, 0.65, 0]}>
        <cylinderGeometry args={[0.06, 0.1, 0.13, 10]} />
        <meshStandardMaterial color="#3e527c" metalness={0.8} roughness={0.32} />
      </mesh>

      {/* Head — sphere with emissive self-glow + sensor crown */}
      <group ref={head} position={[0, 0.96, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.28, 18, 18]} />
          <meshStandardMaterial color="#7088ba" metalness={0.65} roughness={0.32} emissive="#3a4d7c" emissiveIntensity={0.5} />
        </mesh>
        {/* Single cyclops eye — concentric */}
        <mesh position={[0, 0, 0.255]}>
          <circleGeometry args={[0.1, 28]} />
          <meshBasicMaterial color="#0a0c1a" toneMapped={false} />
        </mesh>
        <mesh position={[0, 0, 0.256]}>
          <ringGeometry args={[0.07, 0.085, 28]} />
          <meshBasicMaterial ref={eye} color={VIOLET} transparent opacity={1} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0, 0.257]}>
          <circleGeometry args={[0.045, 18]} />
          <meshBasicMaterial color={NEON} toneMapped={false} />
        </mesh>
        {/* Sensor crown */}
        <mesh position={[0, 0.24, 0]}>
          <torusGeometry args={[0.18, 0.018, 10, 28]} />
          <meshStandardMaterial color={VIOLET} emissive={VIOLET} emissiveIntensity={1.1} metalness={0.6} roughness={0.3} />
        </mesh>
        {/* Side ear pods */}
        <mesh position={[-0.28, 0, 0]}>
          <sphereGeometry args={[0.05, 12, 12]} />
          <meshStandardMaterial color="#3e527c" metalness={0.8} roughness={0.32} emissive={VIOLET} emissiveIntensity={0.4} />
        </mesh>
        <mesh position={[0.28, 0, 0]}>
          <sphereGeometry args={[0.05, 12, 12]} />
          <meshStandardMaterial color="#3e527c" metalness={0.8} roughness={0.32} emissive={VIOLET} emissiveIntensity={0.4} />
        </mesh>
      </group>

      {/* Neural projection orb floating above */}
      <Float speed={1.2} rotationIntensity={0.4} floatIntensity={0.6} position={[0, 1.95, 0.2]}>
        <group ref={orb}>
          {/* Wireframe sphere */}
          <mesh>
            <sphereGeometry args={[0.5, 12, 12]} />
            <meshBasicMaterial color={VIOLET} wireframe transparent opacity={0.35} toneMapped={false} />
          </mesh>
          {/* Inner glowing core */}
          <mesh>
            <sphereGeometry args={[0.18, 16, 16]} />
            <meshBasicMaterial color={VIOLET} transparent opacity={0.55} toneMapped={false} />
          </mesh>
          {/* Nodes */}
          {lines.nodes.map((n, i) => (
            <mesh key={i} position={n}>
              <sphereGeometry args={[0.025, 8, 8]} />
              <meshBasicMaterial color={NEON} toneMapped={false} />
            </mesh>
          ))}
          {/* Connections */}
          {lines.pts.map((p, i) => (
            <NeuralEdge key={i} a={p[0]} b={p[1]} />
          ))}
        </group>
      </Float>

      {/* Beam connecting head to orb */}
      <mesh position={[0, 1.45, 0.1]}>
        <cylinderGeometry args={[0.005, 0.02, 0.55, 6, 1, true]} />
        <meshBasicMaterial color={VIOLET} transparent opacity={0.5} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function NeuralEdge({ a, b }: { a: THREE.Vector3; b: THREE.Vector3 }) {
  const points = useMemo<[THREE.Vector3, THREE.Vector3]>(() => [a, b], [a, b]);
  return (
    <Line points={points} color={CYAN} transparent opacity={0.5} lineWidth={1} toneMapped={false} />
  );
}

/* ───────────────────────── Supervisor Robot (patrolling) ───────────────────────── */
function SupervisorRobot() {
  const root = useRef<THREE.Group>(null!);
  const beam = useRef<THREE.Mesh>(null!);
  const beamMat = useRef<THREE.MeshBasicMaterial>(null!);
  const visor = useRef<THREE.MeshBasicMaterial>(null!);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (root.current) {
      const r = 3.0;
      root.current.position.x = Math.cos(t * 0.16) * r;
      root.current.position.z = Math.sin(t * 0.16) * 1.0 - 7.0;
      // face direction of travel
      root.current.rotation.y = Math.atan2(
        Math.sin(t * 0.16) * r * -0.16,
        Math.cos(t * 0.16) * 1.0 * 0.16
      );
    }
    if (beamMat.current) beamMat.current.opacity = 0.35 + Math.abs(Math.sin(t * 2)) * 0.3;
    if (beam.current) beam.current.rotation.y = t * 1.2;
    if (visor.current) visor.current.opacity = 0.7 + Math.abs(Math.sin(t * 3)) * 0.3;
  });

  return (
    <group ref={root} scale={0.85}>
      {/* Hover base */}
      <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[0.6, 0.78, 0.2, 20]} />
        <meshStandardMaterial color="#54699c" metalness={0.7} roughness={0.4} emissive="#1a2640" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0, -0.22, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.78, 0.92, 32]} />
        <meshBasicMaterial color={AMBER} transparent opacity={0.7} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.18, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.95, 1.0, 32]} />
        <meshBasicMaterial color={AMBER} transparent opacity={0.45} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <pointLight position={[0, -0.3, 0]} color={AMBER} intensity={1.0} distance={3.2} />

      {/* Tall torso — rounded, strong emissive */}
      <RoundedBox args={[0.78, 1.18, 0.6]} radius={0.08} smoothness={2} position={[0, 0.55, 0]} castShadow>
        <meshStandardMaterial color="#7088ba" metalness={0.55} roughness={0.4} emissive="#3a4d7c" emissiveIntensity={0.55} />
      </RoundedBox>
      {/* Authority pauldrons — rounded blocks */}
      <RoundedBox args={[0.34, 0.28, 0.34]} radius={0.07} smoothness={2} position={[-0.5, 1.04, 0]}>
        <meshStandardMaterial color="#5670a4" metalness={0.72} roughness={0.32} emissive="#28386a" emissiveIntensity={0.45} />
      </RoundedBox>
      <RoundedBox args={[0.34, 0.28, 0.34]} radius={0.07} smoothness={2} position={[0.5, 1.04, 0]}>
        <meshStandardMaterial color="#5670a4" metalness={0.72} roughness={0.32} emissive="#28386a" emissiveIntensity={0.45} />
      </RoundedBox>
      {/* Pauldron rank stripes */}
      <mesh position={[-0.5, 1.04, 0.171]}>
        <planeGeometry args={[0.24, 0.04]} />
        <meshBasicMaterial color={AMBER} toneMapped={false} />
      </mesh>
      <mesh position={[0.5, 1.04, 0.171]}>
        <planeGeometry args={[0.24, 0.04]} />
        <meshBasicMaterial color={AMBER} toneMapped={false} />
      </mesh>

      {/* Chest insignia — concentric badge */}
      <mesh position={[0, 0.7, 0.305]}>
        <torusGeometry args={[0.16, 0.028, 10, 28]} />
        <meshBasicMaterial color={AMBER} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.7, 0.305]}>
        <torusGeometry args={[0.085, 0.018, 8, 24]} />
        <meshBasicMaterial color={AMBER} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.7, 0.306]}>
        <circleGeometry args={[0.04, 16]} />
        <meshBasicMaterial color="#FFD58A" toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.25, 0.305]}>
        <planeGeometry args={[0.6, 0.04]} />
        <meshBasicMaterial color={AMBER} transparent opacity={0.85} toneMapped={false} />
      </mesh>

      {/* Head — rounded helmet, brow, wide visor, crest */}
      <group position={[0, 1.5, 0]}>
        <RoundedBox args={[0.56, 0.46, 0.46]} radius={0.08} smoothness={2} castShadow>
          <meshStandardMaterial color="#788ec0" metalness={0.65} roughness={0.32} emissive="#3a4d7c" emissiveIntensity={0.5} />
        </RoundedBox>
        <mesh position={[0, 0.16, 0.232]}>
          <planeGeometry args={[0.5, 0.04]} />
          <meshBasicMaterial color={AMBER} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.05, 0.232]}>
          <planeGeometry args={[0.5, 0.18]} />
          <meshBasicMaterial ref={visor} color={AMBER} transparent opacity={1} toneMapped={false} />
        </mesh>
        <mesh position={[-0.285, 0.05, 0]}>
          <planeGeometry args={[0.014, 0.12]} />
          <meshBasicMaterial color={AMBER} toneMapped={false} />
        </mesh>
        <mesh position={[0.285, 0.05, 0]}>
          <planeGeometry args={[0.014, 0.12]} />
          <meshBasicMaterial color={AMBER} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.255, 0]}>
          <boxGeometry args={[0.06, 0.06, 0.45]} />
          <meshStandardMaterial color="#3e527c" metalness={0.85} roughness={0.3} emissive={AMBER} emissiveIntensity={0.45} />
        </mesh>
      </group>

      {/* Scan beam projecting downward */}
      <group position={[0, -0.1, 0]}>
        <mesh ref={beam} position={[0, -0.6, 0]}>
          <coneGeometry args={[1.1, 1.5, 24, 1, true]} />
          <meshBasicMaterial ref={beamMat} color={AMBER} transparent opacity={0.45} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

/* ───────────────────────── Desk ───────────────────────── */
function Desk({ position, color = CYAN }: { position: [number, number, number]; color?: string }) {
  return (
    <group position={position}>
      {/* Desk top */}
      <RoundedBox args={[1.6, 0.06, 0.7]} radius={0.025} smoothness={2} position={[0, 0, 0]} castShadow>
        <meshStandardMaterial color="#3a4f78" metalness={0.55} roughness={0.5} emissive="#15203a" emissiveIntensity={0.3} />
      </RoundedBox>
      {/* Front fascia panel */}
      <RoundedBox args={[1.55, 0.4, 0.04]} radius={0.02} smoothness={2} position={[0, -0.22, 0.34]}>
        <meshStandardMaterial color="#2c3e62" metalness={0.55} roughness={0.5} emissive="#0e1830" emissiveIntensity={0.3} />
      </RoundedBox>
      {/* Glowing edge strip on front */}
      <mesh position={[0, -0.04, 0.361]}>
        <planeGeometry args={[1.5, 0.012]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      {/* Side legs */}
      <mesh position={[-0.7, -0.4, 0]}>
        <boxGeometry args={[0.06, 0.7, 0.6]} />
        <meshStandardMaterial color="#2c3e62" metalness={0.7} roughness={0.5} />
      </mesh>
      <mesh position={[0.7, -0.4, 0]}>
        <boxGeometry args={[0.06, 0.7, 0.6]} />
        <meshStandardMaterial color="#2c3e62" metalness={0.7} roughness={0.5} />
      </mesh>
    </group>
  );
}

/* ───────────────────────── Laptop ───────────────────────── */
function Laptop({ position, color = CYAN, seed = 0 }: { position: [number, number, number]; color?: string; seed?: number }) {
  const screenGlow = useRef<THREE.MeshBasicMaterial>(null!);
  useFrame(({ clock }) => {
    if (!screenGlow.current) return;
    const t = clock.elapsedTime + seed;
    screenGlow.current.opacity = 0.6 + Math.abs(Math.sin(t * 2.4)) * 0.35;
  });
  return (
    <group position={position}>
      {/* Base / keyboard tray */}
      <RoundedBox args={[0.6, 0.03, 0.42]} radius={0.015} smoothness={2} position={[0, 0, 0]} castShadow>
        <meshStandardMaterial color="#1d2842" metalness={0.85} roughness={0.3} />
      </RoundedBox>
      {/* Trackpad */}
      <mesh position={[0, 0.018, 0.12]}>
        <planeGeometry args={[0.2, 0.12]} />
        <meshStandardMaterial color="#0e1424" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Keyboard area — emissive grid */}
      <mesh position={[0, 0.018, -0.07]}>
        <planeGeometry args={[0.5, 0.18]} />
        <meshBasicMaterial color={color} transparent opacity={0.32} toneMapped={false} />
      </mesh>
      {/* Hinge */}
      <mesh position={[0, 0.012, -0.21]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.014, 0.014, 0.58, 8]} />
        <meshStandardMaterial color="#2c3e62" metalness={0.85} roughness={0.3} />
      </mesh>
      {/* Screen — open like a real laptop, tilted slightly forward toward the camera */}
      <group position={[0, 0.012, -0.21]} rotation={[0.22, 0, 0]}>
        {/* Screen back / chassis */}
        <RoundedBox args={[0.62, 0.44, 0.025]} radius={0.015} smoothness={2} position={[0, 0.22, -0.012]}>
          <meshStandardMaterial color="#1d2842" metalness={0.85} roughness={0.3} />
        </RoundedBox>
        {/* Screen lit area */}
        <mesh position={[0, 0.22, 0.001]}>
          <planeGeometry args={[0.58, 0.38]} />
          <meshBasicMaterial ref={screenGlow} color={color} transparent opacity={0.95} toneMapped={false} />
        </mesh>
        {/* Frame */}
        <lineSegments position={[0, 0.22, 0.002]}>
          <edgesGeometry args={[new THREE.PlaneGeometry(0.58, 0.38)]} />
          <lineBasicMaterial color={color} toneMapped={false} />
        </lineSegments>
        {/* Code lines on the screen */}
        {[...Array(6)].map((_, i) => (
          <CodeLine key={i} y={0.36 - i * 0.04} maxW={0.5} color={NEON} seed={seed + i * 0.7} />
        ))}
        {/* Caret blink at bottom of code area */}
        <mesh position={[0.22, 0.12, 0.003]}>
          <planeGeometry args={[0.018, 0.04]} />
          <meshBasicMaterial color={NEON} toneMapped={false} />
        </mesh>
        {/* Bezel logo dot at bottom of screen */}
        <mesh position={[0, 0.045, 0.001]}>
          <circleGeometry args={[0.008, 12]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

/* ───────────────────────── Validator (pacing left↔right behind desks) ───────────────────────── */
function Validator() {
  const root = useRef<THREE.Group>(null!);
  const beam = useRef<THREE.Mesh>(null!);
  const beamMat = useRef<THREE.MeshBasicMaterial>(null!);
  const visor = useRef<THREE.MeshBasicMaterial>(null!);

  // Walk-and-pause state machine:
  // Visit each worker in order, walk for WALK_T then pause for PAUSE_T at each station.
  const stations = useMemo(() => [-3.6, 0, 3.6, 0], []); // visit L, C, R, C, repeat
  const WALK_T = 2.2;
  const PAUSE_T = 1.8;
  const phase = WALK_T + PAUSE_T;

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const totalCycle = stations.length * phase;
    const cyc = t % totalCycle;
    const segIdx = Math.floor(cyc / phase);
    const segT = cyc - segIdx * phase;
    const fromX = stations[segIdx];
    const toX = stations[(segIdx + 1) % stations.length];

    let x: number;
    let walking: boolean;
    if (segT < WALK_T) {
      // ease-in-out walking from fromX to toX
      const p = segT / WALK_T;
      const eased = p * p * (3 - 2 * p);
      x = fromX + (toX - fromX) * eased;
      walking = true;
    } else {
      x = toX;
      walking = false;
    }

    if (root.current) {
      root.current.position.x = x;
      root.current.position.z = -3.6;
      // Walking bob — only while moving
      root.current.position.y = walking ? 0.04 + Math.abs(Math.sin(t * 7)) * 0.05 : 0.02;
      // Facing: while walking, look in travel direction; while paused, face the worker (toward camera, +Z)
      const targetRotY = walking
        ? (toX > fromX ? -Math.PI / 2 : Math.PI / 2)
        : 0;
      // Smooth rotation toward target
      const cur = root.current.rotation.y;
      let diff = targetRotY - cur;
      // Wrap to shortest path
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      root.current.rotation.y = cur + diff * 0.18;
    }

    // Scan beam — intensifies while pausing (he's reviewing)
    if (beamMat.current) {
      const base = walking ? 0.32 : 0.6;
      beamMat.current.opacity = base + Math.abs(Math.sin(t * 2.4)) * 0.3;
    }
    if (beam.current) beam.current.rotation.y = t * (walking ? 1.2 : 2.5);
    if (visor.current) visor.current.opacity = 0.7 + Math.abs(Math.sin(t * (walking ? 3 : 5))) * 0.3;
  });

  return (
    <group ref={root} scale={0.9}>
      {/* Hover base (no legs — feels official) */}
      <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[0.55, 0.7, 0.18, 18]} />
        <meshStandardMaterial color="#54699c" metalness={0.7} roughness={0.4} emissive="#1a2640" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0, -0.22, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.72, 0.86, 30]} />
        <meshBasicMaterial color={AMBER} transparent opacity={0.7} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <pointLight position={[0, -0.3, 0]} color={AMBER} intensity={0.9} distance={3} />

      {/* Tall torso */}
      <RoundedBox args={[0.74, 1.1, 0.55]} radius={0.08} smoothness={2} position={[0, 0.55, 0]} castShadow>
        <meshStandardMaterial color="#7088ba" metalness={0.55} roughness={0.4} emissive="#3a4d7c" emissiveIntensity={0.55} />
      </RoundedBox>
      {/* Pauldrons with rank stripe */}
      <RoundedBox args={[0.32, 0.26, 0.32]} radius={0.06} smoothness={2} position={[-0.48, 1.0, 0]}>
        <meshStandardMaterial color="#5670a4" metalness={0.72} roughness={0.32} emissive="#28386a" emissiveIntensity={0.45} />
      </RoundedBox>
      <RoundedBox args={[0.32, 0.26, 0.32]} radius={0.06} smoothness={2} position={[0.48, 1.0, 0]}>
        <meshStandardMaterial color="#5670a4" metalness={0.72} roughness={0.32} emissive="#28386a" emissiveIntensity={0.45} />
      </RoundedBox>
      <mesh position={[-0.48, 1.0, 0.165]}>
        <planeGeometry args={[0.22, 0.04]} />
        <meshBasicMaterial color={AMBER} toneMapped={false} />
      </mesh>
      <mesh position={[0.48, 1.0, 0.165]}>
        <planeGeometry args={[0.22, 0.04]} />
        <meshBasicMaterial color={AMBER} toneMapped={false} />
      </mesh>
      {/* Chest badge */}
      <mesh position={[0, 0.7, 0.28]}>
        <torusGeometry args={[0.14, 0.026, 10, 26]} />
        <meshBasicMaterial color={AMBER} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.7, 0.281]}>
        <circleGeometry args={[0.04, 16]} />
        <meshBasicMaterial color="#FFD58A" toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.25, 0.281]}>
        <planeGeometry args={[0.55, 0.04]} />
        <meshBasicMaterial color={AMBER} transparent opacity={0.85} toneMapped={false} />
      </mesh>
      {/* Holographic clipboard floating in front of supervisor */}
      <ValidatorClipboard />

      {/* Head */}
      <group position={[0, 1.45, 0]}>
        <RoundedBox args={[0.52, 0.42, 0.42]} radius={0.07} smoothness={2} castShadow>
          <meshStandardMaterial color="#788ec0" metalness={0.65} roughness={0.32} emissive="#3a4d7c" emissiveIntensity={0.5} />
        </RoundedBox>
        <mesh position={[0, 0.14, 0.212]}>
          <planeGeometry args={[0.46, 0.04]} />
          <meshBasicMaterial color={AMBER} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.04, 0.212]}>
          <planeGeometry args={[0.46, 0.16]} />
          <meshBasicMaterial ref={visor} color={AMBER} transparent opacity={1} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.235, 0]}>
          <boxGeometry args={[0.05, 0.05, 0.42]} />
          <meshStandardMaterial color="#3e527c" metalness={0.85} roughness={0.3} emissive={AMBER} emissiveIntensity={0.45} />
        </mesh>
      </group>

      {/* Scan beam projecting downward */}
      <group position={[0, -0.1, 0]}>
        <mesh ref={beam} position={[0, -0.6, 0]}>
          <coneGeometry args={[1.0, 1.4, 22, 1, true]} />
          <meshBasicMaterial ref={beamMat} color={AMBER} transparent opacity={0.45} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

function ValidatorClipboard() {
  const ref = useRef<THREE.Group>(null!);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    ref.current.position.y = 0.35 + Math.sin(t * 1.3) * 0.02;
    ref.current.rotation.x = -0.5 + Math.sin(t * 0.9) * 0.04;
  });
  return (
    <group ref={ref} position={[0.45, 0.35, 0.32]} rotation={[-0.5, 0, 0]}>
      <mesh>
        <planeGeometry args={[0.36, 0.25]} />
        <meshBasicMaterial color={AMBER} transparent opacity={0.4} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[new THREE.PlaneGeometry(0.36, 0.25)]} />
        <lineBasicMaterial color={AMBER} toneMapped={false} />
      </lineSegments>
      {/* Checkmarks */}
      {[...Array(4)].map((_, i) => (
        <mesh key={i} position={[-0.13, 0.07 - i * 0.045, 0.001]}>
          <planeGeometry args={[0.018, 0.012]} />
          <meshBasicMaterial color={i < 3 ? '#22C55E' : '#FFD58A'} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/* ───────────────────────── Micro-drones (lightweight) ───────────────────────── */
function MicroDrone({ basePos, seed = 0 }: { basePos: [number, number, number]; seed?: number }) {
  const ref = useRef<THREE.Group>(null!);
  const halo = useRef<THREE.MeshBasicMaterial>(null!);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed * 0.8;
    if (!ref.current) return;
    ref.current.position.x = basePos[0] + Math.sin(t * 0.5 + seed) * 1.4;
    ref.current.position.y = basePos[1] + Math.cos(t * 0.7 + seed) * 0.4;
    ref.current.position.z = basePos[2] + Math.cos(t * 0.4 + seed * 0.5) * 1.2;
    if (halo.current) halo.current.opacity = 0.18 + Math.abs(Math.sin(t * 2)) * 0.18;
  });
  return (
    <group ref={ref}>
      <mesh>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshBasicMaterial color={CYAN} toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.14, 10, 10]} />
        <meshBasicMaterial ref={halo} color={CYAN} transparent opacity={0.25} toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
  );
}

/* ───────────────────────── AI Core Reactor ───────────────────────── */
function AICoreReactor({ position }: { position: [number, number, number] }) {
  const ring1 = useRef<THREE.Mesh>(null!);
  const ring2 = useRef<THREE.Mesh>(null!);
  const ring3 = useRef<THREE.Mesh>(null!);
  const core = useRef<THREE.MeshBasicMaterial>(null!);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (ring1.current) ring1.current.rotation.x = t * 0.5;
    if (ring2.current) { ring2.current.rotation.y = t * 0.7; ring2.current.rotation.z = t * 0.2; }
    if (ring3.current) ring3.current.rotation.z = -t * 0.4;
    if (core.current) {
      const f = 0.7 + Math.abs(Math.sin(t * 1.5)) * 0.6;
      core.current.color.setStyle(PURPLE);
      core.current.color.multiplyScalar(f);
    }
  });

  return (
    <group position={position}>
      {/* Vertical pillar pedestal */}
      <mesh position={[0, -1.1, 0]}>
        <cylinderGeometry args={[0.5, 0.7, 0.5, 16]} />
        <meshStandardMaterial color="#324468" metalness={0.7} roughness={0.45} />
      </mesh>
      <mesh position={[0, -0.8, 0]}>
        <cylinderGeometry args={[0.3, 0.45, 0.15, 16]} />
        <meshStandardMaterial color="#3a4d72" metalness={0.8} roughness={0.35} />
      </mesh>
      {/* Light cage rings */}
      <mesh ref={ring1}>
        <torusGeometry args={[0.85, 0.03, 8, 64]} />
        <meshBasicMaterial color={PURPLE} toneMapped={false} />
      </mesh>
      <mesh ref={ring2}>
        <torusGeometry args={[1.0, 0.025, 8, 64]} />
        <meshBasicMaterial color={BLUE} toneMapped={false} />
      </mesh>
      <mesh ref={ring3}>
        <torusGeometry args={[1.15, 0.02, 8, 64]} />
        <meshBasicMaterial color={CYAN} toneMapped={false} />
      </mesh>
      {/* Core orb */}
      <mesh>
        <sphereGeometry args={[0.5, 24, 24]} />
        <meshBasicMaterial ref={core} color={PURPLE} transparent opacity={0.85} toneMapped={false} />
      </mesh>
      {/* Outer glow */}
      <mesh>
        <sphereGeometry args={[0.7, 24, 24]} />
        <meshBasicMaterial color={PURPLE} transparent opacity={0.18} toneMapped={false} />
      </mesh>
      <pointLight color={PURPLE} intensity={3} distance={8} />
    </group>
  );
}

/* ───────────────────────── Wall Screen (violet office backdrop) ───────────────────────── */
function WallScreen({ position = [0, 3, -9] as [number, number, number] }) {
  const glow = useRef<THREE.MeshBasicMaterial>(null!);
  useFrame(({ clock }) => {
    if (!glow.current) return;
    const t = clock.elapsedTime;
    glow.current.opacity = 0.32 + Math.abs(Math.sin(t * 0.6)) * 0.1;
  });
  // Screen size — sized to contain the headline + subtitle + CTAs in viewport
  const W = 14;
  const H = 6.5;
  return (
    <group position={position}>
      {/* Outer halo plane */}
      <mesh position={[0, 0, -0.06]}>
        <planeGeometry args={[W + 2, H + 1.2]} />
        <meshBasicMaterial color={PURPLE} transparent opacity={0.12} toneMapped={false} depthWrite={false} />
      </mesh>
      {/* Main violet screen */}
      <mesh>
        <planeGeometry args={[W, H]} />
        <meshBasicMaterial ref={glow} color={PURPLE} transparent opacity={0.42} toneMapped={false} />
      </mesh>
      {/* Inner soft fade panel */}
      <mesh position={[0, 0, 0.001]}>
        <planeGeometry args={[W - 0.4, H - 0.4]} />
        <meshBasicMaterial color={VIOLET} transparent opacity={0.18} toneMapped={false} />
      </mesh>
      {/* Frame */}
      <lineSegments>
        <edgesGeometry args={[new THREE.PlaneGeometry(W, H)]} />
        <lineBasicMaterial color={VIOLET} toneMapped={false} />
      </lineSegments>
      <lineSegments position={[0, 0, 0.002]}>
        <edgesGeometry args={[new THREE.PlaneGeometry(W - 0.4, H - 0.4)]} />
        <lineBasicMaterial color={CYAN} transparent opacity={0.45} toneMapped={false} />
      </lineSegments>
      {/* Corner brackets */}
      {([
        [-(W / 2 - 0.3), H / 2 - 0.3], [W / 2 - 0.3, H / 2 - 0.3], [-(W / 2 - 0.3), -(H / 2 - 0.3)], [W / 2 - 0.3, -(H / 2 - 0.3)],
      ] as [number, number][]).map(([x, y], i) => (
        <group key={i} position={[x, y, 0.003]}>
          <mesh position={[Math.sign(x) * -0.18, 0, 0]}>
            <planeGeometry args={[0.36, 0.04]} />
            <meshBasicMaterial color={CYAN} toneMapped={false} />
          </mesh>
          <mesh position={[0, Math.sign(y) * -0.18, 0]}>
            <planeGeometry args={[0.04, 0.36]} />
            <meshBasicMaterial color={CYAN} toneMapped={false} />
          </mesh>
        </group>
      ))}
      {/* Status row at top */}
      <mesh position={[0, H / 2 - 0.35, 0.003]}>
        <planeGeometry args={[W - 1.5, 0.04]} />
        <meshBasicMaterial color={CYAN} transparent opacity={0.45} toneMapped={false} />
      </mesh>
      {/* Status row at bottom */}
      <mesh position={[0, -(H / 2 - 0.35), 0.003]}>
        <planeGeometry args={[W - 1.5, 0.04]} />
        <meshBasicMaterial color={CYAN} transparent opacity={0.45} toneMapped={false} />
      </mesh>
      {/* Subtle scanline shimmer */}
      <ScreenScanline width={W - 0.4} height={H - 0.4} />
    </group>
  );
}

function ScreenScanline({ width, height }: { width: number; height: number }) {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    ref.current.position.y = -((t * 0.6) % (height + 0.4)) + height / 2 + 0.2;
  });
  return (
    <mesh ref={ref} position={[0, 0, 0.004]}>
      <planeGeometry args={[width, 0.06]} />
      <meshBasicMaterial color={NEON} transparent opacity={0.35} toneMapped={false} depthWrite={false} />
    </mesh>
  );
}

/* ───────────────────────── Holographic Dashboard ───────────────────────── */
function HoloDashboard({ position, rotation = [0, 0, 0], color = BLUE, title = 'AGENT.MONITOR', seed = 0 }: { position: [number, number, number]; rotation?: [number, number, number]; color?: string; title?: string; seed?: number }) {
  const group = useRef<THREE.Group>(null!);
  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.elapsedTime + seed;
    group.current.position.y = position[1] + Math.sin(t * 0.6) * 0.06;
    group.current.rotation.y = rotation[1] + Math.sin(t * 0.3) * 0.04;
  });
  return (
    <Float speed={0.8} rotationIntensity={0.05} floatIntensity={0.2}>
      <group ref={group} position={position} rotation={rotation}>
        {/* Glass panel */}
        <mesh>
          <planeGeometry args={[1.6, 1.0]} />
          <meshBasicMaterial color={color} transparent opacity={0.18} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
        {/* Frame */}
        <lineSegments>
          <edgesGeometry args={[new THREE.PlaneGeometry(1.6, 1.0)]} />
          <lineBasicMaterial color={color} transparent opacity={0.95} toneMapped={false} />
        </lineSegments>
        {/* Title bar */}
        <mesh position={[0, 0.42, 0.001]}>
          <planeGeometry args={[1.55, 0.12]} />
          <meshBasicMaterial color={color} transparent opacity={0.35} toneMapped={false} />
        </mesh>
        <Html position={[0, 0.42, 0.002]} center transform distanceFactor={2.4} style={{ pointerEvents: 'none' }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, fontWeight: 600, color: '#E2E8F0', letterSpacing: '0.2em', whiteSpace: 'nowrap' }}>{title}</div>
        </Html>
        {/* Bars */}
        {[...Array(5)].map((_, i) => (
          <DashboardBar key={i} y={0.22 - i * 0.13} color={color} seed={seed + i} />
        ))}
      </group>
    </Float>
  );
}

function DashboardBar({ y, color, seed }: { y: number; color: string; seed: number }) {
  const ref = useRef<THREE.Mesh>(null!);
  const max = 1.3;
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime + seed * 1.3;
    const pct = 0.3 + (Math.sin(t * 0.6) + 1) / 2 * 0.6;
    ref.current.scale.x = pct;
    ref.current.position.x = -max / 2 + (max * pct) / 2;
  });
  return (
    <>
      {/* Track */}
      <mesh position={[0, y, 0.002]}>
        <planeGeometry args={[max, 0.05]} />
        <meshBasicMaterial color={color} transparent opacity={0.15} toneMapped={false} />
      </mesh>
      {/* Fill */}
      <mesh ref={ref} position={[0, y, 0.003]}>
        <planeGeometry args={[max, 0.05]} />
        <meshBasicMaterial color={color} transparent opacity={0.95} toneMapped={false} />
      </mesh>
    </>
  );
}

/* ───────────────────────── Data pipeline (moving particles) ───────────────────────── */
function DataPipeline({ from, to, color = CYAN, count = 5 }: { from: [number, number, number]; to: [number, number, number]; color?: string; count?: number }) {
  const group = useRef<THREE.Group>(null!);
  const f = useMemo(() => new THREE.Vector3(...from), [from]);
  const t0 = useMemo(() => new THREE.Vector3(...to), [to]);
  const dir = useMemo(() => new THREE.Vector3().subVectors(t0, f), [f, t0]);

  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.elapsedTime;
    group.current.children.forEach((child, i) => {
      const phase = ((t * 0.4 + i / count) % 1);
      const p = new THREE.Vector3().copy(f).addScaledVector(dir, phase);
      child.position.copy(p);
      // arc up
      child.position.y += Math.sin(phase * Math.PI) * 0.5;
      const m = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
      if (m && m.opacity !== undefined) m.opacity = Math.sin(phase * Math.PI);
    });
  });

  return (
    <group ref={group}>
      {[...Array(count)].map((_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshBasicMaterial color={color} transparent opacity={0} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/* ───────────────────────── Vertical light beam columns (atmosphere) ───────────────────────── */
function LightColumn({ position, color, height = 6 }: { position: [number, number, number]; color: string; height?: number }) {
  const ref = useRef<THREE.MeshBasicMaterial>(null!);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.opacity = 0.18 + Math.abs(Math.sin(clock.elapsedTime * 0.5 + position[0])) * 0.2;
  });
  return (
    <mesh position={position}>
      <cylinderGeometry args={[0.05, 0.6, height, 16, 1, true]} />
      <meshBasicMaterial ref={ref} color={color} transparent opacity={0.3} side={THREE.DoubleSide} toneMapped={false} depthWrite={false} />
    </mesh>
  );
}

/* ───────────────────────── Scene composition ───────────────────────── */
function Scene() {
  return (
    <>
      <ambientLight intensity={0.85} color="#4a5894" />
      {/* Front camera fill — keeps the bots out of silhouette */}
      <directionalLight position={[0, 5, 12]} intensity={1.15} color="#bcc6ff" />
      {/* Top-right key */}
      <directionalLight position={[8, 10, 4]} intensity={0.65} color="#9aa6ff" />
      {/* Top-left key */}
      <directionalLight position={[-8, 10, 4]} intensity={0.55} color="#a8b4ff" />
      {/* Side accent fills */}
      <pointLight position={[-5, 2, -1]} intensity={0.9} color={BLUE} distance={12} />
      <pointLight position={[5, 2, -1]} intensity={0.9} color={CYAN} distance={12} />
      <fog attach="fog" args={['#070d1c', 13, 30]} />

      <Floor />

      {/* Violet wall screen — the office backdrop where the headline lives */}
      <WallScreen position={[0, 3.0, -9]} />

      {/* Walkway strip behind the desks (where the Validator paces) */}
      <mesh position={[0, -1.595, -3.6]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12, 1.2]} />
        <meshBasicMaterial color={AMBER} transparent opacity={0.12} toneMapped={false} depthWrite={false} />
      </mesh>
      {/* Walkway dashed center line */}
      {[...Array(9)].map((_, i) => (
        <mesh key={i} position={[-5 + i * 1.25, -1.59, -3.6]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.5, 0.04]} />
          <meshBasicMaterial color={AMBER} transparent opacity={0.55} toneMapped={false} />
        </mesh>
      ))}

      {/* OFFICE ROW — 3 desks brought forward toward camera */}
      {/* Left worker */}
      <Desk position={[-3.6, -0.4, -1.2]} color={CYAN} />
      <Laptop position={[-3.6, -0.36, -1.15]} color={CYAN} seed={0.2} />
      <WorkerRobot position={[-3.6, -0.05, -1.7]} color={CYAN} accent={PURPLE} seed={0.2} />

      {/* Center worker */}
      <Desk position={[0, -0.4, -1.2]} color={NEON} />
      <Laptop position={[0, -0.36, -1.15]} color={NEON} seed={1.2} />
      <WorkerRobot position={[0, -0.05, -1.7]} color={NEON} accent={BLUE} seed={1.2} />

      {/* Right worker */}
      <Desk position={[3.6, -0.4, -1.2]} color={VIOLET} />
      <Laptop position={[3.6, -0.36, -1.15]} color={VIOLET} seed={2.6} />
      <WorkerRobot position={[3.6, -0.05, -1.7]} color={VIOLET} accent={PURPLE} seed={2.6} />

      {/* Validator pacing left↔right on the walkway behind the row */}
      <Validator />
    </>
  );
}

/* ───────────────────────── Wrapper ───────────────────────── */
export default function OperationsCenter({ height = 720 }: { height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);
  const [docVisible, setDocVisible] = useState(typeof document === 'undefined' ? true : !document.hidden);
  const prefersReducedMotion = useMemo(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  []);

  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: '120px 0px', threshold: 0 }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const onVis = () => setDocVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const active = inView && docVisible;
  const frameloop: 'always' | 'demand' | 'never' = !active
    ? 'never'
    : prefersReducedMotion
      ? 'demand'
      : 'always';

  return (
    <div ref={ref} style={{ position: 'absolute', inset: 0, height, width: '100%' }} aria-hidden="true">
      <Canvas
        gl={{ antialias: false, powerPreference: 'high-performance', alpha: true, stencil: false, depth: true }}
        dpr={[1, 1]}
        camera={{ position: [0, 2.4, 8.8], fov: 40, near: 0.1, far: 45 }}
        frameloop={frameloop}
        style={{ background: 'transparent' }}
      >
        <Scene />
      </Canvas>
      {/* Top vignette so the headline reads cleanly over the scene */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(ellipse 70% 50% at 50% 28%, rgba(5,10,20,0.78) 0%, rgba(5,10,20,0.45) 45%, transparent 75%), radial-gradient(ellipse 90% 60% at 50% 100%, rgba(5,10,20,0.6) 0%, transparent 60%)',
        }}
      />
    </div>
  );
}
