'use client';

import { Sparkles } from 'lucide-react';

export function ComingSoonBadge() {
  return (
    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-amber/10 border border-brand-amber/20 text-brand-amber text-sm font-medium">
      <Sparkles className="w-4 h-4 animate-pulse" />
      <span>Coming Soon to Chrome Web Store</span>
    </div>
  );
}
