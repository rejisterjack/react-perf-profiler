import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { Card } from './ui/Card';
import {
  Search,
  Flame,
  Brain,
  Server,
  BarChart3,
  Clock,
  Sparkles,
  Share2,
  Repeat,
  Keyboard,
} from 'lucide-react';

const FEATURES = [
  {
    title: 'Wasted Render Detection',
    description:
      'Instantly identify components that re-render without prop or state changes. See exactly which renders are unnecessary and costing you performance.',
    icon: <Search className="w-6 h-6" />,
    accent: 'bg-brand-amber/10 text-brand-amber',
    size: 'col-span-1 row-span-1',
  },
  {
    title: 'Interactive Flamegraph',
    description:
      'Visualize your entire component render hierarchy in a beautiful, color-coded flamegraph. Zoom, pan, and inspect any commit with sub-millisecond precision.',
    icon: <Flame className="w-6 h-6" />,
    accent: 'bg-brand-red/10 text-brand-red',
    size: 'col-span-1 row-span-1',
  },
  {
    title: 'Memo Effectiveness Analysis',
    description:
      'Discover why your React.memo, useMemo, and useCallback are not working. Get specific recommendations for each component with expected improvement percentages.',
    icon: <Brain className="w-6 h-6" />,
    accent: 'bg-brand-green/10 text-brand-green',
    size: 'col-span-1 row-span-1',
  },
  {
    title: 'React Server Components',
    description:
      'First-class RSC support for Next.js App Router. Analyze payload sizes, cache hit/miss rates, and server/client boundary crossings with actionable recommendations.',
    icon: <Server className="w-6 h-6" />,
    accent: 'bg-brand-blue/10 text-brand-blue',
    size: 'col-span-1 md:col-span-2 row-span-1',
  },
  {
    title: 'CI Performance Budgets',
    description:
      'Enforce performance budgets in your CI/CD pipeline. Automatically fail builds when wasted render rates exceed thresholds or memo hit rates drop below targets.',
    icon: <BarChart3 className="w-6 h-6" />,
    accent: 'bg-brand-react/10 text-brand-react',
    size: 'col-span-1 row-span-1',
  },
  {
    title: 'AI-Powered Suggestions',
    description:
      'Get intelligent optimization recommendations powered by TensorFlow.js and LLM integration. From local Ollama to OpenAI — choose your privacy level.',
    icon: <Sparkles className="w-6 h-6" />,
    accent: 'bg-purple-500/10 text-purple-400',
    size: 'col-span-1 row-span-1',
  },
  {
    title: 'Time-Travel Debugging',
    description:
      'Step through every React commit to understand exactly how state changes propagate through your component tree. Replay and compare render snapshots.',
    icon: <Clock className="w-6 h-6" />,
    accent: 'bg-teal-500/10 text-teal-400',
    size: 'col-span-1 row-span-1',
  },
  {
    title: 'Cloud Sync & Team Sharing',
    description:
      'Export profiles to S3, Dropbox, or Google Drive. Share performance reports with your team via cloud sync or real-time WebRTC collaboration sessions.',
    icon: <Share2 className="w-6 h-6" />,
    accent: 'bg-orange-500/10 text-orange-400',
    size: 'col-span-1 md:col-span-2 row-span-1',
  },
  {
    title: 'Cross-Browser Support',
    description:
      'Works flawlessly in Chrome (Manifest V3) and Firefox (Manifest V2). One codebase, unified experience across all major development browsers.',
    icon: <Repeat className="w-6 h-6" />,
    accent: 'bg-pink-500/10 text-pink-400',
    size: 'col-span-1 row-span-1',
  },
  {
    title: 'Keyboard Shortcuts',
    description:
      'Navigate the profiler at the speed of thought. Extensive keyboard shortcuts for recording, filtering, zooming, and exporting — never touch the mouse.',
    icon: <Keyboard className="w-6 h-6" />,
    accent: 'bg-cyan-500/10 text-cyan-400',
    size: 'col-span-1 row-span-1',
  },
];

export function FeaturesBento() {
  const ref = useScrollAnimation<HTMLDivElement>();

  return (
    <section id="features" ref={ref} className="py-24 lg:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 text-balance">
            Everything you need to{' '}
            <span className="gradient-text">optimize React</span>
          </h2>
          <p className="text-lg text-surface-400 text-balance">
            A complete performance analysis toolkit built directly into Chrome DevTools.
            No extra tabs. No context switching. Just results.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-5">
          {FEATURES.map((feature, i) => (
            <Card
              key={i}
              hover
              glow
              className={`${feature.size} p-6 lg:p-8 flex flex-col group`}
            >
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${feature.accent} mb-5 group-hover:scale-110 transition-transform`}>
                {feature.icon}
              </div>
              <h3 className="text-lg font-semibold text-white mb-3">
                {feature.title}
              </h3>
              <p className="text-sm text-surface-400 leading-relaxed flex-1">
                {feature.description}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
