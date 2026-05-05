import React, { useState } from 'react';
import { CheckIcon } from '../components/Icons';

const plans = [
  { name: 'Free', price: '$0', runs: '100', tagline: 'For exploring what AgentForge can do.', features: ['Basic agents (Web Research, Data Transform)', 'Standard execution speed', 'Community support', '7-day run history'], cta: 'Start Free', accent: '#3B82F6' },
  { name: 'Pro', price: '$29', runs: '1,000', tagline: 'For builders shipping real automations.', features: ['All 4 production agents', '4× faster execution', 'Priority support', 'API access', '90-day run history', 'Custom agent presets'], cta: 'Upgrade to Pro', accent: '#7C3AED', recommended: true },
  { name: 'Pro Max', price: '$99', runs: 'Unlimited', tagline: 'For teams running mission-critical workflows.', features: ['Everything in Pro', 'Unlimited concurrent runs', 'Custom agent development', 'Dedicated Slack channel', '99.9% SLA', 'SSO + audit logs'], cta: 'Contact Sales', accent: '#06B6D4' },
];

export default function Pricing() {
  return (
    <div style={s.root}>
      <div style={s.heading}>
        <div style={{ ...s.eyebrow, animation: 'fadeUp 600ms var(--ease-spring) both' }}>PRICING</div>
        <h1 style={{ ...s.title, animation: 'fadeUp 700ms var(--ease-spring) 100ms both' }}>
          Choose your <span style={s.gradientWord}>plan</span>
        </h1>
        <p style={{ ...s.subtitle, animation: 'fadeUp 600ms var(--ease-spring) 200ms both' }}>
          Start free. Upgrade when your agents start earning their keep.
        </p>
      </div>
      <div style={s.grid}>
        {plans.map((p, i) => <PricingCard key={p.name} plan={p} index={i} />)}
      </div>
      <div style={s.footnote}>
        <span>All plans include unlimited team members</span>
        <span style={{ color: '#243B5E' }}>·</span>
        <span>Cancel anytime</span>
        <span style={{ color: '#243B5E' }}>·</span>
        <span>Volume discounts available</span>
      </div>
    </div>
  );
}

function PricingCard({ plan, index }: { plan: typeof plans[0]; index: number }) {
  const [hover, setHover] = useState(false);
  const isPro = (plan as any).recommended;
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{ position: 'relative', width: 320, padding: '40px 32px 32px', borderRadius: 20, background: isPro ? 'linear-gradient(155deg, rgba(124,58,237,0.12), rgba(59,130,246,0.06))' : 'rgba(13,20,36,0.7)', backdropFilter: 'blur(20px)', border: `${isPro ? 2 : 1}px solid ${isPro ? '#7C3AED' : hover ? plan.accent + '88' : 'rgba(26,39,64,0.6)'}`, boxShadow: hover ? isPro ? '0 0 60px rgba(124,58,237,0.45), 0 30px 60px rgba(0,0,0,0.6)' : `0 0 40px ${plan.accent}55, 0 20px 40px rgba(0,0,0,0.5)` : isPro ? '0 0 30px rgba(124,58,237,0.25), 0 20px 40px rgba(0,0,0,0.5)' : '0 10px 30px rgba(0,0,0,0.3)', transform: hover ? 'translateY(-6px) scale(1.01)' : 'translateY(0) scale(1)', transition: 'all 300ms cubic-bezier(0.34, 1.56, 0.64, 1)', animation: `cardEntry 700ms var(--ease-spring) ${150 + index * 100}ms both` }}>
      {isPro && (
        <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 16px', borderRadius: 100, background: 'linear-gradient(135deg, #7C3AED, #3B82F6)', color: 'white', fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', fontFamily: 'Inter, sans-serif', boxShadow: '0 0 24px rgba(124,58,237,0.6)' }}>
          <span>★</span><span>RECOMMENDED</span>
        </div>
      )}
      <h2 style={{ fontSize: 24, fontWeight: 700, color: '#E2E8F0', margin: '0 0 8px', textAlign: 'left', fontFamily: 'Inter, sans-serif' }}>{plan.name}</h2>
      <p style={{ fontSize: 13, color: '#94A3B8', textAlign: 'left', margin: '0 0 24px', lineHeight: 1.5 }}>{plan.tagline}</p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 48, fontWeight: 800, letterSpacing: '-0.03em', fontFamily: 'Inter, sans-serif', color: isPro ? '#A78BFA' : '#E2E8F0' }}>{plan.price}</span>
        <span style={{ fontSize: 14, color: '#94A3B8', fontWeight: 500 }}>/month</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 24 }}>
        <span style={{ fontSize: 14, color: '#67E8F9', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>{plan.runs}</span>
        <span style={{ fontSize: 12, color: '#475569' }}>runs / month</span>
      </div>
      <div style={{ height: 1, background: 'rgba(26,39,64,0.6)', marginBottom: 20 }} />
      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', textAlign: 'left' }}>
        {plan.features.map((f, fi) => (
          <li key={fi} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12, fontSize: 13, color: '#94A3B8', lineHeight: 1.5, animation: `fadeUp 400ms ease ${fi * 60}ms both` }}>
            <span style={{ flex: '0 0 18px', width: 18, height: 18, borderRadius: '50%', background: 'rgba(13,20,36,0.9)', border: `1px solid ${plan.accent}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: plan.accent, boxShadow: `0 0 8px ${plan.accent}88`, marginTop: 1 }}>
              <CheckIcon style={{ width: 10, height: 10 }} />
            </span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <button style={{ width: '100%', padding: '14px 16px', borderRadius: 10, cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 14, color: 'white', background: isPro ? 'linear-gradient(135deg, #7C3AED, #3B82F6)' : `linear-gradient(135deg, ${plan.accent}33, ${plan.accent}11)`, border: isPro ? 'none' : `1px solid ${plan.accent}66`, boxShadow: hover && isPro ? '0 0 40px rgba(124,58,237,0.6)' : isPro ? '0 0 20px rgba(124,58,237,0.35)' : 'none', transform: hover ? 'scale(1.02)' : 'scale(1)', transition: 'all 200ms cubic-bezier(0.34, 1.56, 0.64, 1)' }}>{plan.cta}</button>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: { maxWidth: 1180, margin: '0 auto', padding: '80px 32px 100px', position: 'relative', zIndex: 1, textAlign: 'center' },
  heading: { marginBottom: 72 },
  eyebrow: { display: 'inline-block', fontSize: 11, fontWeight: 600, letterSpacing: '0.18em', color: '#A78BFA', border: '1px solid rgba(124,58,237,0.3)', background: 'rgba(124,58,237,0.08)', borderRadius: 100, padding: '6px 16px', marginBottom: 20 },
  title: { fontSize: 56, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.05, color: '#E2E8F0', margin: '0 0 16px' },
  gradientWord: { background: 'linear-gradient(135deg, #7C3AED, #3B82F6, #06B6D4)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  subtitle: { fontSize: 17, color: '#94A3B8', maxWidth: 480, margin: '0 auto', lineHeight: 1.55 },
  grid: { display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'flex-start' },
  footnote: { marginTop: 64, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, fontSize: 12, color: '#475569', flexWrap: 'wrap' },
};
