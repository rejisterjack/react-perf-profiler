import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ErrorBoundary } from '@/panel/components/ErrorBoundary/ErrorBoundary';
import * as errorRecovery from '@/panel/utils/errorRecovery';

// Mock error recovery module
vi.mock('@/panel/utils/errorRecovery', () => ({
  reloadPanel: vi.fn(),
  resetPanel: vi.fn(),
  reportError: vi.fn(),
  clearLastError: vi.fn(),
}));

// Mock window.open
Object.defineProperty(window, 'open', {
  writable: true,
  value: vi.fn(),
});

// Component that throws an error
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    console.error = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div data-testid="child">Child Content</div>
      </ErrorBoundary>
    );
    
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('should render error UI when child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/oops! something went wrong/i)).toBeInTheDocument();
  });

  it('should render custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div data-testid="custom-fallback">Custom Error</div>}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
  });

  it('should display context in error message when provided', () => {
    render(
      <ErrorBoundary context="Component Tree">
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    expect(screen.getByText(/an error occurred in component tree/i)).toBeInTheDocument();
  });

  it('should show compact view when compact prop is true', () => {
    render(
      <ErrorBoundary compact>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });

  it('should call reportError when error is caught', async () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    await waitFor(() => {
      expect(errorRecovery.reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.any(String),
          context: undefined,
          errorId: expect.any(String),
        })
      );
    });
  });

  it('should call onError callback when provided', async () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary onError={onError}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.any(String),
        })
      );
    });
  });

  it('should call reloadPanel when reload button is clicked', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    const reloadButton = screen.getByRole('button', { name: /reload panel/i });
    fireEvent.click(reloadButton);
    
    expect(errorRecovery.clearLastError).toHaveBeenCalled();
    expect(errorRecovery.reloadPanel).toHaveBeenCalled();
  });

  it('should show reset confirmation modal when reset button is clicked', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    const resetButton = screen.getByRole('button', { name: /^reset$/i });
    fireEvent.click(resetButton);
    
    // Modal should appear
    expect(screen.getByRole('dialog', { name: /confirm reset/i })).toBeInTheDocument();
    expect(screen.getByText(/this will clear all profiler data/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reset panel/i })).toBeInTheDocument();
  });

  it('should call resetPanel when reset is confirmed in modal', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    // Click reset to open modal
    const resetButton = screen.getByRole('button', { name: /^reset$/i });
    fireEvent.click(resetButton);
    
    // Click confirm in modal
    const confirmButton = screen.getByRole('button', { name: /reset panel/i });
    fireEvent.click(confirmButton);
    
    expect(errorRecovery.clearLastError).toHaveBeenCalled();
    expect(errorRecovery.resetPanel).toHaveBeenCalled();
  });

  it('should not call resetPanel when reset is cancelled in modal', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    // Click reset to open modal
    const resetButton = screen.getByRole('button', { name: /^reset$/i });
    fireEvent.click(resetButton);
    
    // Click cancel in modal
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);
    
    expect(errorRecovery.resetPanel).not.toHaveBeenCalled();
    // Modal should close
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should retry rendering when try again button is clicked', () => {
    const { rerender } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    // Update children so they no longer throw, THEN reset the boundary.
    // Doing it the other way causes the boundary to immediately catch a new
    // error (the child still throws on the retry render).
    rerender(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );

    const tryAgainButton = screen.getByRole('button', { name: /try again/i });
    fireEvent.click(tryAgainButton);

    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('should open GitHub issue page when report link is clicked', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    const reportLink = screen.getByText(/report this issue on github/i);
    fireEvent.click(reportLink);
    
    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining('github.com'),
      '_blank'
    );
  });

  it('should show error details in details element', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    const details = screen.getByText(/error details/i);
    expect(details).toBeInTheDocument();
  });

  it('should show error ID in details', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    const errorId = screen.getByText(/id:/i);
    expect(errorId).toBeInTheDocument();
  });

  it('should hide reset button when showReset is false', () => {
    render(
      <ErrorBoundary showReset={false}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    const resetButton = screen.queryByRole('button', { name: /^reset$/i });
    expect(resetButton).not.toBeInTheDocument();
  });

  it('should show reset button by default', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    const resetButton = screen.getByRole('button', { name: /^reset$/i });
    expect(resetButton).toBeInTheDocument();
  });

  it('should show compact error UI', () => {
    render(
      <ErrorBoundary compact>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
  });

  it('should show full error UI', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    expect(screen.getByText(/oops! something went wrong/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});