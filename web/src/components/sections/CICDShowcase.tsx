'use client';

import { motion } from 'framer-motion';
import { fadeUp, containerVariants } from '@/lib/motion';
import { GitPullRequest, CheckCircle2, XCircle, Terminal, AlertTriangle, TrendingDown } from 'lucide-react';

const PR_COMMENT = [
  { label: 'Panel bundle', size: '245 KB', budget: '500 KB', pass: true },
  { label: 'Background', size: '45 KB', budget: '100 KB', pass: true },
  { label: 'Content script', size: '38 KB', budget: '153 KB', pass: true },
  { label: 'Total', size: '890 KB', budget: '1,000 KB', pass: true },
];

const PERF_CHECKS = [
  { label: 'Wasted render rate', value: '4.2%', threshold: '10%', pass: true },
  { label: 'Memo hit rate', value: '91%', threshold: '80%', pass: true },
  { label: 'Max render time', value: '11ms', threshold: '16ms', pass: true },
  { label: 'RSC payload', value: '68 KB', threshold: '100 KB', pass: true },
];

const STEPS = [
  {
    step: '01',
    title: 'Define your budgets',
    code: `// perf-budget.json
{
  "wastedRenderThreshold": 0.1,
  "memoHitRateThreshold": 0.8,
  "maxRenderTimeMs": 16,
  "maxRSCPayloadSize": 100000
}`,
  },
  {
    step: '02',
    title: 'Add to your CI pipeline',
    code: `# .github/workflows/ci.yml
- name: Check performance budgets
  run: pnpm perf:check:all

# Exits non-zero if any budget is exceeded
# Posts a detailed PR comment automatically`,
  },
  {
    step: '03',
    title: 'Get automatic PR reports',
    code: null, // rendered as visual card
  },
];

export const CICDShowcase = () => {
  return (
    <section id="ci-cd" className="py-24 section-padding bg-surface-900 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-brand-green/5 via-surface-900 to-surface-900" />

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
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-brand-green/20 bg-brand-green/10 text-brand-green text-sm font-medium mb-6"
          >
            <GitPullRequest className="w-4 h-4" />
            CI/CD Integration
          </motion.div>
          <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-bold text-white mb-6 text-balance">
            Performance budgets that{' '}
            <span className="text-brand-green">fail the build</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-lg text-surface-400 max-w-2xl mx-auto">
            Stop discovering performance regressions in code review. Enforce them as hard gates in CI —
            the same way you enforce test coverage and type safety.
          </motion.p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          {/* Left: steps */}
          <div className="space-y-8">
            {STEPS.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.12 }}
                className="flex gap-5"
              >
                <div className="shrink-0 flex flex-col items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-brand-green/15 border border-brand-green/30 text-brand-green text-xs font-bold font-mono flex items-center justify-center">
                    {s.step}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className="w-px flex-1 bg-brand-green/10" />
                  )}
                </div>
                <div className="flex-1 pb-4">
                  <h3 className="text-base font-bold text-white mb-3">{s.title}</h3>
                  {s.code ? (
                    <div className="rounded-xl border border-white/8 bg-surface-800/50 overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5 bg-surface-800/80">
                        <Terminal className="w-3.5 h-3.5 text-surface-500" />
                        <span className="text-xs text-surface-500 font-mono">
                          {s.step === '01' ? 'perf-budget.json' : '.github/workflows/ci.yml'}
                        </span>
                      </div>
                      <pre className="p-4 text-xs text-surface-300 font-mono leading-relaxed overflow-x-auto whitespace-pre">
                        <code>{s.code}</code>
                      </pre>
                    </div>
                  ) : (
                    /* Step 3: PR Comment preview */
                    <div className="rounded-xl border border-white/10 bg-surface-800/40 overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-surface-800/60">
                        <GitPullRequest className="w-4 h-4 text-brand-green" />
                        <span className="text-sm font-medium text-white">Performance Report</span>
                        <div className="ml-auto flex items-center gap-1.5 text-xs text-brand-green font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          PASSED
                        </div>
                      </div>
                      <div className="p-4 space-y-4">
                        {/* Bundle sizes */}
                        <div>
                          <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">Bundle Sizes</div>
                          <div className="space-y-1.5">
                            {PR_COMMENT.map((row, j) => (
                              <div key={j} className={`flex items-center justify-between text-xs ${j === PR_COMMENT.length - 1 ? 'font-semibold text-white border-t border-white/5 pt-1.5' : 'text-surface-400'}`}>
                                <span>{row.label}</span>
                                <div className="flex items-center gap-3">
                                  <span className="font-mono">{row.size}</span>
                                  <span className="text-surface-600">/ {row.budget}</span>
                                  <CheckCircle2 className="w-3.5 h-3.5 text-brand-green" />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        {/* Perf checks */}
                        <div>
                          <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">Performance Budgets</div>
                          <div className="space-y-1.5">
                            {PERF_CHECKS.map((row, j) => (
                              <div key={j} className="flex items-center justify-between text-xs text-surface-400">
                                <span>{row.label}</span>
                                <div className="flex items-center gap-3">
                                  <span className="font-mono text-brand-green font-medium">{row.value}</span>
                                  <span className="text-surface-600">/ {row.threshold}</span>
                                  <CheckCircle2 className="w-3.5 h-3.5 text-brand-green" />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Right: failure example + value props */}
          <div className="space-y-6">
            {/* What a failing build looks like */}
            <motion.div
              initial={{ opacity: 0, x: 24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="rounded-2xl border border-red-500/20 bg-red-500/5 overflow-hidden"
            >
              <div className="flex items-center gap-2 px-5 py-3 border-b border-red-500/10 bg-red-500/10">
                <XCircle className="w-4 h-4 text-red-400" />
                <span className="text-sm font-semibold text-red-300">CI Check Failed — PR #247</span>
              </div>
              <div className="p-5 space-y-3 font-mono text-xs">
                <div className="flex items-start gap-2 text-red-300">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>Wasted render rate: <strong>34.2%</strong> (budget: 10%)</span>
                </div>
                <div className="flex items-start gap-2 text-red-300">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>Memo hit rate: <strong>41%</strong> (budget: 80%)</span>
                </div>
                <div className="flex items-start gap-2 text-brand-amber">
                  <TrendingDown className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>Culprit: <strong>ProductCard</strong> — inline style prop on every render</span>
                </div>
                <div className="pt-2 border-t border-red-500/10 text-surface-500">
                  Fix: move style to CSS module → re-run perf:check
                </div>
              </div>
            </motion.div>

            {/* Value props */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                {
                  title: 'Catch regressions before merge',
                  body: 'Every PR is automatically scored against your team\'s budgets. Nothing regresses silently.',
                  color: 'text-brand-green',
                },
                {
                  title: 'Exact violation details',
                  body: 'Not just "CI failed" — the report names the component, the metric, and the fix.',
                  color: 'text-brand-cyan',
                },
                {
                  title: 'Works with any CI',
                  body: 'GitHub Actions, GitLab CI, CircleCI, Bitbucket — it\'s a CLI that exits non-zero on failure.',
                  color: 'text-brand-blue',
                },
                {
                  title: 'Zero infrastructure',
                  body: 'No external service. The perf-check CLI runs in your existing pipeline using your profile JSON.',
                  color: 'text-brand-purple',
                },
              ].map((card, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                  className="rounded-xl border border-white/8 bg-surface-800/30 p-4"
                >
                  <h4 className={`text-sm font-semibold mb-1.5 ${card.color}`}>{card.title}</h4>
                  <p className="text-xs text-surface-400 leading-relaxed">{card.body}</p>
                </motion.div>
              ))}
            </div>

            {/* CLI snippet */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="rounded-xl border border-white/8 bg-surface-800/40 overflow-hidden"
            >
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5">
                <Terminal className="w-3.5 h-3.5 text-surface-500" />
                <span className="text-xs text-surface-500 font-mono">CLI usage</span>
              </div>
              <pre className="p-4 text-xs text-surface-300 font-mono leading-relaxed overflow-x-auto">
                <code>{`# Run all checks + post PR comment
pnpm perf:check:all

# Check bundle sizes only
pnpm perf:check:bundles --bundle-target both

# Custom config + markdown output
pnpm perf:check --config ./budgets.json \\
  --format markdown --output report.md`}</code>
              </pre>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};
