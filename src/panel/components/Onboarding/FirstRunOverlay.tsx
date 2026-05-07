/**
 * React Perf Profiler — First-Run Onboarding Overlay
 *
 * Shown once per browser profile after installation.
 * Persisted in chrome.storage.local under the key `onboarding_v1_seen`.
 *
 * The overlay walks the user through 4 steps:
 *  1. Welcome — what the tool does in one sentence
 *  2. Record   — click the Record button to start a session
 *  3. Analyse  — what happens after stopping
 *  4. Fix      — how to use AI suggestions + CI budgets
 *
 * After completing (or dismissing) the overlay, it never shows again.
 */

import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { t } from '@/shared/i18n';

// ─── Storage key ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'onboarding_v1_seen';

// ─── Step definitions ────────────────────────────────────────────────────────

interface Step {
  emoji: string;
  title: string;
  body: string;
  hint?: string;
}

const STEPS: Step[] = [
  {
    emoji: '⚡',
    title: 'Welcome to React Perf Profiler',
    body: 'This panel lives inside Chrome DevTools and tells you exactly which components are wasting renders — and the specific code change to fix each one.',
    hint: 'Works with React 16.5+, Next.js, Vite, Remix and more.',
  },
  {
    emoji: '🔴',
    title: 'Step 1 — Start recording',
    body: 'Click the Record button in the toolbar above, then interact with your app normally — scroll a feed, submit a form, open a modal. The profiler captures every render commit.',
    hint: 'Tip: Record for 5–10 seconds of a specific interaction rather than the whole page load.',
  },
  {
    emoji: '📊',
    title: 'Step 2 — Analyse wasted renders',
    body: 'Stop recording. The flamegraph highlights wasteful components in red. Click any component to see the exact prop that triggered the unnecessary re-render.',
    hint: 'The Memoization Scorer shows your React.memo hit rate and why it\'s failing.',
  },
  {
    emoji: '🤖',
    title: 'Step 3 — Get AI-powered fixes',
    body: 'Open the AI Suggestions panel and add your OpenAI, Anthropic, or local Ollama API key. The AI reads your profile and generates specific code changes — useCallback wrapping, context splits, RSC boundaries.',
    hint: 'Keys are stored locally in chrome.storage.local and never sent anywhere except the AI provider.',
  },
  {
    emoji: '🚀',
    title: 'You\'re all set!',
    body: 'You can also explore cloud sync for sharing profiles, team sessions for live collaboration, and CI/CD performance budgets from the toolbar. Check Settings for more options.',
    hint: 'Tip: Use keyboard shortcuts 1–4 to switch between tree, flamegraph, timeline, and analysis views.',
  },
];

// ─── Styles (inline — keeps this component self-contained) ───────────────────

const S = {
  backdrop: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.75)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '16px',
  },
  card: {
    background: '#1a1b26',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
    padding: '32px',
    width: '100%',
    maxWidth: '420px',
    fontFamily: 'system-ui, sans-serif',
    color: '#f8fafc',
    boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
  },
  emoji: {
    fontSize: '36px',
    marginBottom: '16px',
    display: 'block',
    textAlign: 'center' as const,
  },
  title: {
    fontSize: '17px',
    fontWeight: '700',
    textAlign: 'center' as const,
    marginBottom: '12px',
    color: '#f8fafc',
  },
  body: {
    fontSize: '13px',
    lineHeight: '1.6',
    color: '#94a3b8',
    textAlign: 'center' as const,
    marginBottom: '12px',
  },
  hint: {
    fontSize: '11px',
    color: '#475569',
    textAlign: 'center' as const,
    marginBottom: '24px',
    fontStyle: 'italic' as const,
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.05)',
  },
  dots: {
    display: 'flex',
    justifyContent: 'center',
    gap: '6px',
    marginBottom: '24px',
  },
  dot: (active: boolean) => ({
    width: active ? '20px' : '6px',
    height: '6px',
    borderRadius: '3px',
    background: active ? '#3b82f6' : 'rgba(255,255,255,0.15)',
    transition: 'all 0.2s ease',
  }),
  actions: {
    display: 'flex',
    gap: '10px',
  },
  skipBtn: {
    flex: 1,
    padding: '9px 16px',
    borderRadius: '9px',
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'transparent',
    color: '#64748b',
    fontSize: '13px',
    cursor: 'pointer',
    fontWeight: '500',
    transition: 'color 0.15s',
  },
  nextBtn: {
    flex: 2,
    padding: '9px 16px',
    borderRadius: '9px',
    border: 'none',
    background: '#3b82f6',
    color: '#fff',
    fontSize: '13px',
    cursor: 'pointer',
    fontWeight: '600',
    transition: 'background 0.15s',
  },
};

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Returns whether first-run onboarding should be shown.
 * Checks chrome.storage.local asynchronously — returns undefined while loading.
 */
function useOnboardingState(): {
  loading: boolean;
  show: boolean;
  markSeen: () => void;
} {
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // chrome.storage may not be available in unit test environments
    if (typeof chrome === 'undefined' || !chrome?.storage?.local) {
      setLoading(false);
      return;
    }

    chrome.storage.local.get([STORAGE_KEY, 'onboarding_completed_step'], (result) => {
      if (!result[STORAGE_KEY]) {
        setShow(true);
      }
      setLoading(false);
    });
  }, []);

  const markSeen = useCallback(() => {
    setShow(false);
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      chrome.storage.local.set({ [STORAGE_KEY]: true, onboarding_completed_step: true });
    }
  }, []);

  return { loading, show, markSeen };
}

// ─── Component ───────────────────────────────────────────────────────────────

export const FirstRunOverlay: React.FC = () => {
  const { loading, show, markSeen } = useOnboardingState();
  const [step, setStep] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const nextBtnRef = useRef<HTMLButtonElement>(null);

  const current = STEPS[step]!;
  const isLast = step === STEPS.length - 1;

  const handleNext = useCallback(() => {
    if (isLast) {
      markSeen();
    } else {
      setStep((s) => s + 1);
    }
  }, [isLast, markSeen]);

  // Focus the "Next" button when step changes so keyboard users stay in the dialog
  useEffect(() => {
    if (show && nextBtnRef.current) {
      nextBtnRef.current.focus();
    }
  }, [show]);

  // Trap focus within the dialog
  useEffect(() => {
    if (!show) return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        const focusable = dialog.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    dialog.addEventListener('keydown', handleKeyDown);
    return () => dialog.removeEventListener('keydown', handleKeyDown);
  }, [show]);

  if (loading || !show) return null;

  return (
    <div style={S.backdrop} role="dialog" aria-modal="true" aria-label={t('onboarding.step1.title')}>
      <div ref={dialogRef} style={S.card}>
        {/* Screen reader announcement for step changes */}
        <div aria-live="polite" aria-atomic="true" className="sr-only" style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          borderWidth: 0,
        }}>
          Step {step + 1} of {STEPS.length}. {current.title}. {current.body}
        </div>

        {/* Emoji */}
        <span style={S.emoji} aria-hidden="true">{current.emoji}</span>

        {/* Title */}
        <div style={S.title} id="onboarding-title">{current.title}</div>

        {/* Body */}
        <p style={S.body}>{current.body}</p>

        {/* Hint */}
        {current.hint && <div style={S.hint}>{current.hint}</div>}

        {/* Step dots */}
        <div style={S.dots} role="tablist" aria-label="Onboarding steps">
          {STEPS.map((s, i) => (
            <div
              key={i}
              style={S.dot(i === step)}
              role="tab"
              tabIndex={0}
              aria-selected={i === step}
              aria-label={t('onboarding.stepLabel', { number: String(i + 1), title: s.title })}
            />
          ))}
        </div>

        {/* Actions */}
        <div style={S.actions}>
          <button type="button" style={S.skipBtn} onClick={markSeen}>
            {t('onboarding.skip')}
          </button>
          <button type="button" ref={nextBtnRef} style={S.nextBtn} onClick={handleNext}>
            {isLast ? t('onboarding.getStarted') : t('onboarding.next')}
          </button>
        </div>
      </div>
    </div>
  );
};
