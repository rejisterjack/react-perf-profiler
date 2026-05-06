import { motion } from 'framer-motion';
import { fadeUp, containerVariants } from '../lib/motion';
import {
  Brain,
  Users,
  Cloud,
  Box,
  Puzzle,
  ShieldAlert,
  Zap,
  BarChart3,
  Database,
  Cpu,
  GitCompare,
  Clock,
} from 'lucide-react';

const FEATURE_GROUPS = [
  {
    category: 'Analysis Engine',
    accent: 'brand-cyan',
    features: [
      {
        icon: ShieldAlert,
        title: 'Wasted Render Detection',
        description:
          'Classify every re-render as wasted or necessary. Get the exact prop or state key that triggered the cycle, plus a specific fix recommendation.',
        badge: 'Core',
      },
      {
        icon: Zap,
        title: 'Memoization Scorer',
        description:
          'Proprietary algorithm scores React.memo, useMemo, and useCallback effectiveness. Pinpoints unstable prop references that silently break memoization.',
        badge: 'Core',
      },
      {
        icon: BarChart3,
        title: 'Interactive Flamegraph',
        description:
          'Zoom, pan, and filter a full render-hierarchy flamegraph with millisecond precision. Color-coded by duration, filterable by component name.',
        badge: 'Core',
      },
      {
        icon: Clock,
        title: 'Time-Travel Debugging',
        description:
          'Step backward and forward through every React commit to understand how state evolved. Identify the exact action that triggered the cascade.',
        badge: 'Core',
      },
    ],
  },
  {
    category: 'AI & Smart Insights',
    accent: 'brand-purple',
    features: [
      {
        icon: Brain,
        title: 'AI Suggestions Panel',
        description:
          'Connect OpenAI, Anthropic, or local Ollama. The AI reads your profile data and generates component-level optimization plans — no copy-pasting code into ChatGPT.',
        badge: 'New',
        highlight: true,
      },
      {
        icon: Cpu,
        title: 'ML Render Prediction',
        description:
          'TensorFlow.js model (loaded on demand) predicts which components are likely to regress as your app grows. Catch bottlenecks before they happen.',
        badge: 'Beta',
      },
    ],
  },
  {
    category: 'Team & Collaboration',
    accent: 'brand-blue',
    features: [
      {
        icon: Users,
        title: 'Live Team Sessions',
        description:
          'Share a live profiling session with your team over WebRTC. Debug performance issues together in real-time — no screen sharing required.',
        badge: 'New',
        highlight: true,
      },
      {
        icon: Cloud,
        title: 'Cloud Sync',
        description:
          'Export profiles to S3, Dropbox, or Google Drive (OAuth PKCE). Import on any machine or browser. Perfect for async cross-team performance reviews.',
        badge: 'New',
      },
      {
        icon: Database,
        title: 'Export / Import Sessions',
        description:
          'Save any profiling session as JSON and load it back on another machine or a later date. Share profiles via email, Slack, or PR comments.',
        badge: 'Core',
      },
    ],
  },
  {
    category: 'Visualization & Scale',
    accent: 'brand-green',
    features: [
      {
        icon: Box,
        title: '3D Component Tree',
        description:
          'Rotate, zoom, and explore your entire component hierarchy as an interactive 3D graph powered by Three.js. Instantly see structural complexity at a glance.',
        badge: 'New',
        highlight: true,
      },
      {
        icon: GitCompare,
        title: 'Profile Comparison',
        description:
          'Load two sessions side-by-side and diff them. See exactly which components improved or regressed between a before and after optimization pass.',
        badge: 'Core',
      },
    ],
  },
  {
    category: 'Ecosystem & CI/CD',
    accent: 'brand-amber',
    features: [
      {
        icon: Puzzle,
        title: 'Plugin Marketplace',
        description:
          'Browse, install, and build custom analysis plugins. Extend the profiler with domain-specific metrics — framework telemetry, design system audits, and more.',
        badge: 'New',
        highlight: true,
      },
      {
        icon: Database,
        title: 'CI/CD Performance Budgets',
        description:
          'The perf-check CLI enforces wasted-render rates, memo hit rates, and payload sizes in your pipeline. Fail builds automatically if budgets are exceeded.',
        badge: 'Core',
      },
    ],
  },
];

const BADGE_STYLES: Record<string, string> = {
  Core: 'bg-surface-700 text-surface-300 border-white/10',
  New: 'bg-brand-cyan/15 text-brand-cyan border-brand-cyan/20',
  Beta: 'bg-brand-purple/15 text-brand-purple border-brand-purple/20',
};

export const AllFeatures = () => {
  return (
    <section id="all-features" className="py-24 section-padding bg-surface-900 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-blue/5 via-surface-900 to-surface-900" />

      <div className="max-w-7xl mx-auto relative z-10">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={containerVariants}
          className="text-center mb-20"
        >
          <motion.div
            variants={fadeUp}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-sm text-brand-cyan mb-6"
          >
            Complete Feature Set
          </motion.div>
          <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-bold text-white mb-6 text-balance">
            Everything in one{' '}
            <span className="gradient-text">DevTools extension</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-lg text-surface-400 max-w-2xl mx-auto">
            From basic render counting to AI-powered suggestions and live team sessions — no separate tools, no subscriptions.
          </motion.p>
        </motion.div>

        <div className="space-y-16">
          {FEATURE_GROUPS.map((group, gi) => (
            <motion.div
              key={gi}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: gi * 0.08 }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className={`h-px flex-1 bg-${group.accent}/20`} />
                <span className={`text-xs font-bold uppercase tracking-widest text-${group.accent}`}>
                  {group.category}
                </span>
                <div className={`h-px flex-1 bg-${group.accent}/20`} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {group.features.map((feat, fi) => (
                  <div
                    key={fi}
                    className={`rounded-2xl border p-5 flex flex-col gap-3 transition-all duration-300 hover:scale-[1.02] ${
                      feat.highlight
                        ? 'border-white/15 bg-surface-800/60 shadow-lg'
                        : 'border-white/8 bg-surface-800/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="p-2 rounded-lg bg-white/5 shrink-0">
                        <feat.icon className={`w-4 h-4 text-${group.accent}`} />
                      </div>
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          BADGE_STYLES[feat.badge] ?? BADGE_STYLES.Core
                        }`}
                      >
                        {feat.badge}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white mb-1.5">{feat.title}</h4>
                      <p className="text-xs text-surface-400 leading-relaxed">{feat.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
