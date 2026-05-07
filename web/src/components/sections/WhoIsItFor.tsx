'use client';

import { motion } from 'framer-motion';
import { fadeUp, containerVariants } from '@/lib/motion';
import { Code2, Users, GitMerge, Check } from 'lucide-react';

const PERSONAS = [
  {
    icon: Code2,
    accentClass: 'text-brand-cyan',
    borderClass: 'border-brand-cyan/20',
    bgClass: 'bg-brand-cyan/5',
    iconBgClass: 'bg-brand-cyan/10',
    title: 'Solo Developer',
    subtitle: 'You ship fast. You need to stay fast.',
    description:
      'Stop guessing why your app feels sluggish. In one recording session, see every wasted render ranked by impact — and get the exact code change to fix each one.',
    useCases: [
      'Find the component causing jank in a feed or table',
      'Verify React.memo is actually working',
      'Catch accidental inline object props before PR review',
      'Profile Next.js RSC payloads in the App Router',
    ],
  },
  {
    icon: Users,
    accentClass: 'text-brand-purple',
    borderClass: 'border-brand-purple/20',
    bgClass: 'bg-brand-purple/5',
    iconBgClass: 'bg-brand-purple/10',
    title: 'Engineering Team',
    subtitle: 'Prevent perf regressions before they reach production.',
    description:
      'Share profiling sessions between teammates, run live collaborative debugging via WebRTC, and use AI-generated fix plans that the whole team can review in a PR.',
    useCases: [
      'Share a profile session as a JSON attachment on a GitHub Issue',
      'Debug a production slowdown together in a live session',
      'Have AI explain why a component is slow to a junior engineer',
      'Compare before/after profiles after a refactor',
    ],
  },
  {
    icon: GitMerge,
    accentClass: 'text-brand-green',
    borderClass: 'border-brand-green/20',
    bgClass: 'bg-brand-green/5',
    iconBgClass: 'bg-brand-green/10',
    title: 'Tech Lead / DevOps',
    subtitle: 'Enforce performance as a standard, not an afterthought.',
    description:
      'Define render budgets in a config file and fail PRs automatically when any component regresses. Turn performance from a manual review note into an automated gate.',
    useCases: [
      'Add perf-budget.json to set team-wide render thresholds',
      'Fail CI when wasted render rate exceeds 10%',
      'Get a PR comment with a pass/fail performance report on every build',
      'Export coverage + bundle budgets into one audit report',
    ],
  },
];

export const WhoIsItFor = () => {
  return (
    <section id="who-is-it-for" className="py-24 section-padding bg-surface-900 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-brand-blue/5 via-surface-900 to-surface-900" />

      <div className="max-w-7xl mx-auto relative z-10">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={containerVariants}
          className="text-center mb-16"
        >
          <motion.p
            variants={fadeUp}
            className="text-xs font-semibold uppercase tracking-widest text-brand-cyan mb-4"
          >
            Built for every React engineer
          </motion.p>
          <motion.h2
            variants={fadeUp}
            className="text-4xl md:text-5xl font-bold text-white mb-6 text-balance"
          >
            Who is this for?
          </motion.h2>
          <motion.p variants={fadeUp} className="text-lg text-surface-400 max-w-2xl mx-auto">
            Whether you're debugging alone or enforcing standards across a team, React Perf Profiler fits your workflow.
          </motion.p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {PERSONAS.map((persona, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.12 }}
              className={`rounded-2xl border ${persona.borderClass} ${persona.bgClass} p-7 flex flex-col gap-5`}
            >
              {/* Icon + title */}
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${persona.iconBgClass}`}>
                  <persona.icon className={`w-6 h-6 ${persona.accentClass}`} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{persona.title}</h3>
                  <p className={`text-xs font-medium ${persona.accentClass} mt-0.5`}>{persona.subtitle}</p>
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-surface-400 leading-relaxed">{persona.description}</p>

              {/* Use cases */}
              <ul className="space-y-2.5">
                {persona.useCases.map((uc, j) => (
                  <li key={j} className="flex items-start gap-2.5">
                    <Check className={`w-4 h-4 ${persona.accentClass} shrink-0 mt-0.5`} />
                    <span className="text-sm text-surface-300">{uc}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
