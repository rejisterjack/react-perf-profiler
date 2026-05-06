import { motion } from 'framer-motion';
import { Terminal, CheckCircle2, Download, Github } from 'lucide-react';
import { fadeUp, fadeUpStagger, containerVariants } from '../lib/motion';

export const Hero = () => {
  const handleDownload = (browser: 'chrome' | 'firefox') => {
    const files: Record<string, string> = {
      chrome: './downloads/react-perf-profiler-chrome.zip',
      firefox: './downloads/react-perf-profiler-firefox.zip',
    };
    const link = document.createElement('a');
    link.href = files[browser];
    link.download = `react-perf-profiler-${browser}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
          Now with React Server Components &amp; AI Suggestions
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

        <motion.div variants={fadeUpStagger} className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
          <button
            type="button"
            onClick={() => handleDownload('chrome')}
            className="inline-flex items-center gap-3 h-14 px-8 text-lg font-semibold bg-brand-blue hover:bg-brand-blue/90 text-white rounded-xl transition-all duration-200 shadow-lg shadow-brand-blue/25 hover:shadow-brand-blue/40 hover:scale-[1.02]"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C8.21 0 4.831 1.757 2.632 4.501l3.923 6.817C7.023 8.478 9.352 7 12 7c3.923 0 7.153 2.773 7.9 6.453l4.638-8.027C22.401 2.158 17.448 0 12 0zM2.122 5.254C.781 7.381 0 9.837 0 12.5c0 3.073.942 5.933 2.553 8.312l6.782-11.748C8.553 7.716 8.004 6.935 7.321 6.308L2.122 5.254zm13.232 15.496c-1.288.68-2.762 1.05-4.354 1.05-3.529 0-6.518-2.164-7.755-5.217L-.512 26.788C1.812 29.408 6.679 31 12 31c4.489 0 8.399-2.283 10.683-5.748l-7.329-4.502zm9.644-10.25c.048-.5.074-1.007.074-1.522 0-2.556-.667-4.953-1.835-7.039l-6.917 11.981c.453.707.779 1.524.934 2.408l7.744-5.828z"/>
            </svg>
            Download for Chrome
          </button>

          <button
            type="button"
            onClick={() => handleDownload('firefox')}
            className="inline-flex items-center gap-3 h-14 px-8 text-lg font-semibold bg-surface-700 hover:bg-surface-600 text-white rounded-xl border border-white/10 transition-all duration-200 hover:scale-[1.02]"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
            </svg>
            Download for Firefox
          </button>

          <a
            href="https://github.com/rejisterjack/react-perf-profiler"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 h-14 px-6 text-base font-medium text-surface-300 hover:text-white rounded-xl border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all duration-200"
          >
            <Github className="w-5 h-5" />
            GitHub
          </a>
        </motion.div>

        <motion.div variants={fadeUpStagger} className="flex flex-wrap items-center justify-center gap-6 text-sm text-surface-500 mb-4">
          <span className="flex items-center gap-1.5">
            <Download className="w-4 h-4 text-brand-green" />
            Free &amp; Open Source
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-brand-green" />
            No signup required
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-brand-green" />
            MIT Licensed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-brand-amber animate-pulse" />
            Chrome Web Store listing coming soon
          </span>
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
            transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
            className="absolute -top-12 -right-8 glass-card px-6 py-4 z-30 hidden lg:block"
          >
            <div className="text-brand-green text-sm font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              89% Wasted Renders Fixed
            </div>
          </motion.div>

          <motion.div 
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut", delay: 1 }}
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
