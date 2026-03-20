/**
 * ErrorBoundary Component
 * React class component that catches JavaScript errors in child components
 * and displays a fallback UI instead of crashing the panel
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Icon } from '../Common/Icon/Icon';
import { Button } from '../Common/Button/Button';
import { reloadPanel, reportError } from '@/panel/utils/errorRecovery';
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
}

interface ErrorBoundaryState {
  /** Whether an error has been caught */
  hasError: boolean;
  /** The error that was caught */
  error: Error | null;
  /** React error info containing component stack */
  errorInfo: ErrorInfo | null;
}

// =============================================================================
// Component
// =============================================================================

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Update state with error info
    this.setState({
      errorInfo,
    });

    // Log error to console for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Report error to analytics (if implemented)
    reportError(error, { componentStack: errorInfo.componentStack ?? undefined });

    // Call optional onError callback
    this.props.onError?.(error, errorInfo);
  }

  private handleReload = (): void => {
    reloadPanel();
  };

  private handleReportIssue = (): void => {
    const { error, errorInfo } = this.state;
    const title = encodeURIComponent(`[Bug] Error in React Perf Profiler: ${error?.message || 'Unknown error'}`);
    const body = encodeURIComponent(
      `## Error Description\n\n` +
      `**Error Message:** ${error?.message || 'No error message'}\n\n` +
      `**Stack Trace:**\n\`\`\`\n${error?.stack || 'No stack trace'}\n\`\`\`\n\n` +
      `**Component Stack:**\n\`\`\`\n${errorInfo?.componentStack || 'No component stack'}\n\`\`\`\n\n` +
      `## Steps to Reproduce\n\n` +
      `1. \n` +
      `2. \n` +
      `3. \n\n` +
      `## Expected Behavior\n\n` +
      `## Actual Behavior\n\n` +
      `## Environment\n\n` +
      `- Browser: \n` +
      `- React Version: \n` +
      `- Extension Version: 1.0.0\n`
    );
    
    window.open(
      `https://github.com/react-perf-profiler/react-perf-profiler/issues/new?title=${title}&body=${body}`,
      '_blank'
    );
  };

  override render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback, context } = this.props;

    if (!hasError) {
      return children;
    }

    // If custom fallback is provided, use it
    if (fallback) {
      return fallback;
    }

    // Default error UI
    return (
      <div className={styles["errorBoundary"]} role="alert" aria-live="assertive">
        <div className={styles["errorContent"]}>
          <div className={styles["errorIcon"]}>
            <Icon name="error" size={48} />
          </div>
          
          <h2 className={styles["errorTitle"]}>
            Something went wrong
          </h2>
          
          <p className={styles["errorMessage"]}>
            {context 
              ? `Something went wrong in the ${context}. Try reloading the panel.`
              : 'The profiler encountered an error. Your data has been saved.'
            }
          </p>

          {error && (
            <details className={styles["errorDetails"]}>
              <summary>Error details</summary>
              <div className={styles["errorDetailsContent"]}>
                <p className={styles["errorType"]}>{error.name}: {error.message}</p>
                {this.state.errorInfo?.componentStack && (
                  <pre className={styles["componentStack"]}>
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            </details>
          )}

          <div className={styles["errorActions"]}>
            <Button
              variant="primary"
              size="md"
              icon="refresh"
              onClick={this.handleReload}
            >
              Reload Panel
            </Button>
            <Button
              variant="secondary"
              size="md"
              icon="copy"
              onClick={this.handleReportIssue}
            >
              Report Issue
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
