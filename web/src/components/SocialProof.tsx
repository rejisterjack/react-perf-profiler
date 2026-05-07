'use client';

import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { motion } from 'framer-motion';
import { Quote, TrendingDown, TrendingUp, Zap, Clock, MemoryStick, GitCommit } from 'lucide-react';

const TESTIMONIALS = [
  {
    quote:
      "Found 89 wasted renders in our feed component in the first session. The fix recommendation was exactly right — wrapped the onLike callback with useCallback and render time dropped from 340ms to 28ms.",
    author: 'Sarah Chen',
    role: 'Senior Frontend Engineer',
    company: 'E-commerce platform, 2M+ users',
    metric: '12× faster renders',
    accentColor: 'border-brand-cyan/20 bg-brand-cyan/5',
    quoteColor: 'text-brand-cyan',
  },
  {
    quote:
      "We were spending hours in code review debating perf. Now the CI budget check just tells us: 'Wasted render rate 34% — budget 10%'. The conversation moved from opinion to data.",
    author: 'Marcus Rodriguez',
    role: 'Tech Lead',
    company: 'B2B SaaS, 15-person eng team',
    metric: 'Zero perf regressions shipped',
    accentColor: 'border-brand-purple/20 bg-brand-purple/5',
    quoteColor: 'text-brand-purple',
  },
  {
    quote:
      "The RSC analysis was the killer feature for us. Our Next.js App Router app had a ClientButton receiving 45KB of props. Moved the data fetch to the server component — payload dropped 75%.",
    author: 'Priya Nair',
    role: 'Staff Engineer',
    company: 'Fintech startup, Next.js App Router',
    metric: '75% RSC payload reduction',
    accentColor: 'border-brand-blue/20 bg-brand-blue/5',
    quoteColor: 'text-brand-blue',
  },
  {
    quote:
      "I use the AI suggestions panel to explain performance issues to junior devs on my team. Instead of me writing up an explanation, the AI reads the profile and generates the exact reasoning.",
    author: 'James O\'Brien',
    role: 'Engineering Manager',
    company: 'Product studio, 8 engineers',
    metric: 'Team up to speed 3× faster',
    accentColor: 'border-brand-green/20 bg-brand-green/5',
    quoteColor: 'text-brand-green',
  },
];

const BENCHMARKS = [
  {
    scenario: 'Feed Component (1,000 items)',
    before: { label: '340ms render', value: 340 },
    after: { label: '28ms render', value: 28 },
    improvement: '12× faster',
    fix: 'Removed inline object props breaking React.memo',
  },
  {
    scenario: 'Dashboard (500 components)',
    before: { label: '89 wasted renders/s', value: 89 },
    after: { label: '3 wasted renders/s', value: 3 },
    improvement: '97% fewer wasted renders',
    fix: 'Stabilised callbacks with useCallback + split context',
  },
  {
    scenario: 'Next.js RSC Page',
    before: { label: '245 KB payload', value: 245 },
    after: { label: '62 KB payload', value: 62 },
    improvement: '75% payload reduction',
    fix: 'Moved data fetching to server components',
  },
];

const STATS = [
  { icon: <Clock className="w-5 h-5" />, value: '<8ms', label: 'UI response time', sub: 'Panel stays at 60fps' },
  { icon: <Zap className="w-5 h-5" />, value: '15k+', label: 'Nodes/sec throughput', sub: 'Web Worker off main thread' },
  { icon: <MemoryStick className="w-5 h-5" />, value: '~45MB', label: 'Memory footprint', sub: '5k+ components, 100 commits' },
  { icon: <GitCommit className="w-5 h-5" />, value: '~200ms', label: 'Profile export', sub: 'Target was <500ms' },
];

export function SocialProof() {
  const ref = useScrollAnimation<HTMLDivElement>();

  return (
    <section id="benchmarks" ref={ref} className="py-24 lg:py-32 bg-surface-900 section-padding relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-brand-purple/5 via-surface-900 to-surface-900" />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-20">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-cyan mb-4">
            From the community
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 text-balance">
            Real results from{' '}
            <span className="gradient-text">real React apps</span>
          </h2>
          <p className="text-lg text-surface-400 text-balance">
            Developers share what they found in their first profiling session.
          </p>
        </div>

        {/* Testimonial cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-20">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className={`rounded-2xl border p-6 flex flex-col gap-4 ${t.accentColor}`}
            >
              <Quote className={`w-6 h-6 ${t.quoteColor} opacity-60`} />
              <p className="text-base text-surface-200 leading-relaxed flex-1">"{t.quote}"</p>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-white">{t.author}</div>
                  <div className="text-xs text-surface-400 mt-0.5">{t.role}</div>
                  <div className="text-xs text-surface-500">{t.company}</div>
                </div>
                <div className={`text-xs font-bold ${t.quoteColor} text-right shrink-0`}>
                  {t.metric}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Before / After benchmarks */}
        <div className="mb-16">
          <h3 className="text-xl font-bold text-white text-center mb-8">
            Real-world performance gains
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {BENCHMARKS.map((b, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.12 }}
                className="rounded-2xl border border-white/8 bg-surface-800/40 p-6 flex flex-col gap-4"
              >
                <div className="text-xs font-semibold uppercase tracking-widest text-surface-500">
                  {b.scenario}
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 rounded-xl bg-red-500/8 border border-red-500/15 p-3 text-center">
                    <div className="flex items-center justify-center gap-1 text-red-400 mb-1">
                      <TrendingDown className="w-4 h-4" />
                      <span className="text-xs font-medium">Before</span>
                    </div>
                    <div className="text-sm font-bold text-red-300">{b.before.label}</div>
                  </div>
                  <div className="text-surface-600 text-xl font-light">→</div>
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
                  <div className="text-surface-400 text-xs leading-relaxed">Fix: {b.fix}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Extension performance stats */}
        <div className="rounded-2xl border border-white/8 bg-surface-800/30 p-8">
          <div className="text-center mb-8">
            <h3 className="text-xl font-bold text-white mb-2">Extension performance benchmarks</h3>
            <p className="text-sm text-surface-500">
              Measured on a React app with 5,000+ components and 100 profile commits.
              The profiler never slows down your DevTools session.
            </p>
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
