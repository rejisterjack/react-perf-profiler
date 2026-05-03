import { motion } from 'framer-motion';
import { Terminal, CheckCircle2 } from 'lucide-react';
import { fadeUp, fadeUpStagger, containerVariants } from '../lib/motion';
import { MagneticButton } from '../components/ui/MagneticButton';

export const Hero = () => {

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20 section-padding">
      {/* Background Gradients */}
      <div className="absolute inset-0 w-full h-full bg-surface-900 z-[-1]" />
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-brand-cyan/20 rounded-full blur-[120px] mix-blend-screen opacity-50 animate-pulse-slow" />
      <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-brand-purple/20 rounded-full blur-[120px] mix-blend-screen opacity-50" />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="max-w-5xl mx-auto text-center z-10"
      >
        <motion.div variants={fadeUpStagger} className="mb-6 inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm text-sm text-brand-cyan">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-cyan opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-cyan" />
          </span>
          Now with React Server Components support
        </motion.div>

        <motion.h1
          variants={fadeUpStagger}
          className="text-6xl md:text-8xl font-extrabold tracking-tight text-white mb-8 text-balance"
        >
          Master Your <br />
          <span className="gradient-text">React Performance.</span>
        </motion.h1>

        <motion.p
          variants={fadeUpStagger}
          className="text-xl md:text-2xl text-surface-300 mb-12 max-w-3xl mx-auto text-balance leading-relaxed"
        >
          The most advanced DevTools extension for profiling React applications. Identify wasted renders, score memoization, and optimize RSC payloads in seconds.
        </motion.p>

        <motion.div variants={fadeUpStagger} className="flex flex-col sm:flex-row items-center justify-center gap-6">
          <MagneticButton className="h-14 px-8 text-lg font-semibold bg-brand-blue hover:bg-brand-blue/90 text-white">
            Download Extension
          </MagneticButton>
          
          <div className="flex flex-col items-start px-4">
            <div className="flex items-center gap-2 text-surface-400 text-sm font-medium">
              <span className="w-2 h-2 rounded-full bg-brand-amber animate-pulse" />
              Chrome Web Store
            </div>
            <span className="text-surface-500 text-xs">Coming Soon</span>
          </div>
        </motion.div>

        {/* Stunning Mockup */}
        <motion.div
          variants={fadeUp}
          className="mt-24 relative mx-auto max-w-5xl perspective-[1000px]"
        >
          <div className="absolute inset-0 bg-gradient-to-t from-surface-900 via-transparent to-transparent z-20 h-full w-full" />
          <motion.div 
            initial={{ rotateX: 20, y: 100, opacity: 0 }}
            animate={{ rotateX: 0, y: 0, opacity: 1 }}
            transition={{ duration: 1.2, ease: "easeOut", delay: 0.5 }}
            className="rounded-3xl border border-white/10 bg-surface-800/50 backdrop-blur-xl shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)] overflow-hidden relative"
          >
            <img 
              src="/react-perf-profiler/mockup.png" 
              alt="React Perf Profiler Dashboard" 
              className="w-full h-auto object-cover opacity-90 hover:opacity-100 transition-opacity duration-700"
            />
            {/* Glossy overlay effect */}
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-white/5 to-transparent mix-blend-overlay" />
          </motion.div>
          
          {/* Floating badges */}
          <motion.div 
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-12 -right-8 glass-card px-6 py-4 z-30 hidden lg:block"
          >
            <div className="text-brand-green text-sm font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              89% Wasted Renders Fixed
            </div>
          </motion.div>

          <motion.div 
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute top-1/2 -left-12 glass-card px-6 py-4 z-30 hidden lg:block"
          >
            <div className="text-brand-cyan text-sm font-bold flex items-center gap-2">
              <Terminal className="w-4 h-4" />
              60fps Target Achieved
            </div>
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  );
};
