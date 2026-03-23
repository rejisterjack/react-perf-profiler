/**
 * Unit tests for errorRecovery utilities
 * @module tests/unit/utils/errorRecovery
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  clearPanelData,
  clearSettings,
  reportError,
  getLastError,
  clearLastError,
  checkPanelHealth,
  createBridgeError,
  formatErrorForDisplay,
  type BridgeError,
} from '@/panel/utils/errorRecovery';

const STORAGE_PREFIX = 'react-perf-profiler:';

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('clearPanelData', () => {
  it('runs without throwing', () => {
    expect(() => clearPanelData()).not.toThrow();
  });

  it('removes prefixed keys from sessionStorage', () => {
    // Pre-populate a couple of known keys
    sessionStorage.setItem(`${STORAGE_PREFIX}commits`, 'data');
    sessionStorage.setItem(`${STORAGE_PREFIX}settings`, 'data');
    clearPanelData();
    expect(sessionStorage.getItem(`${STORAGE_PREFIX}commits`)).toBeNull();
  });
});

describe('clearSettings', () => {
  it('removes the settings key from localStorage', () => {
    localStorage.setItem(`${STORAGE_PREFIX}settings`, '{"theme":"dark"}');
    clearSettings();
    expect(localStorage.getItem(`${STORAGE_PREFIX}settings`)).toBeNull();
  });
});

describe('reportError / getLastError / clearLastError', () => {
  beforeEach(() => {
    clearLastError();
  });

  afterEach(() => {
    clearLastError();
  });

  it('getLastError returns null when nothing is stored', () => {
    expect(getLastError()).toBeNull();
  });

  it('reportError stores the error in session storage', () => {
    reportError(new Error('boom'));
    const stored = getLastError();
    expect(stored).not.toBeNull();
    expect(stored?.message).toBe('boom');
  });

  it('stored error includes timestamp and version', () => {
    reportError(new Error('oops'));
    const stored = getLastError();
    expect(stored?.timestamp).toBeGreaterThan(0);
    expect(stored?.version).toBeTruthy();
  });

  it('reportError captures componentStack from errorInfo', () => {
    reportError(new Error('render err'), { componentStack: '  at Foo\n  at Bar' });
    const stored = getLastError();
    expect(stored?.componentStack).toContain('Foo');
  });

  it('reportError captures context from errorInfo', () => {
    reportError(new Error('ctx err'), { context: 'AnalysisPanel' });
    const stored = getLastError();
    expect(stored?.context).toBe('AnalysisPanel');
  });

  it('clearLastError removes the stored error', () => {
    reportError(new Error('temporary'));
    expect(getLastError()).not.toBeNull();
    clearLastError();
    expect(getLastError()).toBeNull();
  });
});

describe('checkPanelHealth', () => {
  beforeEach(() => {
    clearLastError();
  });

  afterEach(() => {
    clearLastError();
  });

  it('returns healthy=true with no issues when everything is fine', () => {
    const result = checkPanelHealth();
    expect(result.healthy).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('returns healthy=false when a recent error exists', () => {
    // Store an error directly via reportError (which calls sessionStorage internally)
    reportError(new Error('recent error'));
    const result = checkPanelHealth();
    expect(result.healthy).toBe(false);
    expect(result.issues).toContain('Recent error detected');
  });
});

describe('createBridgeError', () => {
  it('creates a REACT_NOT_FOUND error with suggested action', () => {
    const err = createBridgeError('REACT_NOT_FOUND', 'React not detected');
    expect(err.type).toBe('REACT_NOT_FOUND');
    expect(err.recoverable).toBe(true);
    expect(err.suggestedAction).toBeTruthy();
    expect(err.helpUrl).toBeTruthy();
  });

  it('creates a DEVTOOLS_NOT_FOUND error with help URL', () => {
    const err = createBridgeError('DEVTOOLS_NOT_FOUND', 'Hook missing');
    expect(err.type).toBe('DEVTOOLS_NOT_FOUND');
    expect(err.helpUrl).toContain('react');
  });

  it('creates an INIT_FAILED error — retrying message when retryCount < 3', () => {
    const err = createBridgeError('INIT_FAILED', 'init failed', { retryCount: 1 });
    expect(err.suggestedAction).toContain('Retrying');
  });

  it('creates an INIT_FAILED error — reload suggestion when retryCount >= 3', () => {
    const err = createBridgeError('INIT_FAILED', 'init failed', { retryCount: 5 });
    expect(err.suggestedAction).toMatch(/reload|restart/i);
  });

  it('marks UNKNOWN errors as not recoverable', () => {
    const err = createBridgeError('UNKNOWN', 'something weird');
    expect(err.recoverable).toBe(false);
  });

  it('creates a TIMEOUT error with suggested action', () => {
    const err = createBridgeError('TIMEOUT', 'timed out');
    expect(err.suggestedAction).toBeTruthy();
  });
});

describe('formatErrorForDisplay', () => {
  it('returns the string as-is for string input', () => {
    expect(formatErrorForDisplay('plain error text')).toBe('plain error text');
  });

  it('returns the message for a regular Error', () => {
    expect(formatErrorForDisplay(new Error('js error'))).toBe('js error');
  });

  it('returns message + suggested action for a BridgeError with suggestedAction', () => {
    const bridgeErr: BridgeError = {
      type: 'REACT_NOT_FOUND',
      message: 'React not found',
      recoverable: true,
      suggestedAction: 'Use a dev build',
    };
    const display = formatErrorForDisplay(bridgeErr);
    expect(display).toContain('React not found');
    expect(display).toContain('Use a dev build');
  });

  it('returns just the message for a BridgeError without suggestedAction', () => {
    const bridgeErr: BridgeError = {
      type: 'TIMEOUT',
      message: 'Timed out',
      recoverable: true,
    };
    expect(formatErrorForDisplay(bridgeErr)).toBe('Timed out');
  });
});
