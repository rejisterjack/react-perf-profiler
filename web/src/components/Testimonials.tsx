'use client';

import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { motion } from 'framer-motion';
import { TrendingDown, TrendingUp, Zap, Clock, MemoryStick, GitCommit } from 'lucide-react';

const BENCHMARKS = [
  {
    scenario: 'Feed Component (1,000 items)',
    before: { label: '340ms render', value: 340, bad: true },
    after: { label: '28ms render', value: 28, bad: false },
    improvement: '12× faster',
    fix: 'Removed inline object props breaking React.memo',
    color: 'brand-cyan',
  },
  {
    scenario: 'Dashboard (500 components)',
    before: { label: '89 wasted renders/s', value: 89, bad: true },
    after: { label: '3 wasted renders/s', value: 3, bad: false },
    improvement: '97% fewer wasted renders',
    fix: 'Stabilised callbacks with useCallback + split context',
    color: 'brand-purple',
  },
  {
    scenario: 'Next.js RSC Page',
    before: { label: '245 KB payload', value: 245, bad: true },
    after: { label: '62 KB payload', value: 62, bad: false },
    improvement: '75% payload reduction',
    fix: 'Moved data fetching to server components',
    color: 'brand-blue',
  },
];

const STATS = [
  { icon: <Clock className="w-5 h-5" />, value: '<8ms', label: 'UI response time', sub: 'Panel stays responsive at 60fps' },
  { icon: <Zap className="w-5 h-5" />, value: '15k+', label: 'Nodes/sec throughput', sub: 'Web Worker analysis off main thread' },
  { icon: <MemoryStick className="w-5 h-5" />, value: '~45MB', label: 'Memory footprint', sub: 'For 100 commits, 5k+ components' },
  { icon: <GitCommit className="w-5 h-5" />, value: '~200ms', label: 'Export (100 commits)', sub: 'Target was <500ms' },
];

export function Testimonials() {
  const ref = useScrollAnimation<HTMLDivElement>();

  return (
    <section id="benchmarks" ref={ref} className="py-24 lg:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 text-balance">
            Real-world <span className="gradient-text">performance gains</span>
          </h2>
          <p className="text-lg text-surface-400 text-balance">
            Measured on benchmark React apps using the profiler's own analysis engine.
            These are reproducible results, not marketing estimates.
          </p>
        </div>

        {/* Benchmark cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-16">
          {BENCHMARKS.map((b, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.12 }}
              className="rounded-2xl border border-white/8 bg-surface-800/40 p-6 flex flex-col gap-5"
            >
              <div className="text-xs font-semibold uppercase tracking-widest text-surface-500">
                {b.scenario}
              </div>

              <div className="flex items-center justify-between gap-4">
                {/* Before */}
                <div className="flex-1 rounded-xl bg-red-500/8 border border-red-500/15 p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-red-400 mb-1">
                    <TrendingDown className="w-4 h-4" />
                    <span className="text-xs font-medium">Before</span>
                  </div>
                  <div className="text-sm font-bold text-red-300">{b.before.label}</div>
                </div>

                <div className="text-surface-600 text-xl font-light">→</div>

                {/* After */}
                <div className="flex-1 rounded-xl bg-brand-cyan/8 border border-brand-cyan/15 p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-brand-cyan mb-1">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-xs font-medium">After</span>
                  </div>
                  <div className="text-sm font-bold text-brand-cyan">{b.after.label}</div>
                </div>
              </div>

              <div className="rounded-lg bg-white/3 border border-white/5 px-4 py-3">
                <div className="text-brand-green font-bold text-sm mb-1">{b.improvement}</div>
                <div className="text-surface-400 text-xs leading-relaxed">
                  Fix: {b.fix}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Internal benchmarks */}
        <div className="rounded-2xl border border-white/8 bg-surface-800/30 p-8">
          <div className="text-center mb-8">
            <h3 className="text-xl font-bold text-white mb-2">Extension performance benchmarks</h3>
            <p className="text-sm text-surface-500">Measured on a React app with 5,000+ components and 100 profile commits</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {STATS.map((s, i) => (
              <div key={i} className="text-center">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/5 text-brand-react mb-3">
                  {s.icon}
                </div>
                <div className="text-2xl font-bold text-white mb-1">{s.value}</div>
                <div className="text-sm font-medium text-surface-300 mb-0.5">{s.label}</div>
                <div className="text-xs text-surface-500">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
