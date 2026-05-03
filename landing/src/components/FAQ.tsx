import { useState } from 'react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { Card } from './ui/Card';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, HelpCircle } from 'lucide-react';

const FAQS = [
  {
    question: 'How do I install the extension?',
    answer: 'Download the ZIP for your browser above, extract it, then load it as an unpacked extension. For Chrome: go to chrome://extensions, enable Developer Mode, click "Load unpacked", and select the extracted folder. For Firefox: go to about:debugging, click "This Firefox", then "Load Temporary Add-on" and select the manifest.json.',
  },
  {
    question: 'Which browsers are supported?',
    answer: 'React Perf Profiler supports Chrome (Manifest V3) and Firefox (Manifest V2) with full feature parity. Both builds are maintained from a single codebase with browser-specific adapters for seamless cross-compatibility.',
  },
  {
    question: 'Does this work with React Server Components?',
    answer: 'Yes! React Perf Profiler has first-class RSC support for Next.js App Router and other RSC frameworks. It analyzes payload sizes, cache hit/miss rates, server/client boundary crossings, and serialization costs with actionable recommendations.',
  },
  {
    question: 'Is my profiling data sent to any server?',
    answer: 'No. By default, all profiling data stays on your machine. Optional cloud sync (S3, Dropbox, Google Drive) and AI suggestions only send data when you explicitly configure and enable them. Local Ollama integration means you can use AI features with zero data leaving your machine.',
  },
  {
    question: 'How does the CI/CD integration work?',
    answer: 'The perf-check CLI tool enforces performance budgets in your CI pipeline. Define thresholds for wasted render rates, memo hit rates, and render times in a perf-budget.json file. The tool exits with non-zero status if budgets are exceeded, automatically failing the build.',
  },
  {
    question: 'Can I use this with Next.js?',
    answer: 'Absolutely. React Perf Profiler works with any React application including Next.js, Create React App, Vite, Remix, and Gatsby. RSC analysis is particularly powerful for Next.js App Router applications.',
  },
  {
    question: "What's the difference between this and React DevTools Profiler?",
    answer: 'React DevTools Profiler shows you raw render data. React Perf Profiler transforms that data into actionable insights: wasted render classification, memo effectiveness scoring, automatic optimization recommendations, flamegraph visualizations, and CI/CD performance budget enforcement.',
  },
  {
    question: 'Is it free and open source?',
    answer: 'Yes. React Perf Profiler is 100% free, open source, and MIT licensed. The source code is available on GitHub. Contributions are welcome — see our contributing guidelines for areas we are actively seeking help.',
  },
];

function FAQItem({ faq }: { faq: typeof FAQS[0] }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card className="overflow-hidden">
      <button
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
            <div className="px-6 pb-6 text-surface-400 leading-relaxed">
              {faq.answer}
            </div>
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
            Everything you need to know about React Perf Profiler.
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
