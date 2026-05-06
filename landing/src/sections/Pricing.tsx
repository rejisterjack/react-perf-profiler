import { motion } from 'framer-motion';
import { fadeUp, containerVariants } from '../lib/motion';
import { Check, Heart, Server, BookOpen } from 'lucide-react';

const INCLUDED = [
  'Wasted render detection & classification',
  'Memoization effectiveness scoring',
  'Interactive flamegraph & component tree',
  'React Server Components analysis',
  'AI Suggestions Panel (bring your own key or local Ollama)',
  '3D component tree visualization',
  'Live team sessions (self-host the relay server)',
  'Cloud sync (S3, Dropbox, Google Drive — your credentials)',
  'CI/CD performance budget CLI',
  'Plugin marketplace & custom plugin API',
  'Time-travel debugging',
  'Profile export & import',
  'Cross-browser: Chrome + Firefox',
  'All future features',
];

const SELF_HOSTING = [
  {
    icon: Server,
    title: 'Team session relay (optional)',
    description:
      'Live collaboration uses WebRTC. A one-command Node.js relay is included — deploy free on Railway or Fly.io in under 5 minutes. Not needed for solo use.',
    code: 'node scripts/signaling-server.js',
  },
  {
    icon: BookOpen,
    title: 'Cloud sync (optional)',
    description:
      'S3, Dropbox, and Google Drive sync use your own credentials — no third-party fees. Profile export/import via JSON works offline with zero setup.',
  },
];

export const Pricing = () => {
  const handleDownload = (browser: 'chrome' | 'firefox') => {
    const link = document.createElement('a');
    link.href = `./downloads/react-perf-profiler-${browser}.zip`;
    link.download = `react-perf-profiler-${browser}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <section id="pricing" className="py-24 section-padding bg-surface-900 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-brand-green/5 via-surface-900 to-surface-900" />

      <div className="max-w-5xl mx-auto relative z-10">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={containerVariants}
          className="text-center mb-16"
        >
          <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-bold text-white mb-6 text-balance">
            Simple pricing: <span className="gradient-text">free forever</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-lg text-surface-400 max-w-2xl mx-auto">
            No tiers, no seats, no credit card. Every single feature — AI suggestions, team sessions, CI/CD budgets, RSC analysis — is available to every developer from day one.
          </motion.p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Free plan card */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="lg:col-span-2 rounded-2xl border border-brand-green/20 bg-surface-800/40 p-8"
          >
            <div className="flex items-start justify-between mb-8">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-green/15 text-brand-green text-xs font-semibold mb-3">
                  <Heart className="w-3.5 h-3.5" />
                  The only plan
                </div>
                <div className="text-5xl font-black text-white mb-1">$0</div>
                <div className="text-surface-400 text-sm">No sign-up · No account · No expiry</div>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => handleDownload('chrome')}
                  className="hidden sm:inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-brand-blue hover:bg-brand-blue/90 text-white rounded-xl transition-all"
                >
                  Chrome
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload('firefox')}
                  className="hidden sm:inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-surface-700 hover:bg-surface-600 text-white rounded-xl border border-white/10 transition-all"
                >
                  Firefox
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {INCLUDED.map((item, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-brand-green shrink-0 mt-0.5" />
                  <span className="text-sm text-surface-300">{item}</span>
                </div>
              ))}
            </div>

            <div className="mt-8 flex gap-3 sm:hidden">
              <button
                type="button"
                onClick={() => handleDownload('chrome')}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-brand-blue hover:bg-brand-blue/90 text-white rounded-xl transition-all"
              >
                Download for Chrome
              </button>
              <button
                type="button"
                onClick={() => handleDownload('firefox')}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-surface-700 hover:bg-surface-600 text-white rounded-xl border border-white/10 transition-all"
              >
                Download for Firefox
              </button>
            </div>
          </motion.div>

          {/* Self-hosting notes */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="rounded-2xl border border-white/8 bg-surface-800/30 p-6 space-y-6"
          >
            <div>
              <h3 className="text-sm font-bold text-white mb-1">Power-user options</h3>
              <p className="text-xs text-surface-500 leading-relaxed">
                Two advanced features have optional server requirements. Both are one-command deploys on free platforms — and neither is needed for core profiling.
              </p>
            </div>

            {SELF_HOSTING.map((item, i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center gap-2">
                  <item.icon className="w-4 h-4 text-surface-400" />
                  <span className="text-sm font-medium text-surface-300">{item.title}</span>
                </div>
                <p className="text-xs text-surface-500 leading-relaxed">{item.description}</p>
                {item.code && (
                  <code className="block text-xs bg-surface-900 border border-white/8 rounded-lg px-3 py-2 text-brand-cyan font-mono">
                    {item.code}
                  </code>
                )}
              </div>
            ))}

            <div className="pt-4 border-t border-white/8">
              <a
                href="https://github.com/rejisterjack/react-perf-profiler"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-brand-blue hover:text-brand-cyan transition-colors"
              >
                View source on GitHub →
              </a>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
