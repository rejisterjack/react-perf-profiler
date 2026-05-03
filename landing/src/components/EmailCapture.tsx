import { useState } from 'react';
import { Button } from './ui/Button';
import { Mail, Check, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function EmailCapture() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitted'>('idle');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    // Store in localStorage for demo purposes
    const existing = JSON.parse(localStorage.getItem('rpp-notify-emails') || '[]');
    localStorage.setItem('rpp-notify-emails', JSON.stringify([...existing, email]));
    setStatus('submitted');
    setEmail('');
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <AnimatePresence mode="wait">
        {status === 'idle' ? (
          <motion.form
            key="form"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onSubmit={handleSubmit}
            className="flex flex-col sm:flex-row gap-3"
          >
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                className="w-full pl-10 pr-4 py-3 bg-surface-700/50 border border-white/10 rounded-xl text-white placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-brand-blue/30 transition-all"
              />
            </div>
            <Button
              type="submit"
              variant="secondary"
              size="md"
              icon={<Bell className="w-4 h-4" />}
              className="whitespace-nowrap"
            >
              Get Notified
            </Button>
          </motion.form>
        ) : (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-brand-green/10 border border-brand-green/20 text-brand-green"
          >
            <Check className="w-5 h-5" />
            <span className="font-medium">You will be notified when we launch!</span>
          </motion.div>
        )}
      </AnimatePresence>
      <p className="text-center text-xs text-surface-400 mt-3">
        No spam. We will only email when the extension is live.
      </p>
    </div>
  );
}
