import { useState } from 'react';
import { Button } from './ui/Button';
import { Mail, Check, Bell, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * EmailCapture — notifies users when the extension lands on the Chrome Web Store.
 *
 * Backend options (configure one via environment variable):
 *
 *   Option A — Formspree (free tier, no server needed):
 *     Set VITE_FORMSPREE_ID=your_form_id in landing/.env
 *     Create a form at https://formspree.io and paste the form ID here.
 *
 *   Option B — Resend / custom endpoint:
 *     Set VITE_EMAIL_ENDPOINT=https://your-api.com/subscribe
 *
 *   Fallback: stores locally and logs to console (development only).
 */

const FORMSPREE_ID = import.meta.env.VITE_FORMSPREE_ID as string | undefined;
const CUSTOM_ENDPOINT = import.meta.env.VITE_EMAIL_ENDPOINT as string | undefined;

async function submitEmail(email: string): Promise<void> {
  // Option A: Formspree
  if (FORMSPREE_ID) {
    const res = await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, source: 'launch-notify' }),
    });
    if (!res.ok) throw new Error('Formspree submit failed');
    return;
  }

  // Option B: Custom endpoint
  if (CUSTOM_ENDPOINT) {
    const res = await fetch(CUSTOM_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, source: 'launch-notify' }),
    });
    if (!res.ok) throw new Error('Endpoint submit failed');
    return;
  }

  // Fallback: persist locally (useful in dev / before backend is wired)
  const existing: string[] = JSON.parse(
    localStorage.getItem('rpp-notify-emails') ?? '[]'
  );
  if (!existing.includes(email)) {
    localStorage.setItem('rpp-notify-emails', JSON.stringify([...existing, email]));
  }
}

export function EmailCapture() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'submitted' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || status === 'loading') return;
    setStatus('loading');
    setErrorMsg('');
    try {
      await submitEmail(email);
      setStatus('submitted');
      setEmail('');
    } catch {
      setStatus('error');
      setErrorMsg('Something went wrong. Please try again.');
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <AnimatePresence mode="wait">
        {status === 'submitted' ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-brand-green/10 border border-brand-green/20 text-brand-green"
          >
            <Check className="w-5 h-5 shrink-0" />
            <span className="font-medium">You will be notified when we launch on the Web Store!</span>
          </motion.div>
        ) : (
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
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (status === 'error') setStatus('idle');
                }}
                placeholder="Enter your email"
                required
                disabled={status === 'loading'}
                className="w-full pl-10 pr-4 py-3 bg-surface-700/50 border border-white/10 rounded-xl text-white placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-brand-blue/30 transition-all disabled:opacity-60"
              />
            </div>
            <Button
              type="submit"
              variant="secondary"
              size="md"
              icon={status === 'loading' ? undefined : <Bell className="w-4 h-4" />}
              className="whitespace-nowrap"
              disabled={status === 'loading'}
            >
              {status === 'loading' ? 'Submitting…' : 'Get Notified'}
            </Button>
          </motion.form>
        )}
      </AnimatePresence>

      {status === 'error' && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-1.5 text-red-400 text-xs mt-2"
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {errorMsg}
        </motion.p>
      )}

      {status !== 'submitted' && (
        <p className="text-center text-xs text-surface-500 mt-3">
          No spam. One email when the extension goes live on the Web Store.
        </p>
      )}
    </div>
  );
}
