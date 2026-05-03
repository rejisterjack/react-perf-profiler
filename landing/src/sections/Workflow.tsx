import { motion } from 'framer-motion';
import { Play, MousePointer2, BarChart3, ArrowRight } from 'lucide-react';
import { fadeUp, containerVariants } from '../lib/motion';

const steps = [
  {
    title: "1. Start Recording",
    description: "Open the ⚡ Perf Profiler tab in Chrome DevTools and hit the record button to begin capturing render data.",
    icon: Play,
    color: "bg-brand-blue",
  },
  {
    title: "2. Interact with App",
    description: "Perform the actions you want to profile. We capture every commit, hook change, and component update in real-time.",
    icon: MousePointer2,
    color: "bg-brand-purple",
  },
  {
    title: "3. Analyze & Optimize",
    description: "Stop recording to see a detailed breakdown of wasted renders, memoization scores, and optimization tips.",
    icon: BarChart3,
    color: "bg-brand-green",
  }
];

export const Workflow = () => {
  return (
    <section id="how-it-works" className="py-24 section-padding bg-surface-900 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={containerVariants}
          className="text-center mb-20"
        >
          <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-bold text-white mb-6">
            Optimize in <span className="gradient-text">Three Simple Steps</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-surface-300 text-lg max-w-2xl mx-auto">
            Stop digging through raw React DevTools data. Get actionable insights immediately.
          </motion.p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
          {/* Connector Line (Desktop) */}
          <div className="absolute top-1/2 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-y-1/2 hidden md:block" />

          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.2 }}
              className="relative z-10 flex flex-col items-center text-center"
            >
              <div className={`w-16 h-16 ${step.color} rounded-2xl flex items-center justify-center mb-8 shadow-lg shadow-${step.color.split('-')[1]}/20 transform hover:rotate-6 transition-transform duration-300`}>
                <step.icon className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">{step.title}</h3>
              <p className="text-surface-400 leading-relaxed">
                {step.description}
              </p>
              
              {index < steps.length - 1 && (
                <div className="mt-8 md:hidden text-surface-600">
                  <ArrowRight className="w-6 h-6 rotate-90" />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
