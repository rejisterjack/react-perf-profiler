import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

const PROBLEM_ITEMS = [
  {
    icon: '🔴',
    text: 'Infinite render loops freezing the main thread',
    sub: 'Caused by unstable references in useEffect deps',
  },
  {
    icon: '🔴',
    text: 'React.memo not preventing re-renders',
    sub: 'Because props are new object/function references each time',
  },
  {
    icon: '🔴',
    text: 'Context API hammering unrelated components',
    sub: 'Over-broad context consumers re-render on any change',
  },
  {
    icon: '🔴',
    text: 'RSC payloads bloating the network response',
    sub: 'Data fetched client-side when it should live on the server',
  },
];

const SOLUTION_ITEMS = [
  {
    icon: '✅',
    text: 'Wasted render detector names the exact component',
    sub: 'And the exact prop causing the unnecessary cycle',
    feature: 'Wasted Render Detection',
  },
  {
    icon: '✅',
    text: 'Memoization scorer shows why React.memo is failing',
    sub: '23% hit rate → wrap onLike with useCallback → 94%',
    feature: 'Memoization Scorer',
  },
  {
    icon: '✅',
    text: 'Context analysis surfaces which consumers re-render',
    sub: 'And recommends splitting context or using atoms',
    feature: 'AI Suggestions Panel',
  },
  {
    icon: '✅',
    text: 'RSC analysis measures payload sizes and cache hit rates',
    sub: '245 KB → 62 KB after moving fetch to server component',
    feature: 'RSC Analysis',
  },
];

export const ProblemSolution = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  const y1 = useTransform(scrollYProgress, [0, 1], [60, -60]);
  const y2 = useTransform(scrollYProgress, [0, 1], [-60, 60]);
  const opacity = useTransform(scrollYProgress, [0, 0.15, 0.85, 1], [0, 1, 1, 0]);

  return (
    <section
      ref={containerRef}
      className="py-32 section-padding relative overflow-hidden bg-surface-900 border-y border-white/5"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-brand-purple/8 via-surface-900 to-surface-900" />

      <motion.div style={{ opacity }} className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-20">
          <h2 className="text-4xl md:text-6xl font-bold text-white mb-6 tracking-tight text-balance">
            React is fast. <br />
            <span className="text-surface-500">Until it isn't.</span>
          </h2>
          <p className="text-xl text-surface-400 max-w-2xl mx-auto">
            Unoptimized renders compound over time. Diagnosing them with raw React DevTools data is like
            finding a memory leak with <code className="text-brand-cyan text-base">console.log</code>.
          </p>
        </div>

        {/* Before / After */}
        <div className="grid md:grid-cols-2 gap-8 lg:gap-16 items-start mb-16">
          {/* Before — The Problems */}
          <motion.div style={{ y: y1 }} className="space-y-3">
            <div className="flex items-center gap-2 mb-5">
              <div className="h-px flex-1 bg-red-500/20" />
              <span className="text-xs font-bold uppercase tracking-widest text-red-400">
                Without This Tool
              </span>
              <div className="h-px flex-1 bg-red-500/20" />
            </div>
            <div className="rounded-2xl border border-red-500/15 bg-red-500/5 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-red-500/10 bg-red-500/8">
                <span className="text-xs font-mono text-red-400">DevTools Profiler</span>
                <span className="text-xs font-bold text-red-500 bg-red-500/20 px-2 py-0.5 rounded font-mono">
                  12 fps
                </span>
              </div>
              <div className="p-5 space-y-4">
                {PROBLEM_ITEMS.map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="text-sm shrink-0 mt-0.5">{item.icon}</span>
                    <div>
                      <p className="text-sm text-surface-200 font-medium">{item.text}</p>
                      <p className="text-xs text-surface-500 mt-0.5">{item.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-5 pb-4">
                <p className="text-xs text-surface-600 italic">
                  Raw data tells you what rendered. Not why. Not how to fix it.
                </p>
              </div>
            </div>
          </motion.div>

          {/* After — The Solutions */}
          <motion.div style={{ y: y2 }} className="space-y-3">
            <div className="flex items-center gap-2 mb-5">
              <div className="h-px flex-1 bg-brand-cyan/20" />
              <span className="text-xs font-bold uppercase tracking-widest text-brand-cyan">
                With React Perf Profiler
              </span>
              <div className="h-px flex-1 bg-brand-cyan/20" />
            </div>
            <div className="rounded-2xl border border-brand-cyan/15 bg-brand-cyan/5 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-brand-cyan/10 bg-brand-cyan/8">
                <span className="text-xs font-mono text-brand-cyan">⚡ Perf Profiler</span>
                <span className="text-xs font-bold text-brand-green bg-brand-green/20 px-2 py-0.5 rounded font-mono">
                  60 fps
                </span>
              </div>
              <div className="p-5 space-y-4">
                {SOLUTION_ITEMS.map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="text-sm shrink-0 mt-0.5">{item.icon}</span>
                    <div className="flex-1">
                      <p className="text-sm text-surface-200 font-medium">{item.text}</p>
                      <p className="text-xs text-brand-cyan/70 mt-0.5 font-mono">{item.sub}</p>
                      <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/8 text-surface-400">
                        {item.feature}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Bridge CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 text-center"
        >
          <p className="text-surface-400 text-base">
            Stop guessing. Start with a 60-second recording session.
          </p>
          <a
            href="#demo"
            className="inline-flex items-center gap-2 text-brand-cyan hover:text-white transition-colors text-sm font-semibold shrink-0"
          >
            See how it works
            <ArrowRight className="w-4 h-4" />
          </a>
        </motion.div>
      </motion.div>
    </section>
  );
};
