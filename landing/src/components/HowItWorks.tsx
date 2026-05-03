import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { useInView } from '@/hooks/useInView';
import { motion } from 'framer-motion';
import { Card } from './ui/Card';
import { Play, Circle, TreePine, AlertTriangle, ArrowRight, MousePointer } from 'lucide-react';

const STEPS = [
  {
    icon: <Play className="w-6 h-6" />,
    title: 'Record',
    description: 'Click the record button and interact with your app. The profiler captures every React commit transparently.',
    color: 'bg-brand-green/20 text-brand-green',
  },
  {
    icon: <TreePine className="w-6 h-6" />,
    title: 'Analyze',
    description: 'The component tree reveals wasted renders in real-time. Red highlights show components re-rendering without changes.',
    color: 'bg-brand-blue/20 text-brand-blue',
  },
  {
    icon: <AlertTriangle className="w-6 h-6" />,
    title: 'Identify',
    description: 'Drill into any component to see render counts, prop change analysis, and memoization effectiveness scores.',
    color: 'bg-brand-amber/20 text-brand-amber',
  },
  {
    icon: <Circle className="w-6 h-6" />,
    title: 'Optimize',
    description: 'Follow AI-generated recommendations to fix wasted renders. See predicted performance improvements before you ship.',
    color: 'bg-brand-react/20 text-brand-react',
  },
];

function StepCard({ step, index }: { step: typeof STEPS[0]; index: number }) {
  const [ref, isInView] = useInView<HTMLDivElement>({ threshold: 0.3 });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: index % 2 === 0 ? -30 : 30 }}
      animate={isInView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.6, delay: index * 0.15 }}
    >
      <Card hover className="p-6 relative">
        <div className="flex items-start gap-4">
          <div className={`flex items-center justify-center w-12 h-12 rounded-xl shrink-0 ${step.color}`}>
            {step.icon}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-mono text-surface-500">Step {index + 1}</span>
              <div className="h-px flex-1 bg-white/5" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">{step.title}</h3>
            <p className="text-sm text-surface-400 leading-relaxed">{step.description}</p>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

export function HowItWorks() {
  const sectionRef = useScrollAnimation<HTMLDivElement>();

  return (
    <section id="how-it-works" ref={sectionRef} className="py-24 lg:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 text-balance">
            How it <span className="gradient-text">works</span>
          </h2>
          <p className="text-lg text-surface-400 text-balance">
            From recording to optimization in four simple steps. No configuration required —
            it just works out of the box.
          </p>
        </div>

        {/* Simulated Profiler Interface */}
        <div className="mb-20 max-w-4xl mx-auto">
          <Card className="overflow-hidden">
            <div className="bg-surface-800/50 p-4 border-b border-white/5 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-brand-red/60" />
                <div className="w-3 h-3 rounded-full bg-brand-amber/60" />
                <div className="w-3 h-3 rounded-full bg-brand-green/60" />
              </div>
              <div className="text-xs text-surface-500 font-mono">⚡ React Perf Profiler</div>
            </div>
            <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Component Tree */}
              <div className="lg:col-span-2 space-y-3">
                <div className="text-xs font-mono text-surface-500 mb-3 flex items-center gap-2">
                  <MousePointer className="w-3 h-3" /> Component Tree
                </div>
                <div className="space-y-2 font-mono text-sm">
                  <div className="flex items-center gap-2 text-surface-300">
                    <span className="text-brand-amber">▲</span> App <span className="text-surface-500">45 renders (12 wasted)</span>
                  </div>
                  <div className="flex items-center gap-2 text-surface-300 pl-4">
                    <span className="text-surface-500">▸</span> Header <span className="text-surface-500">45 renders (0 wasted)</span>
                  </div>
                  <div className="flex items-center gap-2 text-surface-300 pl-4">
                    <span className="text-brand-green">◆</span> Feed <span className="text-surface-500">12 renders (0 wasted) [memoized]</span>
                  </div>
                  <div className="flex items-center gap-2 text-surface-300 pl-8">
                    <span className="text-brand-red">▼</span> Post <span className="text-surface-500">120 renders (89 wasted)</span>
                  </div>
                  <div className="flex items-center gap-2 text-brand-red pl-12 animate-pulse">
                    <AlertTriangle className="w-3 h-3" /> Actions <span className="text-surface-500">120 renders (120 wasted)</span>
                  </div>
                  <div className="flex items-center gap-2 text-surface-300 pl-4">
                    <span className="text-brand-amber">▲</span> Sidebar <span className="text-surface-500">45 renders (43 wasted)</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 pt-4 text-xs text-surface-500">
                  <span className="flex items-center gap-1"><span className="text-brand-amber">▲</span> High impact</span>
                  <span className="flex items-center gap-1"><span className="text-brand-green">◆</span> Optimized</span>
                  <span className="flex items-center gap-1"><span className="text-brand-red">▼</span> Problem area</span>
                </div>
              </div>

              {/* Sidebar Stats */}
              <div className="space-y-4">
                <div className="text-xs font-mono text-surface-500 mb-3">Summary</div>
                <div className="space-y-3">
                  <div className="glass-card p-3">
                    <div className="text-xs text-surface-500 mb-1">Wasted Render Rate</div>
                    <div className="text-2xl font-bold text-brand-red">31.4%</div>
                  </div>
                  <div className="glass-card p-3">
                    <div className="text-xs text-surface-500 mb-1">Memo Hit Rate</div>
                    <div className="text-2xl font-bold text-brand-amber">23%</div>
                  </div>
                  <div className="glass-card p-3">
                    <div className="text-xs text-surface-500 mb-1">Avg Render Time</div>
                    <div className="text-2xl font-bold text-brand-green">2.4ms</div>
                  </div>
                </div>
                <button className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-brand-blue/20 text-brand-blue text-sm font-medium hover:bg-brand-blue/30 transition-colors">
                  View Recommendations <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </Card>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {STEPS.map((step, i) => (
            <StepCard key={i} step={step} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
