import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { Shield, GitBranch, CheckCircle, Lock } from 'lucide-react';

const TRUST_ITEMS = [
  {
    icon: <CheckCircle className="w-5 h-5" />,
    stat: '305+',
    label: 'Unit Tests',
    sublabel: 'Vitest + React Testing Library',
  },
  {
    icon: <Shield className="w-5 h-5" />,
    stat: '≥75%',
    label: 'Test Coverage',
    sublabel: 'Enforced in CI on every PR',
  },
  {
    icon: <GitBranch className="w-5 h-5" />,
    stat: 'MV3 + MV2',
    label: 'Browser Support',
    sublabel: 'Chrome & Firefox builds',
  },
  {
    icon: <Lock className="w-5 h-5" />,
    stat: 'MIT',
    label: 'Open Source',
    sublabel: 'Free forever, no account needed',
  },
];

export function TrustBar() {
  const ref = useScrollAnimation<HTMLDivElement>();

  return (
    <section ref={ref} className="py-12 border-y border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {TRUST_ITEMS.map((item, i) => (
            <div key={i} className="flex items-start gap-4">
              <div className="p-2.5 rounded-xl bg-white/5 text-brand-react shrink-0">
                {item.icon}
              </div>
              <div>
                <div className="text-xl font-bold text-white">{item.stat}</div>
                <div className="text-sm font-medium text-surface-300">{item.label}</div>
                <div className="text-xs text-surface-500 mt-0.5">{item.sublabel}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
