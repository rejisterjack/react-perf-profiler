import { useState, useEffect } from 'react';
import { Button } from './ui/Button';
import { Menu, X, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Testimonials', href: '#testimonials' },
  { label: 'FAQ', href: '#faq' },
];

export function Navigation() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-surface-900/80 backdrop-blur-xl border-b border-white/5'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            {/* Logo */}
            <a href="/react-perf-profiler/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-brand-react flex items-center justify-center group-hover:scale-110 transition-transform">
                <Zap className="w-5 h-5 text-surface-900" />
              </div>
              <span className="font-bold text-lg tracking-tight text-white">
                React Perf Profiler
              </span>
            </a>

            {/* Desktop Nav */}
            <div className="hidden lg:flex items-center gap-8">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm text-surface-300 hover:text-white transition-colors relative group"
                >
                  {link.label}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-brand-react group-hover:w-full transition-all duration-300" />
                </a>
              ))}
            </div>

            {/* Desktop CTA */}
            <div className="hidden lg:flex items-center gap-3">
              <a href="https://github.com/rejisterjack/react-perf-profiler" target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm">
                  GitHub
                </Button>
              </a>
              <a href="#download">
                <Button variant="primary" size="sm">
                  Download
                </Button>
              </a>
            </div>

            {/* Mobile Menu Button */}
            <button type='button'
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </motion.nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-x-0 top-16 z-40 lg:hidden bg-surface-900/95 backdrop-blur-xl border-b border-white/5"
          >
            <div className="px-4 py-6 space-y-4">
              {NAV_LINKS.map((link) => (
                <button type='button'
                  key={link.href}
                  onClick={() => {
                    setMobileOpen(false);
                    window.location.href = link.href;
                  }}
                  className="block w-full text-left text-lg text-surface-200 hover:text-white py-2"
                >
                  {link.label}
                </button>
              ))}
              <div className="pt-4 border-t border-white/10 space-y-3">
                <a href="https://github.com/rejisterjack/react-perf-profiler" target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" className="w-full justify-center">GitHub</Button>
                </a>
                <a href="#download">
                  <Button variant="primary" className="w-full justify-center">Download Extension</Button>
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
