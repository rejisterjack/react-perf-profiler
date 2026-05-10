/**
 * CSP (Content Security Policy) Error Detector
 * Detects when a page's CSP blocks the bridge script injection
 * and provides a user-friendly error with remediation steps.
 */

export interface CSPDetectionResult {
  blocked: boolean;
  directive?: string;
  blockedURI?: string;
}

/**
 * Install a global CSP violation listener.
 * Returns a cleanup function.
 */
export function installCSPDetector(
  onError: (result: CSPDetectionResult) => void
): () => void {
  const handler = (event: SecurityPolicyViolationEvent) => {
    // Only care about violations related to our extension resources
    if (
      event.blockedURI?.includes('chrome-extension://') ||
      event.violatedDirective?.startsWith('script-src')
    ) {
      onError({
        blocked: true,
        directive: event.violatedDirective,
        blockedURI: event.blockedURI,
      });
    }
  };

  document.addEventListener('securitypolicyviolation', handler);
  return () => document.removeEventListener('securitypolicyviolation', handler);
}

/**
 * CSP remediation message for the user.
 */
export function getCSPRemediationMessage(): string {
  return (
    'The page\'s Content Security Policy is blocking the profiler bridge script. ' +
    'To fix this, the page owner needs to add the extension\'s origin to the ' +
    'script-src directive, or you can profile a different page.'
  );
}

/**
 * CSP remediation steps for the error UI.
 */
export const CSP_REMEDIATION_STEPS = [
  'This page uses a strict Content Security Policy (CSP)',
  'The CSP blocks injected scripts required for profiling',
  'Try profiling a page on localhost or a different domain',
  'If you own the page, add the extension ID to your CSP script-src',
];
