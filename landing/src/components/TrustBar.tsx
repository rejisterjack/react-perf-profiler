import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { AnimatedCounter } from './ui/AnimatedCounter';
import { Github, Star, Shield, GitBranch } from 'lucide-react';

const TRUST_ITEMS = [
  {
    icon: <Github className="w-5 h-5" />,
    value: 2400,
    suffix: '+',
    label: 'GitHub Stars',
  },
  {
    icon: <Star className="w-5 h-5" />,
    value: 1,
    prefix: 'v',
    suffix: '.0.0',
    label: 'Stable Release',
  },
  {
    icon: <Shield className="w-5 h-5" />,
    value: 75,
    suffix: '%+',
    label: 'Test Coverage',
  },
  {
    icon: <GitBranch className="w-5 h-5" />,
    value: 100,
    suffix: '%',
    label: 'Open Source',
  },
];

export function TrustBar() {
  const ref = useScrollAnimation<HTMLDivElement>();

  return (
    <section ref={ref} className="py-12 border-y border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {TRUST_ITEMS.map((item, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="p-2.5 rounded-xl bg-white/5 text-brand-react">
                {item.icon}
              </div>
              <div>
                <div className="text-xl font-bold text-white">
                  <AnimatedCounter
                    value={item.value}
                    prefix={item.prefix || ''}
                    suffix={item.suffix || ''}
                    duration={2000 + i * 300}
                  />
                </div>
                <div className="text-sm text-surface-400">{item.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
