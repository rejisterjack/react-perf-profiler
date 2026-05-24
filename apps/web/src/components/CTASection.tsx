'use client';

import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { DownloadButton } from './DownloadButton';
import { ComingSoonBadge } from './ComingSoonBadge';
import { EmailCapture } from './EmailCapture';
import { Card } from './ui/Card';
import { Zap, ArrowDown } from 'lucide-react';

export function CTASection() {
  const ref = useScrollAnimation<HTMLDivElement>();

  return (
    <section id="download" ref={ref} className="py-24 lg:py-32">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Card glow className="p-10 lg:p-16 text-center relative overflow-hidden">
          {/* Background glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-brand-blue/10 rounded-full blur-[120px]" />

          <div className="relative z-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-react/10 text-brand-react mb-8">
              <Zap className="w-8 h-8" />
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 text-balance">
              Ready to optimize your{' '}
              <span className="gradient-text">React app?</span>
            </h2>

            <p className="text-lg text-surface-400 max-w-2xl mx-auto mb-10 text-balance">
              Download the extension now and start finding wasted renders in minutes.
              Your users (and your Lighthouse score) will thank you.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
              <DownloadButton browser="chrome" />
              <DownloadButton browser="firefox" variant="secondary" />
            </div>

            <div className="mb-10">
              <ComingSoonBadge />
            </div>

            <div className="max-w-md mx-auto">
              <div className="flex items-center gap-4 mb-6">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-sm text-surface-500">or</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>
              <EmailCapture />
            </div>

            <div className="mt-10 pt-8 border-t border-white/5">
              <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-surface-500">
                <span className="flex items-center gap-2">
                  <ArrowDown className="w-4 h-4 text-brand-green" />
                  Free & Open Source
                </span>
                <span className="flex items-center gap-2">
                  <ArrowDown className="w-4 h-4 text-brand-green" />
                  No signup required
                </span>
                <span className="flex items-center gap-2">
                  <ArrowDown className="w-4 h-4 text-brand-green" />
                  MIT Licensed
                </span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
