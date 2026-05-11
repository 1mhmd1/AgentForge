import React from 'react';
import { useAuth } from './AuthContext';
import { Role, isAdmin } from './roles';

interface RoleGateProps {
  allow: Role[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

// Lightweight client-side role gate. The backend still enforces authorization
// on every /admin/* endpoint — this only hides UI surface from non-admins.
export default function RoleGate({ allow, fallback = null, children }: RoleGateProps) {
  const { user } = useAuth();
  const role = (user?.role ?? 'USER') as Role;
  const allowAdmin = allow.includes('ADMIN') || allow.includes('SUPER_ADMIN');
  const ok =
    allow.includes(role) ||
    (allowAdmin && isAdmin(user));
  return <>{ok ? children : fallback}</>;
}

export function Forbidden() {
  return (
    <div style={{ maxWidth: 520, margin: '120px auto', padding: '0 32px', textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.18em', color: '#06B6D4', marginBottom: 12 }}>403 · FORBIDDEN</div>
      <h1 style={{ fontSize: 32, fontWeight: 800, color: '#E2E8F0', margin: '0 0 12px' }}>Restricted area</h1>
      <p style={{ fontSize: 14, color: '#94A3B8', lineHeight: 1.6 }}>
        This section is only available to administrators.
      </p>
    </div>
  );
}
