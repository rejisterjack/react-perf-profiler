'use client';

import { useState, useCallback } from 'react';
import { Button } from './ui/Button';
import { Check, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DownloadButtonProps {
  browser: 'chrome' | 'firefox';
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const BROWSER_CONFIG = {
  chrome: {
    label: 'Download for Chrome',
    file: 'react-perf-profiler-chrome.zip',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C8.21 0 4.831 1.757 2.632 4.501l3.923 6.817C7.023 8.478 9.352 7 12 7c3.923 0 7.153 2.773 7.9 6.453l7.58-13.112C25.098 1.439 20.269 0 12 0zM2.122 5.254C.781 7.381 0 9.837 0 12.5c0 3.073.942 5.933 2.553 8.312l6.782-11.748C8.553 7.716 8.004 6.935 7.321 6.308L2.122 5.254zm13.232 15.496c-1.288.68-2.762 1.05-4.354 1.05-3.529 0-6.518-2.164-7.755-5.217l-6.757 11.705C1.812 23.408 4.179 24 7.012 24c4.489 0 8.399-2.283 10.683-5.748l-2.341-2.502zm9.644-10.25c.048-.5.074-1.007.074-1.522 0-2.556-.667-4.953-1.835-7.039l-6.917 11.981c.453.707.779 1.524.934 2.408l7.744-5.828z"/>
      </svg>
    ),
  },
  firefox: {
    label: 'Download for Firefox',
    file: 'react-perf-profiler-firefox.zip',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
      </svg>
    ),
  },
};

export function DownloadButton({ browser, variant = 'primary', size = 'lg', className }: DownloadButtonProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'downloaded'>('idle');
  const config = BROWSER_CONFIG[browser];

  const handleDownload = useCallback(() => {
    setStatus('loading');

    // Track download event with Plausible
    if (typeof window !== 'undefined' && (window as any).plausible) {
      (window as any).plausible('Download', { props: { browser } });
    }

    setTimeout(() => {
      const link = document.createElement('a');
      link.href = `./downloads/${config.file}`;
      link.download = config.file;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setStatus('downloaded');
    }, 800);
  }, [config.file, browser]);

  return (
    <div className="flex flex-col items-center gap-3">
      <Button
        variant={variant}
        size={size}
        onClick={handleDownload}
        disabled={status !== 'idle'}
        className={`min-w-[260px] ${className || ''}`}
        icon={
          <AnimatePresence mode="wait">
            {status === 'idle' && <motion.span key="download" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{config.icon}</motion.span>}
            {status === 'loading' && <motion.span key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><Loader2 className="w-5 h-5 animate-spin" /></motion.span>}
            {status === 'downloaded' && <motion.span key="check" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}><Check className="w-5 h-5" /></motion.span>}
          </AnimatePresence>
        }
      >
        <AnimatePresence mode="wait">
          {status === 'idle' && <motion.span key="label" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{config.label}</motion.span>}
          {status === 'loading' && <motion.span key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>Downloading...</motion.span>}
          {status === 'downloaded' && <motion.span key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>Downloaded!</motion.span>}
        </AnimatePresence>
      </Button>
    </div>
  );
}
