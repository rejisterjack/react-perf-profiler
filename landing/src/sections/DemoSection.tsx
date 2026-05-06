import { motion } from 'framer-motion';
import { fadeUp, containerVariants } from '../lib/motion';
import { Play, Terminal, BarChart3, Brain, GitCompare } from 'lucide-react';

const DEMO_STEPS = [
  {
    icon: Play,
    step: '01',
    title: 'Open the Perf Profiler tab',
    description: 'Hit F12, switch to the ⚡ Perf Profiler tab. Works on any React 16.5+ application.',
    accent: 'brand-blue',
  },
  {
    icon: Terminal,
    step: '02',
    title: 'Record & interact',
    description: 'Click Record. Use your app normally — scroll a feed, submit a form, open a modal. We capture every commit.',
    accent: 'brand-purple',
  },
  {
    icon: BarChart3,
    step: '03',
    title: 'See wasted renders instantly',
    description: 'Stop recording. The flamegraph highlights wasteful components in red. Click any component for the exact prop that caused the re-render.',
    accent: 'brand-cyan',
  },
  {
    icon: Brain,
    step: '04',
    title: 'Get AI-generated fixes',
    description: 'Open the AI panel. It reads your profile and generates specific code changes — useCallback wraps, memo boundaries, context splits.',
    accent: 'brand-purple',
  },
  {
    icon: GitCompare,
    step: '05',
    title: 'Validate the improvement',
    description: 'Record again after applying the fix. Use profile comparison to diff the two sessions and confirm the regression is gone.',
    accent: 'brand-green',
  },
];

const QUICK_START = `# Clone and build in 60 seconds
git clone https://github.com/rejisterjack/react-perf-profiler.git
cd react-perf-profiler && pnpm install && pnpm build

# Chrome: chrome://extensions → Enable Dev Mode → Load unpacked → dist-chrome/
# Firefox: about:debugging → This Firefox → Load Temporary Add-on → dist-firefox/manifest.json`;

export const DemoSection = () => {
  return (
    <section id="demo" className="py-24 section-padding bg-surface-900 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-brand-purple/5 rounded-full blur-[150px] -ml-64 -mt-64" />

      <div className="max-w-7xl mx-auto relative z-10">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={containerVariants}
          className="text-center mb-20"
        >
          <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-bold text-white mb-6">
            See it in action
          </motion.h2>
          <motion.p variants={fadeUp} className="text-lg text-surface-400 max-w-2xl mx-auto">
            From first render to fixed performance — in five steps.
          </motion.p>
        </motion.div>

        {/* Step flow */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-0 mb-20 relative">
          {/* Connector line */}
          <div className="absolute top-8 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent hidden md:block" />

          {DEMO_STEPS.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="relative z-10 flex flex-col items-center text-center px-3 group"
            >
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-5 border transition-all duration-300 group-hover:scale-110
                  bg-${step.accent}/10 border-${step.accent}/20 text-${step.accent}`}
              >
                <step.icon className="w-7 h-7" />
              </div>
              <div className={`text-xs font-bold font-mono text-${step.accent}/60 mb-2`}>{step.step}</div>
              <h3 className="text-sm font-bold text-white mb-2 leading-snug">{step.title}</h3>
              <p className="text-xs text-surface-500 leading-relaxed">{step.description}</p>
            </motion.div>
          ))}
        </div>

        {/* Quick start */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="rounded-2xl border border-white/10 bg-surface-800/40 overflow-hidden"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-surface-800/60">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/70" />
              <div className="w-3 h-3 rounded-full bg-brand-amber/70" />
              <div className="w-3 h-3 rounded-full bg-brand-green/70" />
            </div>
            <span className="text-xs text-surface-400 font-mono">Terminal — 60-second setup</span>
            <div />
          </div>
          <pre className="p-6 text-sm text-surface-300 font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap">
            <code>{QUICK_START}</code>
          </pre>
        </motion.div>

        {/* Or download directly */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-center mt-10"
        >
          <p className="text-surface-500 text-sm mb-4">
            Prefer to skip the build step?
          </p>
          <a
            href="#download"
            className="inline-flex items-center gap-2 text-brand-blue hover:text-brand-cyan transition-colors text-sm font-medium"
          >
            Download pre-built ZIPs directly ↓
          </a>
        </motion.div>
      </div>
    </section>
  );
};
