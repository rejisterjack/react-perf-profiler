'use client';

import { useEffect, useState } from 'react';
import { DownloadButton } from './DownloadButton';
import { ComingSoonBadge } from './ComingSoonBadge';
import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const HERO_LINES = [
  { text: '$ npm install react-perf-profiler', color: 'text-surface-400' },
  { text: '✓ Profiling session started', color: 'text-brand-green' },
  { text: '⚡ Analyzing 1,247 components...', color: 'text-brand-react' },
  { text: '🔍 Found 47 wasted renders', color: 'text-brand-amber' },
  { text: '💡 Recommendation: Wrap onClick with useCallback', color: 'text-brand-blue' },
  { text: '$', color: 'text-surface-400' },
];

function TerminalAnimation() {
  const prefersReduced = useReducedMotion();
  const [visibleLines, setVisibleLines] = useState(0);
  const [currentChar, setCurrentChar] = useState(0);

  useEffect(() => {
    if (prefersReduced) {
      setVisibleLines(HERO_LINES.length);
      return;
    }

    let lineIdx = 0;
    let charIdx = 0;

    const interval = setInterval(() => {
      if (lineIdx >= HERO_LINES.length) {
        clearInterval(interval);
        return;
      }

      const line = HERO_LINES[lineIdx];
      if (charIdx <= line.text.length) {
        setVisibleLines(lineIdx);
        setCurrentChar(charIdx);
        charIdx++;
      } else {
        lineIdx++;
        charIdx = 0;
      }
    }, 40);

    return () => clearInterval(interval);
  }, [prefersReduced]);

  return (
    <div className="w-full max-w-lg mx-auto glass-card p-5 font-mono text-sm overflow-hidden">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/5">
        <div className="w-3 h-3 rounded-full bg-brand-red/80" />
        <div className="w-3 h-3 rounded-full bg-brand-amber/80" />
        <div className="w-3 h-3 rounded-full bg-brand-green/80" />
        <span className="ml-2 text-xs text-surface-500">Perf Profiler — Terminal</span>
      </div>
      <div className="space-y-1.5">
        {HERO_LINES.map((line, i) => (
          <div key={i} className={`${line.color} ${i > visibleLines ? 'opacity-0' : 'opacity-100'} transition-opacity`}>
            {i === visibleLines && !prefersReduced
              ? line.text.slice(0, currentChar)
              : line.text}
            {i === visibleLines && !prefersReduced && (
              <span className="inline-block w-2 h-4 bg-brand-react ml-0.5 animate-terminal-cursor" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center pt-20 pb-16 overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-blue/10 rounded-full blur-[120px] animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-brand-react/10 rounded-full blur-[100px] animate-float animation-delay-300" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-blue/5 rounded-full blur-[150px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="text-center max-w-4xl mx-auto">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-surface-300 mb-8"
          >
            <span className="w-2 h-2 rounded-full bg-brand-green animate-pulse" />
            Open Source — MIT Licensed
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6 text-balance"
          >
            Stop Guessing.{' '}
            <span className="gradient-text">Start Profiling.</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="text-lg sm:text-xl text-surface-300 max-w-2xl mx-auto mb-10 text-balance leading-relaxed"
          >
            The React performance profiler that finds your wasted renders, analyzes your
            memoization strategy, and tells you exactly what to fix — before your users notice.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6"
          >
            <DownloadButton browser="chrome" />
            <DownloadButton browser="firefox" variant="secondary" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="mb-10"
          >
            <ComingSoonBadge />
          </motion.div>

          {/* Terminal Demo */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="mb-12"
          >
            <TerminalAnimation />
          </motion.div>

          {/* Floating Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.7 }}
            className="flex flex-wrap items-center justify-center gap-6 text-sm text-surface-400"
          >
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-blue" />
              <span>15k+ nodes/sec</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-green" />
              <span>60fps UI</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-react" />
              <span>Zero runtime overhead</span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
