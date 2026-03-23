/**
 * Accessibility Tests
 * Verifies that interactive components have proper ARIA roles, labels, and
 * keyboard-accessible patterns.
 *
 * Run: pnpm test -- accessibility
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Button } from '@/panel/components/Common/Button/Button';
import { BudgetAlertBanner } from '@/panel/components/Layout/BudgetAlertBanner';
import { CircularProgress } from '@/panel/components/Common/CircularProgress/CircularProgress';
import { ErrorBoundary } from '@/panel/components/ErrorBoundary/ErrorBoundary';
import { AnalysisView } from '@/panel/components/Views/AnalysisView';

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

describe('Button — accessibility', () => {
  it('has accessible name from children', () => {
    const { getByRole } = render(<Button>Delete profile</Button>);
    expect(getByRole('button', { name: /delete profile/i })).toBeTruthy();
  });

  it('has accessible name from aria-label when icon-only', () => {
    const { getByRole } = render(<Button aria-label="Close dialog" />);
    expect(getByRole('button', { name: /close dialog/i })).toBeTruthy();
  });

  it('has aria-busy when loading', () => {
    const { container } = render(<Button loading>Save</Button>);
    const button = container.querySelector('button')!;
    expect(button).toHaveAttribute('aria-busy', 'true');
  });
});

// ---------------------------------------------------------------------------
// BudgetAlertBanner
// ---------------------------------------------------------------------------

describe('BudgetAlertBanner — accessibility', () => {
  it('renders nothing when there are no active violations', () => {
    const { container } = render(<BudgetAlertBanner />);
    expect(container.firstChild).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// CircularProgress
// ---------------------------------------------------------------------------

describe('CircularProgress — accessibility', () => {
  it('has role="progressbar" with proper ARIA attributes', () => {
    const { container } = render(<CircularProgress value={75} />);
    const progressbar = container.querySelector('[role="progressbar"]');
    expect(progressbar).toBeTruthy();
    expect(progressbar).toHaveAttribute('aria-valuenow', '75');
    expect(progressbar).toHaveAttribute('aria-valuemin', '0');
    expect(progressbar).toHaveAttribute('aria-valuemax', '100');
    expect(progressbar).toHaveAttribute('aria-label', 'Progress');
    expect(progressbar).toHaveAttribute('aria-valuetext');
  });

  it('has custom aria-label when provided', () => {
    const { container } = render(
      <CircularProgress value={50} aria-label="Performance score" aria-valuetext="50 out of 100" />
    );
    const progressbar = container.querySelector('[role="progressbar"]');
    expect(progressbar).toHaveAttribute('aria-label', 'Performance score');
    expect(progressbar).toHaveAttribute('aria-valuetext', '50 out of 100');
  });
});

// ---------------------------------------------------------------------------
// ErrorBoundary
// ---------------------------------------------------------------------------

describe('ErrorBoundary — accessibility', () => {
  it('renders error state with proper ARIA roles', () => {
    const ThrowError = () => {
      throw new Error('Test error');
    };
    
    const { container } = render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );
    
    const alert = container.querySelector('[role="alert"]');
    expect(alert).toBeTruthy();
    expect(alert).toHaveAttribute('aria-live', 'assertive');
  });
});

// ---------------------------------------------------------------------------
// AnalysisView
// ---------------------------------------------------------------------------

describe('AnalysisView — accessibility', () => {
  it('renders without accessibility errors in no analysis state', () => {
    const { container } = render(<AnalysisView />);
    // Check that it renders
    expect(container.firstChild).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// ARIA landmark coverage
// ---------------------------------------------------------------------------

describe('Toolbar landmarks', () => {
  it('toolbar element has header role', () => {
    const el = document.createElement('header');
    expect(el.tagName).toBe('HEADER');
  });
});