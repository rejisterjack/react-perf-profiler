/**
 * ConnectionError Component
 * Displays connection error with contextual troubleshooting steps
 */

import type React from 'react';
import { t } from '@/shared/i18n';
import styles from './ConnectionError.module.css';

interface ConnectionErrorProps {
  error: string;
  onRetry: () => void;
  isRetrying: boolean;
}

interface ErrorDetails {
  title: string;
  message: string;
  action: string | null;
  actionUrl: string | null;
  steps: string[];
}

function getErrorDetails(error: string): ErrorDetails {
  const lower = error.toLowerCase();

  if (
    lower.includes('devtools') &&
    (lower.includes('not found') || lower.includes('missing') || lower.includes('hook'))
  ) {
    return {
      title: t('error.reactDevtoolsMissing'),
      message: t('error.reactDevtoolsMissingMsg'),
      action: t('error.reactDevtoolsMissingAction'),
      actionUrl: 'https://react.dev/learn/react-developer-tools',
      steps: [
        t('error.reactDevtoolsMissing.step1'),
        t('error.reactDevtoolsMissing.step2'),
        t('error.reactDevtoolsMissing.step3'),
      ],
    };
  }

  if (
    lower.includes('react') &&
    (lower.includes('not detected') || lower.includes('not found'))
  ) {
    return {
      title: t('error.reactNotDetected'),
      message: t('error.reactNotDetectedMsg'),
      action: t('error.reactNotDetectedAction'),
      actionUrl: 'https://react.dev/learn/thinking-in-react',
      steps: [
        t('error.reactNotDetected.step1'),
        t('error.reactNotDetected.step2'),
        t('error.reactNotDetected.step3'),
      ],
    };
  }

  if (lower.includes('csp') || lower.includes('content security policy')) {
    return {
      title: t('error.cspBlocked'),
      message: t('error.cspBlockedMsg'),
      action: null,
      actionUrl: null,
      steps: [
        t('error.cspBlocked.step1'),
        t('error.cspBlocked.step2'),
        t('error.cspBlocked.step3'),
      ],
    };
  }

  if (
    lower.includes('context') &&
    (lower.includes('invalidated') || lower.includes('disconnected'))
  ) {
    return {
      title: t('error.contextInvalidated'),
      message: t('error.contextInvalidatedMsg'),
      action: null,
      actionUrl: null,
      steps: [
        t('error.contextInvalidated.step1'),
        t('error.contextInvalidated.step2'),
        t('error.contextInvalidated.step3'),
      ],
    };
  }

  if (lower.includes('storage') && lower.includes('full')) {
    return {
      title: t('error.storageFull'),
      message: t('error.storageFullMsg'),
      action: null,
      actionUrl: null,
      steps: [
        'Open Settings and click "Clear Profile Data"',
        'Or reduce "Max Commits" in advanced settings',
        t('error.storageFull.step3'),
      ],
    };
  }

  if (lower.includes('navigated') || (lower.includes('page') && lower.includes('closed'))) {
    return {
      title: t('error.pageNavigated'),
      message: t('error.pageNavigatedMsg'),
      action: null,
      actionUrl: null,
      steps: [
        t('error.pageNavigated.step1'),
        t('error.pageNavigated.step2'),
        t('error.pageNavigated.step3'),
      ],
    };
  }

  return {
    title: t('error.generic'),
    message: error,
    action: null,
    actionUrl: null,
    steps: [t('error.generic.step1'), t('error.generic.step2'), t('error.generic.step3')],
  };
}

export const ConnectionError: React.FC<ConnectionErrorProps> = ({
  error,
  onRetry,
  isRetrying,
}) => {
  const details = getErrorDetails(error);

  return (
    <div className={styles.errorContainer}>
      <div className={styles.errorContent}>
        <div className={styles.errorIcon}>
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            role="img"
            aria-label="Error"
          >
            <title>Error icon</title>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <h2 className={styles.errorTitle}>{details.title}</h2>
        <p className={styles.errorMessage}>{details.message}</p>

        {details.steps.length > 0 && (
          <ol className={styles.errorSteps}>
            {details.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        )}

        <div className={styles.errorActions}>
          <button
            type="button"
            onClick={onRetry}
            disabled={isRetrying}
            className={styles.retryButton}
          >
            {isRetrying ? (
              <>
                <span className={styles.spinner} />
                {t('error.retrying')}
              </>
            ) : (
              'Retry Connection'
            )}
          </button>
          {details.action && details.actionUrl && (
            <a
              href={details.actionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.helpLink}
            >
              {details.action}
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConnectionError;
