/**
 * React Perf Profiler — Error Boundary
 *
 * Catches runtime errors in the DevTools panel and renders a recovery UI
 * instead of a blank screen. Supports three display modes:
 *
 *  - full   : Full-page recovery (used at the root of the panel)
 *  - compact: Inline recovery chip (used for individual sub-panels)
 *  - silent : Renders null on error — for non-critical decorative sections
 *
 * Usage:
 *   <ErrorBoundary context="flamegraph" compact>
 *     <Flamegraph />
 *   </ErrorBoundary>
 */

import type React from 'react';
import { Component } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ErrorBoundaryProps {
  /** Human-readable name used in error messages (e.g. "flamegraph", "toolbar") */
  context?: string;
  /** If true, renders an inline compact fallback instead of a full-page overlay */
  compact?: boolean;
  /** If true, renders nothing on error — for non-critical UI sections */
  silent?: boolean;
  /** Optional callback fired when an error is caught */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** Custom fallback to render instead of the default UI */
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  /** How many times "Try again" has been clicked in this boundary */
  retryCount: number;
}

// ─── Styles (inline — avoids CSS module import in error path) ────────────────

const STYLES = {
  full: {
    container: {
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      minHeight: '200px',
      padding: '24px',
      background: 'var(--color-surface-900, #0f0f13)',
      color: 'var(--color-text-primary, #f8fafc)',
      fontFamily: 'system-ui, sans-serif',
    },
    icon: {
      width: '48px',
      height: '48px',
      borderRadius: '50%',
      background: 'rgba(239,68,68,0.1)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: '16px',
      color: '#f87171',
      fontSize: '22px',
    },
    title: {
      fontSize: '16px',
      fontWeight: '600',
      marginBottom: '8px',
      color: '#f8fafc',
    },
    message: {
      fontSize: '13px',
      color: '#94a3b8',
      textAlign: 'center' as const,
      maxWidth: '400px',
      lineHeight: '1.5',
      marginBottom: '20px',
    },
    actions: {
      display: 'flex',
      gap: '10px',
      flexWrap: 'wrap' as const,
      justifyContent: 'center',
    },
    button: {
      padding: '8px 16px',
      borderRadius: '8px',
      border: '1px solid rgba(255,255,255,0.1)',
      background: 'rgba(255,255,255,0.06)',
      color: '#f8fafc',
      fontSize: '13px',
      cursor: 'pointer',
      fontWeight: '500',
    },
    primaryButton: {
      padding: '8px 16px',
      borderRadius: '8px',
      border: 'none',
      background: '#3b82f6',
      color: '#fff',
      fontSize: '13px',
      cursor: 'pointer',
      fontWeight: '600',
    },
    details: {
      marginTop: '20px',
      width: '100%',
      maxWidth: '480px',
    },
    summary: {
      fontSize: '12px',
      color: '#64748b',
      cursor: 'pointer',
    },
    pre: {
      marginTop: '8px',
      padding: '10px',
      borderRadius: '6px',
      background: 'rgba(0,0,0,0.3)',
      border: '1px solid rgba(255,255,255,0.06)',
      fontSize: '11px',
      color: '#94a3b8',
      whiteSpace: 'pre-wrap' as const,
      wordBreak: 'break-word' as const,
      overflowY: 'auto' as const,
      maxHeight: '120px',
      fontFamily: 'monospace',
    },
  },
  compact: {
    container: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 12px',
      borderRadius: '8px',
      background: 'rgba(239,68,68,0.08)',
      border: '1px solid rgba(239,68,68,0.2)',
      color: '#fca5a5',
      fontSize: '12px',
      fontFamily: 'system-ui, sans-serif',
    },
    button: {
      marginLeft: 'auto',
      padding: '3px 10px',
      borderRadius: '5px',
      border: 'none',
      background: 'rgba(239,68,68,0.2)',
      color: '#fca5a5',
      fontSize: '11px',
      cursor: 'pointer',
    },
  },
} as const;

// ─── Component ───────────────────────────────────────────────────────────────

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // Cannot use `override` on class field initialisers — React's Component
  // base class declares `state` as a property, not a method.
  declare state: ErrorBoundaryState;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({ errorInfo });

    // Fire optional callback
    this.props.onError?.(error, errorInfo);

    // Log to console in all environments — the panel has no external monitor
    console.error(
      `[React Perf Profiler] Uncaught error in <${this.props.context ?? 'unknown'}>:`,
      error,
      errorInfo
    );
  }

  private handleRetry = (): void => {
    this.setState((prev) => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prev.retryCount + 1,
    }));
  };

  private handleReload = (): void => {
    // The DevTools panel lives in a chrome-extension:// page — we can reload it
    // the same way we'd reload a regular page.
    window.location.reload();
  };

  private copyError = (): void => {
    const { error, errorInfo } = this.state;
    const text = [
      `Error: ${error?.message ?? 'Unknown'}`,
      `Stack:\n${error?.stack ?? ''}`,
      `Component stack:\n${errorInfo?.componentStack ?? ''}`,
    ].join('\n\n');
    void navigator.clipboard.writeText(text);
  };

  // ─── Render helpers ───────────────────────────────────────────────────────

  private renderFull(): React.ReactNode {
    const { context } = this.props;
    const { error, errorInfo, retryCount } = this.state;
    const s = STYLES.full;

    return (
      <div style={s.container} role="alert" aria-live="assertive">
        <div style={s.icon}>⚠</div>
        <div style={s.title}>Something went wrong</div>
        <p style={s.message}>
          {context ? `The "${context}" panel crashed. ` : ''}
          {retryCount < 3
            ? 'This is likely a transient error — try refreshing the panel.'
            : 'The panel has failed multiple times. Reloading the DevTools may help.'}
        </p>

        <div style={s.actions}>
          {retryCount < 3 ? (
            <button type="button" style={s.primaryButton} onClick={this.handleRetry}>
              Try again
            </button>
          ) : (
            <button type="button" style={s.primaryButton} onClick={this.handleReload}>
              Reload panel
            </button>
          )}
          <button type="button" style={s.button} onClick={this.copyError}>
            Copy error
          </button>
          <a
            href="https://github.com/rejisterjack/react-perf-profiler/issues/new?labels=bug&template=bug_report.md"
            target="_blank"
            rel="noopener noreferrer"
            style={s.button as React.CSSProperties}
          >
            Report issue
          </a>
        </div>

        {error && (
          <details style={s.details}>
            <summary style={s.summary as React.CSSProperties}>Error details</summary>
            <pre style={s.pre}>
              {error.message}
              {'\n\n'}
              {error.stack}
              {errorInfo?.componentStack ? `\n\nComponent stack:${errorInfo.componentStack}` : ''}
            </pre>
          </details>
        )}
      </div>
    );
  }

  private renderCompact(): React.ReactNode {
    const { context } = this.props;
    const s = STYLES.compact;

    return (
      <div style={s.container} role="alert">
        <span>⚠</span>
        <span>{context ? `${context} failed` : 'Panel error'}</span>
        <button type="button" style={s.button} onClick={this.handleRetry}>
          Retry
        </button>
      </div>
    );
  }

  override render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    // Custom fallback takes highest priority
    if (this.props.fallback) {
      return this.props.fallback;
    }

    // Silent mode — render nothing
    if (this.props.silent) {
      return null;
    }

    // Compact mode — inline chip
    if (this.props.compact) {
      return this.renderCompact();
    }

    // Full mode — centre-page error card
    return this.renderFull();
  }
}
