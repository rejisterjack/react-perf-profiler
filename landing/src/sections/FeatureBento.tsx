import { BentoGrid, BentoGridItem } from '../components/ui/BentoGrid';
import { motion } from 'framer-motion';
import { Cpu, Zap, ShieldAlert, BarChart3, Database } from 'lucide-react';

export const FeatureBento = () => {
  return (
    <section id="features" className="py-24 section-padding bg-surface-900 relative">
      <div className="max-w-7xl mx-auto mb-16 text-center">
        <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
          Everything you need to ship <span className="gradient-text">faster</span>.
        </h2>
        <p className="text-xl text-surface-400 max-w-2xl mx-auto">
          Deep dive into your application's architecture with surgical precision. 
          Identify leaks, bottlenecks, and re-renders in real-time.
        </p>
      </div>
      <BentoGrid>
        {features.map((feature, i) => (
          <BentoGridItem
            key={i}
            title={feature.title}
            description={feature.description}
            header={feature.header}
            icon={feature.icon}
            className={i === 0 || i === 3 ? "md:col-span-2" : ""}
          />
        ))}
      </BentoGrid>
    </section>
  );
};

const Skeleton = ({ className }: { className?: string }) => (
  <div className={`flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-gradient-to-br from-surface-800 to-surface-900 border border-white/5 relative overflow-hidden ${className}`}>
    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjIiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] opacity-20" />
    <div className="absolute inset-0 bg-gradient-to-tr from-brand-blue/5 via-transparent to-brand-purple/5" />
    <motion.div 
      animate={{ 
        x: ['-100%', '200%'],
      }}
      transition={{ 
        duration: 2, 
        repeat: Infinity, 
        ease: "linear" 
      }}
      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent w-1/2 -skew-x-12"
    />
  </div>
);

const features = [
  {
    title: "Wasted Render Detection",
    description: "Identify components that re-render without any prop or state changes. Save precious milliseconds by eliminating redundant cycles.",
    header: <Skeleton className="bg-brand-red/5" />,
    icon: <ShieldAlert className="w-5 h-5 text-brand-red" />,
  },
  {
    title: "Memoization Scorer",
    description: "Our proprietary algorithm scores the effectiveness of your useMemo and useCallback hooks, pinpointing exactly why they fail.",
    header: <Skeleton className="bg-brand-purple/5" />,
    icon: <Zap className="w-5 h-5 text-brand-purple" />,
  },
  {
    title: "CI/CD Perf Budgets",
    description: "Enforce performance standards in your pipeline. Automatically fail builds that exceed render time or payload size budgets.",
    header: <Skeleton className="bg-brand-green/5" />,
    icon: <Database className="w-5 h-5 text-brand-green" />,
  },
  {
    title: "Interactive Flamegraphs",
    description: "Visualize the entire render hierarchy with millisecond precision. Zoom, pan, and filter to find the deepest bottlenecks.",
    header: <Skeleton className="bg-brand-cyan/5" />,
    icon: <BarChart3 className="w-5 h-5 text-brand-cyan" />,
  },
  {
    title: "Export/Import Sessions",
    description: "Share performance profiles with your team. Export as JSON and load them back in for collaborative debugging sessions.",
    header: <Skeleton className="bg-brand-blue/5" />,
    icon: <Database className="w-5 h-5 text-brand-blue" />,
  },
  {
    title: "Extensible Plugin System",
    description: "Build custom analysis plugins to track domain-specific metrics. Fully compatible with our core engine.",
    header: <Skeleton className="bg-surface-700/5" />,
    icon: <Cpu className="w-5 h-5 text-surface-400" />,
  },
];
