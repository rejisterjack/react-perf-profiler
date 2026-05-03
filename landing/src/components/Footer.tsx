import { Zap, Github, BookOpen, Shield, Heart, ExternalLink } from 'lucide-react';

type FooterLink = {
  label: string;
  href: string;
  external?: boolean;
};

const FOOTER_LINKS: Record<string, FooterLink[]> = {
  Product: [
    { label: 'Features', href: '#features' },
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'Testimonials', href: '#testimonials' },
    { label: 'FAQ', href: '#faq' },
  ],
  Resources: [
    { label: 'Documentation', href: 'https://github.com/rejisterjack/react-perf-profiler#readme', external: true },
    { label: 'GitHub', href: 'https://github.com/rejisterjack/react-perf-profiler', external: true },
    { label: 'Changelog', href: 'https://github.com/rejisterjack/react-perf-profiler/blob/main/CHANGELOG.md', external: true },
    { label: 'Contributing', href: 'https://github.com/rejisterjack/react-perf-profiler/blob/main/CONTRIBUTING.md', external: true },
  ],
  Legal: [
    { label: 'Privacy Policy', href: 'https://rejisterjack.github.io/react-perf-profiler/', external: true },
    { label: 'Security', href: 'https://github.com/rejisterjack/react-perf-profiler/blob/main/SECURITY.md', external: true },
    { label: 'License', href: 'https://github.com/rejisterjack/react-perf-profiler/blob/main/LICENSE', external: true },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-white/5 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <a href="/react-perf-profiler/" className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-brand-react flex items-center justify-center">
                <Zap className="w-5 h-5 text-surface-900" />
              </div>
              <span className="font-bold text-white">React Perf Profiler</span>
            </a>
            <p className="text-sm text-surface-500 leading-relaxed">
              The React performance profiler that finds your wasted renders and tells you exactly what to fix.
            </p>
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
            MIT License. Open source and free forever.
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
