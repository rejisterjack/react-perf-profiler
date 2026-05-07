'use client';

import { motion } from 'framer-motion';
import { Database, Zap, Layers, Cpu } from 'lucide-react';
import { fadeUp, containerVariants } from '@/lib/motion';
import { GlassCard } from '@/components/ui/GlassCard';

const rscFeatures = [
  {
    title: "Payload Analysis",
    description: "Track the size of RSC payloads across the wire. Identify oversized components and optimize data colocation.",
    icon: Database,
  },
  {
    title: "Cache Hit Rates",
    description: "Monitor the effectiveness of React's internal cache. See where 'use cache' directives are missing or failing.",
    icon: Zap,
  },
  {
    title: "Boundary Tracking",
    description: "Visualize Server-to-Client boundaries. Minimize serialization costs by optimizing what crosses the boundary.",
    icon: Layers,
  },
  {
    title: "Compute Metrics",
    description: "Measure server-side render times for RSCs. Ensure your backend isn't the bottleneck for your frontend.",
    icon: Cpu,
  }
];

export const RSCShowcase = () => {
  return (
    <section className="py-24 section-padding relative overflow-hidden bg-[#050914]">
      {/* Decorative background element */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-brand-blue/5 rounded-full blur-[150px] -mr-96 -mt-96" />

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={containerVariants}
          >
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-brand-blue/20 bg-brand-blue/10 text-brand-blue text-sm font-medium mb-6">
              Open Source Feature
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-bold text-white mb-8 leading-tight">
              Ready for the <span className="text-brand-blue">Next Era</span> of React
            </motion.h2>
            <motion.p variants={fadeUp} className="text-surface-300 text-lg mb-10 leading-relaxed">
              React Server Components introduce new performance challenges. Our profiler is built from the ground up to handle RSC payloads, client boundaries, and streaming performance.
            </motion.p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {rscFeatures.map((feature, index) => (
                <motion.div key={index} variants={fadeUp} className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-surface-800 border border-white/5 flex items-center justify-center">
                    <feature.icon className="w-5 h-5 text-brand-blue" />
                  </div>
                  <div>
                    <h4 className="text-white font-semibold mb-2">{feature.title}</h4>
                    <p className="text-surface-400 text-sm leading-relaxed">{feature.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
            className="relative"
          >
            <GlassCard className="p-8 aspect-square flex flex-col justify-center items-center text-center overflow-hidden">
               {/* Abstract RSC Visualization */}
               <div className="relative w-full h-full flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-64 h-64 rounded-full border border-brand-blue/20 animate-[spin_10s_linear_infinite]" />
                    <div className="absolute w-48 h-48 rounded-full border border-brand-purple/20 animate-[spin_15s_linear_infinite_reverse]" />
                  </div>

                  <div className="z-10 bg-surface-900/80 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-2xl">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-12 h-12 rounded-full bg-brand-blue/20 flex items-center justify-center">
                        <Layers className="text-brand-blue" />
                      </div>
                      <div className="text-left">
                        <div className="text-xs text-surface-400 uppercase tracking-widest font-bold">RSC Boundary</div>
                        <div className="text-lg font-bold text-white">ClientButton.tsx</div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center gap-12">
                        <span className="text-surface-400 text-sm">Payload Size</span>
                        <span className="text-brand-red font-mono font-bold">45.2 KB ⚠️</span>
                      </div>
                      <div className="w-full h-2 bg-surface-700 rounded-full overflow-hidden">
                        <div className="w-4/5 h-full bg-brand-red" />
                      </div>
                      <div className="text-xs text-surface-500 italic text-left">
                        Hint: Consider data colocation or reducing prop size.
                      </div>
                    </div>
                  </div>
               </div>
            </GlassCard>

            {/* Decorative dots */}
            <div className="absolute -bottom-6 -right-6 grid grid-cols-6 gap-2">
              {[...Array(24)].map((_, i) => (
                <div key={i} className="w-1 h-1 rounded-full bg-brand-blue/20" />
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
