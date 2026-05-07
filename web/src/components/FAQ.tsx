'use client';

import { useState } from 'react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { Card } from './ui/Card';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, HelpCircle } from 'lucide-react';

const FAQS = [
  {
    question: 'How do I install the extension?',
    answer:
      'Download the ZIP for your browser from the Install button above, then extract it and load it as an unpacked extension. For Chrome: go to chrome://extensions, enable Developer Mode, click "Load unpacked", and select the extracted folder. For Firefox: go to about:debugging, click "This Firefox", then "Load Temporary Add-on" and select the manifest.json. The full step-by-step guide is in the "See it in action" section above.',
  },
  {
    question: 'Which React versions are supported?',
    answer:
      'React Perf Profiler requires React 16.5 or later — this is when React introduced the Profiler API. It works with React 16.5, 17, 18, and 18+ concurrent mode. React 19 compatibility is actively being tested. The extension hooks into the React DevTools global hook, so it works with any React framework: Next.js, Vite, Create React App, Remix, Gatsby, and Expo Web.',
  },
  {
    question: 'Will this slow down my application in development?',
    answer:
      'No. The extension only activates when Chrome DevTools is open and you\'re on the Perf Profiler tab. All heavy analysis runs in a dedicated Web Worker off the main thread. The analysis engine processes 15,000+ nodes per second while the profiler UI stays below 8ms response time at 60fps. Zero overhead when DevTools is closed.',
  },
  {
    question: 'Which browsers are supported?',
    answer:
      'React Perf Profiler supports Chrome (Manifest V3) and Firefox (Manifest V2) with full feature parity. Both builds are maintained from a single codebase with browser-specific adapters. Microsoft Edge (Chromium) can load the Chrome build directly via edge://extensions in developer mode.',
  },
  {
    question: 'Does this work with React Server Components?',
    answer:
      'Yes — RSC support is a first-class feature. For Next.js App Router and other RSC frameworks, the profiler analyzes payload sizes, cache hit/miss rates, server/client boundary crossings, and serialization costs. It identifies oversized props crossing server-client boundaries and recommends data colocation strategies. See the "Ready for the Next Era of React" section above.',
  },
  {
    question: 'Can I use this with Next.js, Vite, or Remix?',
    answer:
      'Yes to all three. The extension works with any React application regardless of the build tool or framework. For Next.js App Router, you additionally get RSC payload analysis. For Remix, standard client component profiling works fully. For Vite, install the extension and open DevTools normally — no special config needed.',
  },
  {
    question: 'Is my profiling data sent to any server?',
    answer:
      'No — by default, all profiling data stays on your machine in the browser extension\'s local storage. Optional cloud sync (S3, Dropbox, Google Drive) only sends data when you explicitly configure and activate it using your own credentials. AI suggestions only send component data to OpenAI/Anthropic when you enter your own API key. Local Ollama integration lets you use AI features with zero data leaving your machine.',
  },
  {
    question: 'How does the CI/CD integration work?',
    answer:
      'The `perf-check` CLI enforces performance budgets in your pipeline. Define thresholds for wasted render rates, memo hit rates, render times, and RSC payload sizes in a `perf-budget.json` file. Run `pnpm perf:check:all` in CI — it exits with a non-zero status if any budget is exceeded, automatically failing the build. It also posts a detailed PR comment showing which checks passed and failed.',
  },
  {
    question: "What's the difference between this and React DevTools Profiler?",
    answer:
      'React DevTools Profiler shows you raw render data — commit timings, component names, what rendered. React Perf Profiler transforms that raw data into actionable answers: it classifies each render as wasted or necessary, scores your memoization effectiveness, generates specific code fixes, provides flamegraph visualizations, and enforces standards in CI. The built-in profiler asks "what happened?" — this tool answers "why, and how to fix it."',
  },
  {
    question: 'How do I set up the AI suggestions panel?',
    answer:
      'Open the AI Suggestions panel in the extension, then add your API key for OpenAI (gpt-4o), Anthropic (claude-3-5-sonnet), or configure a local Ollama endpoint (no key needed). API keys are stored locally in chrome.storage.local — they never leave your machine unless you make an AI request. The AI reads your profile data and generates component-level optimization plans in natural language with specific code changes.',
  },
  {
    question: 'Can I share profiles with my team?',
    answer:
      'Yes — three ways. (1) Export as JSON and share via Slack, email, or attach to a GitHub Issue. (2) Sync to cloud storage (S3, Dropbox, Google Drive) using your own credentials and share the link. (3) Start a live session for real-time collaborative debugging over WebRTC — your teammate connects to the same session and sees your profile live. Live sessions require either running the included Node.js relay server or using a free-tier platform like Railway.',
  },
  {
    question: 'Is it free and open source?',
    answer:
      'Yes — React Perf Profiler is 100% free, MIT licensed, and the full source code is on GitHub. There are no tiers, no enterprise seats, and no expiry. Every feature described on this page is available to everyone. Contributions are welcome — the CONTRIBUTING.md guide covers areas actively seeking help.',
  },
];

function FAQItem({ faq }: { faq: (typeof FAQS)[0] }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-6 text-left hover:bg-white/[0.02] transition-colors"
      >
        <span className="text-base font-medium text-white pr-4">{faq.question}</span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0 text-surface-400"
        >
          <ChevronDown className="w-5 h-5" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="px-6 pb-6 text-surface-400 leading-relaxed">{faq.answer}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

export function FAQ() {
  const ref = useScrollAnimation<HTMLDivElement>();

  return (
    <section id="faq" ref={ref} className="py-24 lg:py-32">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-react/10 text-brand-react mb-6">
            <HelpCircle className="w-6 h-6" />
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 text-balance">
            Frequently asked <span className="gradient-text">questions</span>
          </h2>
          <p className="text-lg text-surface-400 text-balance">
            Everything you need to know before installing.
          </p>
        </div>

        <div className="space-y-4">
          {FAQS.map((faq, i) => (
            <FAQItem key={i} faq={faq} />
          ))}
        </div>
      </div>
    </section>
  );
}
