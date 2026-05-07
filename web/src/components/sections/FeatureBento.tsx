'use client';

import { motion } from 'framer-motion';
import { containerVariants, fadeUp } from '@/lib/motion';
import { ShieldAlert, Zap, Database, BarChart3, GitCompare, Cpu, Check, X, ArrowRight } from 'lucide-react';

/* ─── Mini UI mockups for each feature card ─── */

const WastedRenderMockup = () => (
  <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-surface-900/60 border border-white/5 text-[10px] font-mono">
    {[
      { name: 'Feed', renders: 45, wasted: 0, ok: true },
      { name: 'PostList', renders: 45, wasted: 0, ok: true },
      { name: 'Post', renders: 120, wasted: 89, ok: false },
      { name: 'Actions', renders: 120, wasted: 120, ok: false },
      { name: 'LikeButton', renders: 120, wasted: 120, ok: false },
    ].map((row, i) => (
      <div key={i} className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {row.ok ? (
            <Check className="w-3 h-3 text-brand-green shrink-0" />
          ) : (
            <ShieldAlert className="w-3 h-3 text-red-400 shrink-0" />
          )}
          <span className={row.ok ? 'text-surface-400' : 'text-red-300'}>{row.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-surface-500">{row.renders}r</span>
          {!row.ok && (
            <span className="text-red-400 font-bold">{row.wasted}w ⚠</span>
          )}
        </div>
      </div>
    ))}
    <div className="mt-1 pt-1.5 border-t border-white/5 text-brand-cyan">
      ↳ Fix: wrap onLike with useCallback
    </div>
  </div>
);

const MemoScoreMockup = () => (
  <div className="p-3 rounded-xl bg-surface-900/60 border border-white/5 text-[10px] font-mono space-y-2">
    <div className="flex justify-between text-surface-400">
      <span>PostActions</span>
      <span className="text-red-400 font-bold">23% hit rate ⚠</span>
    </div>
    <div className="w-full h-1.5 bg-surface-700 rounded-full">
      <div className="h-full bg-red-500 rounded-full" style={{ width: '23%' }} />
    </div>
    <div className="space-y-1 text-surface-500">
      <div className="flex items-center gap-1"><X className="w-2.5 h-2.5 text-red-400" /> onLike recreated each render</div>
      <div className="flex items-center gap-1"><X className="w-2.5 h-2.5 text-red-400" /> style object recreated each render</div>
    </div>
    <div className="text-brand-green">Expected after fix: 94% hit rate ✓</div>
  </div>
);

const CICDMockup = () => (
  <div className="p-3 rounded-xl bg-surface-900/60 border border-white/5 text-[10px] font-mono space-y-1.5">
    <div className="text-surface-500">perf-budget.json</div>
    <div className="space-y-1 text-brand-cyan">
      <div>&#123;</div>
      <div className="ml-3"><span className="text-brand-purple">"wastedRenderThreshold"</span>: <span className="text-brand-green">0.1</span>,</div>
      <div className="ml-3"><span className="text-brand-purple">"memoHitRateThreshold"</span>: <span className="text-brand-green">0.8</span>,</div>
      <div className="ml-3"><span className="text-brand-purple">"maxRenderTimeMs"</span>: <span className="text-brand-green">16</span></div>
      <div>&#125;</div>
    </div>
    <div className="mt-1.5 pt-1.5 border-t border-white/5 flex items-center gap-1.5">
      <div className="w-2 h-2 rounded-full bg-brand-green animate-pulse" />
      <span className="text-brand-green">CI: All budgets passed ✓</span>
    </div>
  </div>
);

const FlamegraphMockup = () => (
  <div className="p-3 rounded-xl bg-surface-900/60 border border-white/5 space-y-1.5">
    {[
      { name: 'App', ms: 45, width: '100%', color: 'bg-brand-cyan/30 border-brand-cyan/40', text: 'text-brand-cyan' },
      { name: 'Feed', ms: 32, width: '85%', color: 'bg-brand-blue/30 border-brand-blue/40', text: 'text-brand-blue' },
      { name: 'Post ⚠', ms: 28, width: '72%', color: 'bg-red-500/30 border-red-500/40', text: 'text-red-300' },
      { name: 'Actions ⚠', ms: 18, width: '55%', color: 'bg-red-500/50 border-red-500/60', text: 'text-red-200' },
    ].map((bar, i) => (
      <div
        key={i}
        className={`h-5 rounded border flex items-center px-2 text-[9px] font-mono ${bar.color} ${bar.text}`}
        style={{ width: bar.width, marginLeft: `${i * 8}px` }}
      >
        {bar.name} — {bar.ms}ms
      </div>
    ))}
  </div>
);

const ExportMockup = () => (
  <div className="p-3 rounded-xl bg-surface-900/60 border border-white/5 text-[10px] font-mono space-y-2">
    <div className="text-surface-500">profile-2024-01-15.json</div>
    <div className="flex gap-2">
      {['S3', 'Dropbox', 'Drive'].map((s) => (
        <div key={s} className="px-2 py-0.5 rounded bg-brand-blue/15 border border-brand-blue/20 text-brand-blue text-[9px]">
          {s}
        </div>
      ))}
    </div>
    <div className="text-surface-400">
      <span className="text-brand-green">↑ Uploaded</span> profile to S3
    </div>
    <div className="flex items-center gap-1.5 text-brand-cyan">
      <ArrowRight className="w-3 h-3" />
      Share link copied to clipboard
    </div>
  </div>
);

const PluginMockup = () => (
  <div className="p-3 rounded-xl bg-surface-900/60 border border-white/5 text-[10px] font-mono space-y-1.5">
    <div className="text-surface-500">Plugin Registry</div>
    {[
      { name: 'next-bundle-analyzer', badge: 'Official', color: 'text-brand-cyan' },
      { name: 'zustand-store-tracker', badge: 'Community', color: 'text-brand-purple' },
      { name: 'a11y-render-audit', badge: 'Community', color: 'text-brand-purple' },
    ].map((p, i) => (
      <div key={i} className="flex items-center justify-between">
        <span className="text-surface-300">{p.name}</span>
        <span className={`text-[9px] ${p.color}`}>{p.badge}</span>
      </div>
    ))}
  </div>
);

const features = [
  {
    title: 'Wasted Render Detection',
    description:
      'Classify every re-render as wasted or necessary. Get the exact prop that triggered the cycle, plus the specific code fix.',
    mockup: <WastedRenderMockup />,
    icon: <ShieldAlert className="w-5 h-5 text-red-400" />,
    span: 'md:col-span-2',
  },
  {
    title: 'Memoization Scorer',
    description:
      'Proprietary algorithm scores React.memo, useMemo, and useCallback effectiveness. Pinpoints why your memoization fails.',
    mockup: <MemoScoreMockup />,
    icon: <Zap className="w-5 h-5 text-brand-purple" />,
    span: '',
  },
  {
    title: 'CI/CD Perf Budgets',
    description:
      'Define thresholds in perf-budget.json and automatically fail builds that exceed render time or wasted render budgets.',
    mockup: <CICDMockup />,
    icon: <Database className="w-5 h-5 text-brand-green" />,
    span: '',
  },
  {
    title: 'Interactive Flamegraph',
    description:
      'Visualize the entire render hierarchy with millisecond precision. Color-coded by duration, filterable by component name.',
    mockup: <FlamegraphMockup />,
    icon: <BarChart3 className="w-5 h-5 text-brand-cyan" />,
    span: 'md:col-span-2',
  },
  {
    title: 'Cloud Export & Sync',
    description:
      'Export profiles to S3, Dropbox, or Google Drive. Share with teammates via a link — no screen sharing required.',
    mockup: <ExportMockup />,
    icon: <GitCompare className="w-5 h-5 text-brand-blue" />,
    span: '',
  },
  {
    title: 'Extensible Plugin System',
    description:
      'Build custom analysis plugins or install community ones. Add domain-specific metrics to the core analysis engine.',
    mockup: <PluginMockup />,
    icon: <Cpu className="w-5 h-5 text-surface-400" />,
    span: '',
  },
];

export const FeatureBento = () => {
  return (
    <section id="features" className="py-24 section-padding bg-surface-900 relative">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={containerVariants}
          className="mb-16 text-center"
        >
          <motion.p variants={fadeUp} className="text-xs font-semibold uppercase tracking-widest text-brand-cyan mb-4">
            Core capabilities
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-bold text-white mb-6">
            Everything you need to ship{' '}
            <span className="gradient-text">faster</span>.
          </motion.h2>
          <motion.p variants={fadeUp} className="text-xl text-surface-400 max-w-2xl mx-auto">
            Deep dive into your application's render behavior with surgical precision.
            Identify bottlenecks, score memoization, and enforce budgets in CI.
          </motion.p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {features.map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className={`${feature.span} rounded-2xl border border-white/8 bg-surface-800/40 p-6 hover:border-white/15 hover:bg-surface-800/60 transition-all duration-300 group`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-white/5 group-hover:bg-white/8 transition-colors">
                  {feature.icon}
                </div>
                <h3 className="text-base font-bold text-white">{feature.title}</h3>
              </div>
              <p className="text-sm text-surface-400 leading-relaxed mb-4">{feature.description}</p>
              {feature.mockup}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
