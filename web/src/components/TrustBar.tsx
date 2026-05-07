'use client';

import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { Shield, GitBranch, CheckCircle, Lock, Star, Download } from 'lucide-react';

const TRUST_ITEMS = [
  {
    icon: <Star className="w-5 h-5" />,
    stat: 'Open Source',
    label: 'MIT Licensed',
    sublabel: 'Free forever — audit the code yourself',
  },
  {
    icon: <Shield className="w-5 h-5" />,
    stat: '≥75%',
    label: 'Test Coverage',
    sublabel: '305+ unit tests enforced in CI',
  },
  {
    icon: <GitBranch className="w-5 h-5" />,
    stat: 'Chrome + Firefox',
    label: 'Both Browsers',
    sublabel: 'MV3 (Chrome) and MV2 (Firefox) builds',
  },
  {
    icon: <Lock className="w-5 h-5" />,
    stat: '100% Local',
    label: 'Privacy First',
    sublabel: 'All data stays on your machine by default',
  },
  {
    icon: <CheckCircle className="w-5 h-5" />,
    stat: 'React 16.5+',
    label: 'Wide Compatibility',
    sublabel: 'Works with Next.js, Vite, Remix & more',
  },
  {
    icon: <Download className="w-5 h-5" />,
    stat: 'Zero Setup',
    label: 'No Account Needed',
    sublabel: 'Install in under 60 seconds',
  },
];

export function TrustBar() {
  const ref = useScrollAnimation<HTMLDivElement>();

  return (
    <section ref={ref} className="py-12 border-y border-white/5 bg-surface-900/60 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-surface-500 mb-8">
          Built for professional React teams
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 lg:gap-8">
          {TRUST_ITEMS.map((item, i) => (
            <div key={i} className="flex flex-col items-start gap-2 group">
              <div className="p-2 rounded-lg bg-white/5 text-brand-react group-hover:bg-brand-react/10 transition-colors shrink-0">
                {item.icon}
              </div>
              <div>
                <div className="text-base font-bold text-white leading-none mb-0.5">{item.stat}</div>
                <div className="text-xs font-medium text-surface-300">{item.label}</div>
                <div className="text-xs text-surface-500 mt-0.5 leading-snug">{item.sublabel}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
