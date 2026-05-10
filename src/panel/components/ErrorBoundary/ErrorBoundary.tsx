/**
 * ErrorBoundary Component
 * React class component that catches JavaScript errors in child components
 * and displays a fallback UI instead of crashing the panel
 */

import { Component, createRef, type ErrorInfo, type ReactNode } from 'react';
import { clearLastError, reloadPanel, reportError, resetPanel } from '@/panel/utils/errorRecovery';
import { GENERIC_ISSUE_REPORT_URL, GITHUB_REPO_URL } from '@/shared/constants';
import { t } from '@/shared/i18n';
import { logger, ErrorSeverity, ErrorCodes, createProfiledError } from '@/shared/logger';
import { captureException } from '@/shared/telemetry/sentry';
import { Button } from '../Common/Button/Button';
import { Icon } from '../Common/Icon/Icon';
import styles from './ErrorBoundary.module.css';

// =============================================================================
// Types & Interfaces
// =============================================================================

export interface ErrorBoundaryProps {
  /** Child components to render inside the error boundary */
  children: ReactNode;
  /** Optional custom fallback UI to render when an error occurs */
  fallback?: ReactNode;
  /** Optional callback when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Context name for the error message (e.g., "Component Tree", "Timeline") */
  context?: string;
  /** Whether to show the reset button (clears all data) */
  showReset?: boolean;
  /** Whether to use compact mode (for smaller areas like sidebar) */
  compact?: boolean;
}

interface ErrorBoundaryState {
  /** Whether an error has been caught */
  hasError: boolean;
  /** The error that was caught */
  error: Error | null;
  /** React error info containing component stack */
  errorInfo: ErrorInfo | null;
  /** Whether error details are expanded */
  detailsExpanded: boolean;
  /** Error ID for tracking */
  errorId: string;
  /** Whether the reset confirmation modal is open */
  showResetConfirm: boolean;
}

// =============================================================================
// Component
// =============================================================================

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private cancelButtonRef = createRef<HTMLButtonElement>();
  private resetButtonRef = createRef<HTMLButtonElement>();

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      detailsExpanded: false,
      errorId: '',
      showResetConfirm: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorId: `err_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Update state with error info
    this.setState({
      errorInfo,
    });

    // Log error for debugging
    logger.error('ErrorBoundary caught an error', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      context: this.props.context,
      errorId: this.state.errorId,
      source: 'ErrorBoundary',
    });

    // Report error to analytics
    reportError(error, {
      componentStack: errorInfo.componentStack ?? undefined,
      context: this.props.context,
      errorId: this.state.errorId,
    });

    // Report to Sentry (if enabled)
    captureException(error, {
      context: this.props.context ?? 'unknown',
      errorId: this.state.errorId,
    });

    // Create a ProfiledError for structured tracking
    const profiledError = createProfiledError(
      ErrorCodes.E_UNKNOWN,
      ErrorSeverity.ERROR,
      error.message || 'An unexpected error occurred',
      {
        context: { context: this.props.context, errorId: this.state.errorId },
        recoverable: true,
        recoveryActions: [
          { label: 'Reload Panel', action: 'reload' },
          { label: 'Reset Data', action: 'reset' },
        ],
      },
    );
    logger.error('ProfiledError created', {
      code: profiledError.code,
      severity: profiledError.severity,
      errorId: profiledError.id,
      source: 'ErrorBoundary',
    });

    // Call optional onError callback
    this.props.onError?.(error, errorInfo);
  }

  private handleReload = (): void => {
    clearLastError();
    reloadPanel();
  };

  private handleResetClick = (): void => {
    this.setState({ showResetConfirm: true });
  };

  private handleResetConfirm = (): void => {
    clearLastError();
    resetPanel();
    this.setState({ showResetConfirm: false });
  };

  private handleResetCancel = (): void => {
    this.setState({ showResetConfirm: false });
  };

  private handleRetry = (): void => {
    // Clear the error state and try to re-render
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
    });
  };

  private handleToggleDetails = (): void => {
    this.setState((prev) => ({
      detailsExpanded: !prev.detailsExpanded,
    }));
  };

  private handleReportIssue = (): void => {
    const { error, errorInfo, errorId } = this.state;
    const title = encodeURIComponent(
      `[Bug] Error in React Perf Profiler: ${error?.message || 'Unknown error'}`
    );
    const body = encodeURIComponent(
      `## Error Description\n\n**Error ID:** ${errorId}\n**Error Message:** ${error?.message || 'No error message'}\n\n**Stack Trace:**\n\`\`\`\n${error?.stack || 'No stack trace'}\n\`\`\`\n\n**Component Stack:**\n\`\`\`\n${errorInfo?.componentStack || 'No component stack'}\n\`\`\`\n\n**Context:** ${this.props.context || 'Unknown'}\n\n## Steps to Reproduce\n\n1. \n2. \n3. \n\n## Expected Behavior\n\n## Actual Behavior\n\n## Environment\n\n- Browser: ${navigator.userAgent}\n- URL: ${window.location.href}\n- Extension Version: ${import.meta.env?.['VITE_APP_VERSION'] || '1.0.0'}\n`
    );

    // Use configurable GitHub URL with fallback
    const baseUrl = GITHUB_REPO_URL;
    const isValidGithubUrl = baseUrl.includes('github.com');

    if (isValidGithubUrl) {
      window.open(`${baseUrl}/issues/new?title=${title}&body=${body}`, '_blank');
    } else {
      // Fallback to generic support URL
      logger.warn('GitHub URL not configured, redirecting to support page', {
        source: 'ErrorBoundary',
        fallbackUrl: GENERIC_ISSUE_REPORT_URL,
      });
      window.open(GENERIC_ISSUE_REPORT_URL, '_blank');
    }
  };

  private handleCopyError = async (): Promise<void> => {
    const { error, errorInfo, errorId } = this.state;
    const errorText = `[${errorId}] ${error?.name}: ${error?.message}\n\nStack:\n${error?.stack}\n\nComponent Stack:\n${errorInfo?.componentStack}`;

    try {
      await navigator.clipboard.writeText(errorText);
      // Could show a toast here
    } catch {
      // Fallback: select and copy manually
      logger.warn('Failed to copy error to clipboard', { errorId, source: 'ErrorBoundary' });
    }
  };

  override render(): ReactNode {
    const { hasError, error, errorInfo, detailsExpanded, errorId, showResetConfirm } = this.state;
    const { children, fallback, context, showReset = true, compact = false } = this.props;

    if (!hasError) {
      return children;
    }

    // If custom fallback is provided, use it
    if (fallback) {
      return fallback;
    }

    const containerClass = compact ? styles['compact'] : '';

    // Default error UI
    return (
      <div
        className={`${styles['errorBoundary']} ${containerClass}`}
        role="alert"
        aria-live="assertive"
      >
        <div className={styles['errorContent']}>
          <div className={styles['errorIcon']}>
            <Icon name="error" size={compact ? 32 : 48} />
          </div>

          <h2 className={styles['errorTitle']}>
            {compact ? t('errorBoundary.title') : 'Oops! Something went wrong'}
          </h2>

          <p className={styles['errorMessage']}>
            {context
              ? `An error occurred in ${context}. Don't worry - your profiling data is safe.`
              : 'The profiler encountered an unexpected error. Your data has been preserved.'}
          </p>

          {error && (
            <details
              className={styles['errorDetails']}
              open={detailsExpanded}
              onToggle={this.handleToggleDetails}
            >
              <summary>
                Error Details {errorId && <span className={styles['errorId']}>ID: {errorId}</span>}
              </summary>
              <div className={styles['errorDetailsContent']}>
                <button
                  type="button"
                  className={styles['errorType']}
                  onClick={this.handleCopyError}
                >
                  <span>
                    {error.name}: {error.message}
                  </span>
                  <Icon name="copy" size={14} className={styles['copyIcon']} />
                </button>
                {errorInfo?.componentStack && (
                  <pre className={styles['componentStack']}>{errorInfo.componentStack}</pre>
                )}
                {error.stack && <pre className={styles['stackTrace']}>{error.stack}</pre>}
              </div>
            </details>
          )}

          <div className={styles['errorActions']}>
            <Button
              variant="primary"
              size={compact ? 'sm' : 'md'}
              icon="refresh"
              onClick={this.handleReload}
              title="Reload the panel to recover from this error"
            >
              Reload Panel
            </Button>
            {!compact && (
              <Button
                variant="secondary"
                size="md"
                icon="play"
                onClick={this.handleRetry}
                title="Try to continue without reloading"
              >
                Try Again
              </Button>
            )}
            {showReset && (
              <Button
                ref={this.resetButtonRef}
                variant="danger"
                size={compact ? 'sm' : 'md'}
                icon="trash"
                onClick={this.handleResetClick}
                title="Clear all data and reset the panel (use as last resort)"
              >
                Reset
              </Button>
            )}
          </div>

          <div className={styles['secondaryActions']}>
            <button type="button" className={styles['reportLink']} onClick={this.handleReportIssue}>
              <Icon name="warning" size={14} />
              Report this issue on GitHub
            </button>
          </div>
        </div>

        {/* Reset Confirmation Modal */}
        {showResetConfirm && (
          <div
            className={styles['modalOverlay']}
            onClick={this.handleResetCancel}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                this.handleResetCancel();
              }
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-confirm-title"
          >
            <div className={styles['modalContent']}>
              <h3 id="reset-confirm-title" className={styles['modalTitle']}>
                Confirm Reset
              </h3>
              <p className={styles['modalMessage']}>
                This will clear all profiler data and reset the panel. This action cannot be undone.
              </p>
              <div className={styles['modalActions']}>
                <Button
                  ref={this.cancelButtonRef}
                  variant="secondary"
                  size="md"
                  onClick={this.handleResetCancel}
                >
                  Cancel
                </Button>
                <Button variant="danger" size="md" icon="trash" onClick={this.handleResetConfirm}>
                  Reset Panel
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
}

export default ErrorBoundary;