const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://reactperfprofiler.com';

export const softwareApplicationSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'React Perf Profiler',
  applicationCategory: 'DeveloperApplication',
  applicationSubCategory: 'Performance Profiler',
  operatingSystem: 'Chrome, Firefox',
  description:
    'The open-source React performance profiler that finds wasted renders, scores memoization, and tells you exactly what to fix.',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  author: {
    '@type': 'Organization',
    name: 'React Perf Profiler Team',
  },
  license: 'https://opensource.org/licenses/MIT',
  featureList: [
    'Wasted render detection',
    'Memoization effectiveness scoring',
    'AI-powered fix suggestions',
    'React Server Components analysis',
    'CI/CD performance budgets',
    'Profile comparison and diffing',
    'Real-time collaborative debugging',
  ],
};

export const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'How do I install the extension?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Download the ZIP for your browser, extract it, and load it as an unpacked extension. For Chrome: go to chrome://extensions, enable Developer Mode, click "Load unpacked", and select the extracted folder. For Firefox: go to about:debugging, click "This Firefox", then "Load Temporary Add-on" and select the manifest.json.',
      },
    },
    {
      '@type': 'Question',
      name: 'Which React versions are supported?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'React Perf Profiler requires React 16.5 or later. It works with React 16.5, 17, 18, and 18+ concurrent mode. The extension works with any React framework: Next.js, Vite, Create React App, Remix, Gatsby, and Expo Web.',
      },
    },
    {
      '@type': 'Question',
      name: 'Will this slow down my application in development?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'No. The extension only activates when Chrome DevTools is open and you are on the Perf Profiler tab. All heavy analysis runs in a dedicated Web Worker off the main thread. Zero overhead when DevTools is closed.',
      },
    },
    {
      '@type': 'Question',
      name: 'Does this work with React Server Components?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. For Next.js App Router and other RSC frameworks, the profiler analyzes payload sizes, cache hit/miss rates, server/client boundary crossings, and serialization costs.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can I use this with Next.js, Vite, or Remix?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes to all three. The extension works with any React application regardless of the build tool or framework. For Next.js App Router, you additionally get RSC payload analysis.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is my profiling data sent to any server?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'No. All profiling data stays on your machine by default. Optional cloud sync only sends data when you explicitly configure it with your own credentials. AI suggestions use your own API keys or local Ollama.',
      },
    },
    {
      '@type': 'Question',
      name: 'How does the CI/CD integration work?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'The perf-check CLI enforces performance budgets in your pipeline. Define thresholds in a perf-budget.json file and run it in CI. It exits non-zero if budgets are exceeded, failing the build automatically.',
      },
    },
    {
      '@type': 'Question',
      name: "What's the difference between this and React DevTools Profiler?",
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'React DevTools Profiler shows raw render data. React Perf Profiler transforms that into actionable answers: classifies renders as wasted or necessary, scores memoization, generates code fixes, provides flamegraphs, and enforces standards in CI.',
      },
    },
    {
      '@type': 'Question',
      name: 'How do I set up the AI suggestions panel?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Open the AI Suggestions panel, add your API key for OpenAI or Anthropic, or configure a local Ollama endpoint. API keys are stored locally and never leave your machine.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can I share profiles with my team?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. Export as JSON and share, sync to cloud storage using your own credentials, or start a live session for real-time collaborative debugging over WebRTC.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is it free and open source?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. React Perf Profiler is 100% free, MIT licensed, and the full source code is on GitHub. No tiers, no enterprise seats, no expiry.',
      },
    },
    {
      '@type': 'Question',
      name: 'Which browsers are supported?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Chrome (Manifest V3) and Firefox (Manifest V2) with full feature parity. Microsoft Edge (Chromium) can load the Chrome build directly.',
      },
    },
  ],
};

export const howToSchema = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'How to Profile React Performance',
  description:
    'Find and fix wasted renders in your React application in 5 steps.',
  step: [
    {
      '@type': 'HowToStep',
      position: 1,
      name: 'Open the Perf Profiler tab',
      text: 'Hit F12, switch to the Perf Profiler tab. Works on any React 16.5+ application.',
    },
    {
      '@type': 'HowToStep',
      position: 2,
      name: 'Record and interact',
      text: 'Click Record. Use your app normally — scroll a feed, submit a form, open a modal. Every commit is captured.',
    },
    {
      '@type': 'HowToStep',
      position: 3,
      name: 'See wasted renders instantly',
      text: 'Stop recording. The flamegraph highlights wasteful components in red. Click any component for the exact prop that caused the re-render.',
    },
    {
      '@type': 'HowToStep',
      position: 4,
      name: 'Get AI-generated fixes',
      text: 'Open the AI panel. It reads your profile and generates specific code changes — useCallback wraps, memo boundaries, context splits.',
    },
    {
      '@type': 'HowToStep',
      position: 5,
      name: 'Validate the improvement',
      text: 'Record again after applying the fix. Use profile comparison to diff the two sessions and confirm the regression is gone.',
    },
  ],
};

export const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: baseUrl,
    },
  ],
};
