import React from 'react';

export default function Settings() {
  return (
    <div data-responsive-root style={{ maxWidth: 720, margin: '0 auto', padding: '60px 32px 80px', position: 'relative', zIndex: 1, fontFamily: 'Inter, sans-serif' }}>
      <h2 style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em', color: '#E2E8F0', margin: '0 0 8px' }}>Settings</h2>
      <p style={{ fontSize: 15, color: '#94A3B8', margin: '0 0 32px' }}>Workspace and account preferences.</p>
      <div style={{ background: 'rgba(13,20,36,0.7)', backdropFilter: 'blur(16px)', border: '1px solid rgba(26,39,64,0.6)', borderRadius: 16, padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Row label="Workspace" value="Acme Inc." />
        <Row label="API Endpoint" value="api.agentforge.dev/v2" mono />
        <Row label="Default Agent" value="Web Research" />
        <Row label="Theme" value="Dark (always)" muted />
        <Row label="Telemetry" value="Enabled" />
      </div>
      <p style={{ fontSize: 12, color: '#475569', marginTop: 24, fontFamily: 'JetBrains Mono, monospace' }}>◈ Settings page is a placeholder in this UI kit.</p>
    </div>
  );
}

function Row({ label, value, mono, muted }: { label: string; value: string; mono?: boolean; muted?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 16, borderBottom: '1px solid rgba(26,39,64,0.4)' }}>
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#475569' }}>{label}</span>
      <span style={{ fontSize: 14, color: muted ? '#475569' : '#E2E8F0', fontFamily: mono ? 'JetBrains Mono, monospace' : 'Inter, sans-serif' }}>{value}</span>
    </div>
  );
}
