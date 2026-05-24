'use client';

import { motion } from 'framer-motion';
import { fadeUp, containerVariants } from '@/lib/motion';
import { Check, X, Minus } from 'lucide-react';

type CellValue = boolean | 'partial';

const ROWS: { feature: string; builtin: CellValue; ours: CellValue; reactscan: CellValue; commercial: CellValue }[] = [
  {
    feature: 'Render count per component',
    builtin: true,
    ours: true,
    reactscan: true,
    commercial: true,
  },
  {
    feature: 'Wasted render classification',
    builtin: false,
    ours: true,
    reactscan: 'partial',
    commercial: 'partial',
  },
  {
    feature: 'Fix recommendations per component',
    builtin: false,
    ours: true,
    reactscan: false,
    commercial: false,
  },
  {
    feature: 'Memoization effectiveness score',
    builtin: false,
    ours: true,
    reactscan: false,
    commercial: false,
  },
  {
    feature: 'React Server Components analysis',
    builtin: false,
    ours: true,
    reactscan: false,
    commercial: 'partial',
  },
  {
    feature: 'Interactive flamegraph',
    builtin: true,
    ours: true,
    reactscan: false,
    commercial: true,
  },
  {
    feature: 'Time-travel commit stepping',
    builtin: true,
    ours: true,
    reactscan: false,
    commercial: false,
  },
  {
    feature: 'AI-powered optimization plans',
    builtin: false,
    ours: true,
    reactscan: false,
    commercial: false,
  },
  {
    feature: '3D component tree visualization',
    builtin: false,
    ours: true,
    reactscan: false,
    commercial: false,
  },
  {
    feature: 'CI/CD performance budget enforcement',
    builtin: false,
    ours: true,
    reactscan: false,
    commercial: 'partial',
  },
  {
    feature: 'Live team profiling sessions',
    builtin: false,
    ours: true,
    reactscan: false,
    commercial: false,
  },
  {
    feature: 'Extensible plugin system',
    builtin: false,
    ours: true,
    reactscan: false,
    commercial: false,
  },
  {
    feature: 'Works fully offline / no account',
    builtin: true,
    ours: true,
    reactscan: true,
    commercial: false,
  },
  {
    feature: 'Open source & free forever',
    builtin: true,
    ours: true,
    reactscan: true,
    commercial: false,
  },
];

function Cell({ value }: { value: boolean | 'partial' }) {
  if (value === true)
    return (
      <div className="flex justify-center">
        <Check className="w-5 h-5 text-brand-green" />
      </div>
    );
  if (value === 'partial')
    return (
      <div className="flex justify-center">
        <Minus className="w-5 h-5 text-brand-amber" />
      </div>
    );
  return (
    <div className="flex justify-center">
      <X className="w-5 h-5 text-surface-600" />
    </div>
  );
}

export const Comparison = () => {
  return (
    <section id="comparison" className="py-24 section-padding bg-surface-900 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-brand-purple/5 via-surface-900 to-surface-900" />

      <div className="max-w-5xl mx-auto relative z-10">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={containerVariants}
          className="text-center mb-16"
        >
          <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-bold text-white mb-6 text-balance">
            How we compare
          </motion.h2>
          <motion.p variants={fadeUp} className="text-lg text-surface-400 max-w-2xl mx-auto">
            React DevTools Profiler gives you raw data. We give you answers.
          </motion.p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="rounded-2xl border border-white/10 overflow-hidden"
          role="table"
          aria-label="Feature comparison table"
        >
          {/* Header */}
          <div className="grid grid-cols-5 bg-surface-800/80 border-b border-white/10" role="row">
            <div className="p-5 text-sm font-semibold text-surface-400 col-span-1" role="columnheader">Feature</div>
            <div className="p-5 text-center">
              <div className="text-sm font-semibold text-surface-300">React DevTools</div>
              <div className="text-xs text-surface-500 mt-0.5">Built-in Profiler</div>
            </div>
            <div className="p-5 text-center">
              <div className="text-sm font-semibold text-surface-300">React Scan</div>
              <div className="text-xs text-surface-500 mt-0.5">Overlay tool</div>
            </div>
            <div className="p-5 text-center bg-brand-blue/10 border-x border-brand-blue/20">
              <div className="text-sm font-bold text-brand-cyan">React Perf Profiler</div>
              <div className="text-xs text-brand-blue/70 mt-0.5">This extension · Free &amp; Open Source</div>
            </div>
            <div className="p-5 text-center">
              <div className="text-sm font-semibold text-surface-300">Commercial tools</div>
              <div className="text-xs text-surface-500 mt-0.5">Datadog, SpeedCurve, etc.</div>
            </div>
          </div>

          {/* Rows */}
          {ROWS.map((row, i) => (
            <div
              key={i}
              className={`grid grid-cols-5 border-b border-white/5 last:border-none transition-colors hover:bg-white/[0.02] ${
                i % 2 === 0 ? 'bg-surface-900/50' : 'bg-surface-800/20'
              }`}
            >
              <div className="p-4 text-sm text-surface-300 col-span-1 flex items-center">
                {row.feature}
              </div>
              <div className="p-4 flex items-center justify-center">
                <Cell value={row.builtin} />
              </div>
              <div className="p-4 flex items-center justify-center">
                <Cell value={row.reactscan} />
              </div>
              <div className="p-4 flex items-center justify-center bg-brand-blue/5 border-x border-brand-blue/10">
                <Cell value={row.ours} />
              </div>
              <div className="p-4 flex items-center justify-center">
                <Cell value={row.commercial} />
              </div>
            </div>
          ))}

          {/* Footer */}
          <div className="grid grid-cols-5 bg-surface-800/60 border-t border-white/10">
            <div className="p-5 text-sm text-surface-500 col-span-1">Price</div>
            <div className="p-5 text-center text-sm font-medium text-surface-300">Free</div>
            <div className="p-5 text-center text-sm font-medium text-surface-300">Free</div>
            <div className="p-5 text-center bg-brand-blue/10 border-x border-brand-blue/20">
              <span className="text-sm font-bold text-brand-green">Free forever</span>
            </div>
            <div className="p-5 text-center text-sm font-medium text-surface-400">$49–$500+/mo</div>
          </div>
        </motion.div>

        <div className="flex items-center gap-6 mt-6 justify-center text-xs text-surface-500">
          <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-brand-green" /> Full support</span>
          <span className="flex items-center gap-1.5"><Minus className="w-3.5 h-3.5 text-brand-amber" /> Partial / requires paid plan</span>
          <span className="flex items-center gap-1.5"><X className="w-3.5 h-3.5 text-surface-600" /> Not supported</span>
        </div>
      </div>
    </section>
  );
};
