import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

export const ProblemSolution = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  const y1 = useTransform(scrollYProgress, [0, 1], [100, -100]);
  const y2 = useTransform(scrollYProgress, [0, 1], [-100, 100]);
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);

  return (
    <section ref={containerRef} className="py-32 section-padding relative overflow-hidden bg-surface-900 border-y border-white/5">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-brand-purple/10 via-surface-900 to-surface-900" />
      
      <motion.div style={{ opacity }} className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-24">
          <h2 className="text-4xl md:text-6xl font-bold text-white mb-6 tracking-tight text-balance">
            React is fast. <br />
            <span className="text-surface-500">Until it isn't.</span>
          </h2>
          <p className="text-xl text-surface-400 max-w-2xl mx-auto">
            Unoptimized renders compound over time, turning a snappy UX into a sluggish nightmare.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-12 lg:gap-24 items-center">
          {/* Before */}
          <motion.div style={{ y: y1 }} className="space-y-6">
            <div className="glass-card p-6 border-red-500/20 bg-red-500/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-red-500/20 text-red-400 text-xs px-3 py-1 rounded-bl-lg font-mono">
                12 fps
              </div>
              <h3 className="text-xl font-semibold text-white mb-4">The Nightmare</h3>
              <ul className="space-y-4 text-surface-300">
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  Infinite render loops freezing the main thread
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  Context API spamming unnecessary updates
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  Silent memory leaks crashing mobile browsers
                </li>
              </ul>
            </div>
          </motion.div>

          {/* After */}
          <motion.div style={{ y: y2 }} className="space-y-6">
            <div className="glass-card p-6 border-brand-cyan/20 bg-brand-cyan/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-brand-cyan/20 text-brand-cyan text-xs px-3 py-1 rounded-bl-lg font-mono">
                60 fps
              </div>
              <h3 className="text-xl font-semibold text-white mb-4">The Solution</h3>
              <ul className="space-y-4 text-surface-300">
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-brand-cyan" />
                  Surgical state updates with fine-grained reactivity
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-brand-cyan" />
                  Memoization strategies that actually work
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-brand-cyan" />
                  Rock-solid stability across all devices
                </li>
              </ul>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
};
