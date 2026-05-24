'use client';

import { Zap, Github, BookOpen, Shield, Heart, ExternalLink } from 'lucide-react';

type FooterLink = {
  label: string;
  href: string;
  external?: boolean;
};

const FOOTER_LINKS: Record<string, FooterLink[]> = {
  Product: [
    { label: 'Features', href: '#features' },
    { label: 'All Features', href: '#all-features' },
    { label: 'How It Works', href: '#demo' },
    { label: 'Compare', href: '#comparison' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'FAQ', href: '#faq' },
  ],
  Resources: [
    {
      label: 'Documentation',
      href: 'https://github.com/rejisterjack/react-perf-profiler#readme',
      external: true,
    },
    {
      label: 'GitHub',
      href: 'https://github.com/rejisterjack/react-perf-profiler',
      external: true,
    },
    {
      label: 'Changelog',
      href: 'https://github.com/rejisterjack/react-perf-profiler/blob/main/CHANGELOG.md',
      external: true,
    },
    {
      label: 'Contributing',
      href: 'https://github.com/rejisterjack/react-perf-profiler/blob/main/CONTRIBUTING.md',
      external: true,
    },
    {
      label: 'Plugin Development',
      href: 'https://github.com/rejisterjack/react-perf-profiler/blob/main/docs/PLUGIN_DEVELOPMENT.md',
      external: true,
    },
    {
      label: 'Architecture',
      href: 'https://github.com/rejisterjack/react-perf-profiler/blob/main/docs/ARCHITECTURE.md',
      external: true,
    },
  ],
  Legal: [
    {
      label: 'Privacy Policy',
      href: 'https://rejisterjack.github.io/react-perf-profiler/',
      external: true,
    },
    {
      label: 'Security',
      href: 'https://github.com/rejisterjack/react-perf-profiler/blob/main/SECURITY.md',
      external: true,
    },
    {
      label: 'License (MIT)',
      href: 'https://github.com/rejisterjack/react-perf-profiler/blob/main/LICENSE',
      external: true,
    },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-white/5 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 lg:gap-12 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-2">
            <a href="/react-perf-profiler/" className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-brand-react flex items-center justify-center">
                <Zap className="w-5 h-5 text-surface-900" />
              </div>
              <span className="font-bold text-white">React Perf Profiler</span>
            </a>
            <p className="text-sm text-surface-500 leading-relaxed mb-4">
              The React performance profiler that finds your wasted renders and tells you exactly what to fix.
            </p>
            <p className="text-xs text-surface-600">
              v1.0.0 · MIT License · Open source and free forever
            </p>

            {/* Quick download */}
            <div className="mt-5 flex gap-2 flex-wrap">
              <a
                href="./downloads/react-perf-profiler-chrome.zip"
                download="react-perf-profiler-chrome.zip"
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-brand-blue/15 text-brand-blue hover:bg-brand-blue/25 border border-brand-blue/20 transition-all"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C8.21 0 4.831 1.757 2.632 4.501l3.923 6.817C7.023 8.478 9.352 7 12 7c3.923 0 7.153 2.773 7.9 6.453l4.638-8.027C22.401 2.158 17.448 0 12 0z"/>
                </svg>
                Chrome ZIP
              </a>
              <a
                href="./downloads/react-perf-profiler-firefox.zip"
                download="react-perf-profiler-firefox.zip"
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-surface-700/60 text-surface-300 hover:bg-surface-600/60 border border-white/10 transition-all"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93z"/>
                </svg>
                Firefox ZIP
              </a>
            </div>
          </div>

          {/* Links */}
          {Object.entries(FOOTER_LINKS).map(([category, links]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold text-white mb-4">{category}</h3>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      target={link.external ? '_blank' : undefined}
                      rel={link.external ? 'noopener noreferrer' : undefined}
                      className="text-sm text-surface-400 hover:text-white transition-colors inline-flex items-center gap-1 group"
                    >
                      {link.label}
                      {link.external && (
                        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-surface-500">
            MIT License · Open source and free forever.
          </p>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/rejisterjack/react-perf-profiler"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-surface-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
              aria-label="GitHub"
            >
              <Github className="w-5 h-5" />
            </a>
            <a
              href="https://github.com/rejisterjack/react-perf-profiler#readme"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-surface-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
              aria-label="Documentation"
            >
              <BookOpen className="w-5 h-5" />
            </a>
            <a
              href="https://rejisterjack.github.io/react-perf-profiler/"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-surface-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
              aria-label="Privacy Policy"
            >
              <Shield className="w-5 h-5" />
            </a>
          </div>
        </div>

        <p className="text-center text-xs text-surface-600 mt-8 flex items-center justify-center gap-1">
          Built with <Heart className="w-3 h-3 text-brand-red" /> for the React community
        </p>
      </div>
    </footer>
  );
}
