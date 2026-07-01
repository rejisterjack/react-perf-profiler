'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ProfileClient } from '@repo/profile-contract/client';

type Mode = 'login' | 'signup';

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const client = new ProfileClient({
    baseUrl: process.env.NEXT_PUBLIC_SITE_URL ?? '',
  });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'signup') {
        await client.signUp(email, password, name);
      } else {
        await client.login(email, password);
      }
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-900 px-4">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="w-8 h-8 rounded-lg bg-brand-react flex items-center justify-center">
            <span className="text-surface-900 font-bold">⚡</span>
          </div>
          <span className="font-bold text-lg text-white">React Perf Profiler</span>
        </Link>

        <form
          onSubmit={onSubmit}
          className="bg-surface-800/50 backdrop-blur-xl border border-white/10 rounded-2xl p-8 space-y-5"
        >
          <h1 className="text-2xl font-bold text-white text-center">
            {mode === 'signup' ? 'Create your account' : 'Sign in'}
          </h1>

          {mode === 'signup' && (
            <div>
              <label htmlFor="name" className="block text-sm text-surface-300 mb-1.5">
                Name
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-11 px-3 rounded-lg bg-surface-900/60 border border-white/10 text-white placeholder:text-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-blue/50"
                autoComplete="name"
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm text-surface-300 mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-11 px-3 rounded-lg bg-surface-900/60 border border-white/10 text-white placeholder:text-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-blue/50"
              autoComplete="email"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm text-surface-300 mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-11 px-3 rounded-lg bg-surface-900/60 border border-white/10 text-white placeholder:text-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-blue/50"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />
            {mode === 'signup' && (
              <p className="text-xs text-surface-500 mt-1.5">
                Min 12 chars, with uppercase, lowercase, number, and special character.
              </p>
            )}
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-300"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full h-11 rounded-lg bg-brand-blue hover:bg-brand-blue/90 disabled:opacity-50 text-white font-semibold transition-all"
          >
            {busy ? '…' : mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>

          <p className="text-center text-sm text-surface-400">
            {mode === 'signup' ? (
              <>
                Already have an account?{' '}
                <a href="/login" className="text-brand-blue hover:text-brand-cyan">
                  Sign in
                </a>
              </>
            ) : (
              <>
                Need an account?{' '}
                <a href="/signup" className="text-brand-blue hover:text-brand-cyan">
                  Sign up
                </a>
              </>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}
