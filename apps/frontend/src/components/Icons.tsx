import React from 'react';

const ico = { width: '1em' as const, height: '1em' as const, viewBox: '0 0 24 24', fill: 'none' as const, stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export const HexIcon = ({ size = 18, gradient = true }: { size?: number; gradient?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <defs>
      <linearGradient id={`hexg-${size}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#7C3AED" />
        <stop offset="50%" stopColor="#3B82F6" />
        <stop offset="100%" stopColor="#06B6D4" />
      </linearGradient>
    </defs>
    <path d="M12 2 L21 7 L21 17 L12 22 L3 17 L3 7 Z" fill={gradient ? `url(#hexg-${size})` : 'currentColor'} />
  </svg>
);

export const SearchIcon = (p: React.SVGProps<SVGSVGElement>) => (<svg {...ico} {...p}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>);
export const GlobeIcon = (p: React.SVGProps<SVGSVGElement>) => (<svg {...ico} {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>);
export const TransformIcon = (p: React.SVGProps<SVGSVGElement>) => (<svg {...ico} {...p}><path d="M3 7h13l-3-3M21 17H8l3 3" /></svg>);
export const DocIcon = (p: React.SVGProps<SVGSVGElement>) => (<svg {...ico} {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></svg>);
export const LayoutIcon = (p: React.SVGProps<SVGSVGElement>) => (<svg {...ico} {...p}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></svg>);
export const PlayIcon = (p: React.SVGProps<SVGSVGElement>) => (<svg {...ico} {...p}><polygon points="6 4 20 12 6 20 6 4" /></svg>);
export const ArrowRightIcon = (p: React.SVGProps<SVGSVGElement>) => (<svg {...ico} {...p}><path d="M5 12h14M13 5l7 7-7 7" /></svg>);
export const CheckIcon = (p: React.SVGProps<SVGSVGElement>) => (<svg {...ico} {...p}><polyline points="20 6 9 17 4 12" /></svg>);
export const XIcon = (p: React.SVGProps<SVGSVGElement>) => (<svg {...ico} {...p}><path d="M18 6L6 18M6 6l12 12" /></svg>);
export const CopyIcon = (p: React.SVGProps<SVGSVGElement>) => (<svg {...ico} {...p}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>);
export const ChevronDownIcon = (p: React.SVGProps<SVGSVGElement>) => (<svg {...ico} {...p}><polyline points="6 9 12 15 18 9" /></svg>);
export const SparkleIcon = (p: React.SVGProps<SVGSVGElement>) => (<svg {...ico} {...p}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" /></svg>);
export const SettingsIcon = (p: React.SVGProps<SVGSVGElement>) => (<svg {...ico} {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>);
export const ZapIcon = (p: React.SVGProps<SVGSVGElement>) => (<svg {...ico} {...p}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>);
export const EyeIcon = (p: React.SVGProps<SVGSVGElement>) => (<svg {...ico} {...p}><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" /><circle cx="12" cy="12" r="3" /></svg>);
export const EyeOffIcon = (p: React.SVGProps<SVGSVGElement>) => (<svg {...ico} {...p}><path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a19.78 19.78 0 0 1 4.22-5.06M9.9 4.24A10.95 10.95 0 0 1 12 4c7 0 11 7 11 7a19.84 19.84 0 0 1-3.16 4.19" /><path d="M14.12 14.12a3 3 0 0 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>);

export const RunsIcon = (p: React.SVGProps<SVGSVGElement>) => (<svg {...ico} {...p}><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></svg>);
export const AgentsIcon = (p: React.SVGProps<SVGSVGElement>) => (<svg {...ico} {...p}><rect x="3" y="3" width="18" height="18" rx="2" /><rect x="9" y="9" width="6" height="6" /><line x1="9" y1="1" x2="9" y2="3" /><line x1="15" y1="1" x2="15" y2="3" /><line x1="9" y1="21" x2="9" y2="23" /><line x1="15" y1="21" x2="15" y2="23" /><line x1="1" y1="9" x2="3" y2="9" /><line x1="1" y1="15" x2="3" y2="15" /><line x1="21" y1="9" x2="23" y2="9" /><line x1="21" y1="15" x2="23" y2="15" /></svg>);
export const PricingIcon = (p: React.SVGProps<SVGSVGElement>) => (<svg {...ico} {...p}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" strokeWidth={2.5} /></svg>);
export const UserCircleIcon = (p: React.SVGProps<SVGSVGElement>) => (<svg {...ico} {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="10" r="3" /><path d="M6.168 18.849A4 4 0 0 1 10 16h4a4 4 0 0 1 3.832 2.849" /></svg>);
export const ShieldIcon = (p: React.SVGProps<SVGSVGElement>) => (<svg {...ico} {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>);

export const SpinnerIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ animation: 'spin-conic 0.8s linear infinite' }}>
    <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.25)" strokeWidth="2" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="white" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
