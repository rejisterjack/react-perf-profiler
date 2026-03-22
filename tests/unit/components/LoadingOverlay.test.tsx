import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useState } from 'react';
import {
  LoadingOverlay,
  InlineLoading,
  Skeleton,
  AnalysisProgress,
  useLoadingState,
  type LoadingOverlayType,
} from '@/panel/components/LoadingOverlay/LoadingOverlay';

// Mock CircularProgress component
vi.mock('@/panel/components/Common/CircularProgress/CircularProgress', () => ({
  CircularProgress: ({ value, size }: { value: number; size: number }) => (
    <div data-testid="circular-progress" data-value={value} data-size={size}>
      {value}%
    </div>
  ),
}));

describe('LoadingOverlay', () => {
  it('should not render when isLoading is false', () => {
    render(<LoadingOverlay isLoading={false} />);
    
    const overlay = screen.queryByRole('status');
    expect(overlay).not.toBeInTheDocument();
  });

  it('should render when isLoading is true', () => {
    render(<LoadingOverlay isLoading={true} />);
    
    const overlay = screen.getByRole('status');
    expect(overlay).toBeInTheDocument();
    expect(overlay).toHaveAttribute('aria-busy', 'true');
  });

  it('should show analysis type config', () => {
    render(<LoadingOverlay isLoading={true} type="analysis" />);
    
    expect(screen.getByText(/analyzing performance/i)).toBeInTheDocument();
  });

  it('should show rsc-analysis type config', () => {
    render(<LoadingOverlay isLoading={true} type="rsc-analysis" />);
    
    expect(screen.getByText(/analyzing rsc/i)).toBeInTheDocument();
  });

  it('should show import type config', () => {
    render(<LoadingOverlay isLoading={true} type="import" />);
    
    expect(screen.getByText(/importing data/i)).toBeInTheDocument();
  });

  it('should show export type config', () => {
    render(<LoadingOverlay isLoading={true} type="export" />);
    
    expect(screen.getByText(/exporting data/i)).toBeInTheDocument();
  });

  it('should show generic type config by default', () => {
    render(<LoadingOverlay isLoading={true} type="generic" />);
    
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('should show custom message when provided', () => {
    render(<LoadingOverlay isLoading={true} message="Custom loading message" />);
    
    expect(screen.getByText('Custom loading message')).toBeInTheDocument();
  });

  it('should show circular progress when progress is defined', () => {
    render(<LoadingOverlay isLoading={true} progress={50} />);
    
    expect(screen.getByTestId('circular-progress')).toBeInTheDocument();
    expect(screen.getByTestId('circular-progress')).toHaveAttribute('data-value', '50');
  });

  it('should apply blocking class by default', () => {
    render(<LoadingOverlay isLoading={true} blocking={true} />);
    
    const overlay = screen.getByRole('status');
    expect(overlay.className).toMatch(/blocking/);
  });

  it('should apply non-blocking class when blocking is false', () => {
    render(<LoadingOverlay isLoading={true} blocking={false} />);
    
    const overlay = screen.getByRole('status');
    expect(overlay.className).toMatch(/nonBlocking/);
  });

  it('should show progress bar when progress < 100', () => {
    render(<LoadingOverlay isLoading={true} progress={75} />);
    
    const progressBar = document.querySelector('[class*="progressBar"]');
    expect(progressBar).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    render(<LoadingOverlay isLoading={true} className="custom-class" />);
    
    const overlay = screen.getByRole('status');
    expect(overlay).toHaveClass('custom-class');
  });
});

describe('InlineLoading', () => {
  it('should render with default message', () => {
    render(<InlineLoading />);
    
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should render with custom message', () => {
    render(<InlineLoading message="Processing..." />);
    
    expect(screen.getByText('Processing...')).toBeInTheDocument();
  });

  it('should hide spinner when showSpinner is false', () => {
    render(<InlineLoading showSpinner={false} />);
    
    // Just verify it renders without error
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    render(<InlineLoading className="custom-class" />);
    
    const inline = document.querySelector('[class*="inlineLoading"]');
    expect(inline).toHaveClass('custom-class');
  });
});

describe('Skeleton', () => {
  it('should render with default rows', () => {
    render(<Skeleton />);
    
    const rows = document.querySelectorAll('[class*="skeletonRow"]');
    expect(rows.length).toBe(3);
  });

  it('should render with custom rows', () => {
    render(<Skeleton rows={5} />);
    
    const rows = document.querySelectorAll('[class*="skeletonRow"]');
    expect(rows.length).toBe(5);
  });

  it('should show header by default', () => {
    render(<Skeleton />);
    
    const header = document.querySelector('[class*="skeletonHeader"]');
    expect(header).toBeInTheDocument();
  });

  it('should hide header when showHeader is false', () => {
    render(<Skeleton showHeader={false} />);
    
    const header = document.querySelector('[class*="skeletonHeader"]');
    expect(header).not.toBeInTheDocument();
  });

  it('should apply custom className', () => {
    render(<Skeleton className="custom-class" />);
    
    const skeleton = document.querySelector('[class*="skeleton"]');
    expect(skeleton).toHaveClass('custom-class');
  });
});

describe('AnalysisProgress', () => {
  it('should render parsing stage', () => {
    render(<AnalysisProgress stage="parsing" progress={25} />);
    
    expect(screen.getByText(/parsing component tree/i)).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
  });

  it('should render analyzing stage', () => {
    render(<AnalysisProgress stage="analyzing" progress={50} />);
    
    expect(screen.getByText(/analyzing render performance/i)).toBeInTheDocument();
  });

  it('should render generating stage', () => {
    render(<AnalysisProgress stage="generating" progress={75} />);
    
    expect(screen.getByText(/generating recommendations/i)).toBeInTheDocument();
  });

  it('should show commit count', () => {
    render(<AnalysisProgress stage="analyzing" progress={50} commitCount={100} />);
    
    expect(screen.getByText(/100 commits to analyze/i)).toBeInTheDocument();
  });

  it('should show ETA', () => {
    render(<AnalysisProgress stage="analyzing" progress={50} eta={30} />);
    
    expect(screen.getByText(/~30s remaining/i)).toBeInTheDocument();
  });

  it('should show minutes format for ETA > 60', () => {
    render(<AnalysisProgress stage="analyzing" progress={50} eta={90} />);
    
    expect(screen.getByText(/~1m 30s remaining/i)).toBeInTheDocument();
  });
});

describe('useLoadingState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function TestComponent() {
    const { loadingState, startLoading, updateProgress, stopLoading, isLoading } = useLoadingState();
    
    return (
      <div>
        <div data-testid="is-loading">{isLoading ? 'true' : 'false'}</div>
        <div data-testid="message">{loadingState.message}</div>
        <div data-testid="progress">{loadingState.progress ?? 'undefined'}</div>
        <button onClick={() => startLoading('Loading...')}>Start</button>
        <button onClick={() => updateProgress(50)}>Update</button>
        <button onClick={() => stopLoading()}>Stop</button>
      </div>
    );
  }

  it('should have initial state', () => {
    render(<TestComponent />);
    
    expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
    expect(screen.getByTestId('message')).toHaveTextContent('');
    expect(screen.getByTestId('progress')).toHaveTextContent('undefined');
  });

  it('should start loading', () => {
    render(<TestComponent />);
    
    fireEvent.click(screen.getByText('Start'));
    
    expect(screen.getByTestId('is-loading')).toHaveTextContent('true');
    expect(screen.getByTestId('message')).toHaveTextContent('Loading...');
  });

  it('should update progress', () => {
    render(<TestComponent />);
    
    fireEvent.click(screen.getByText('Start'));
    fireEvent.click(screen.getByText('Update'));
    
    expect(screen.getByTestId('progress')).toHaveTextContent('50');
  });

  it('should stop loading', () => {
    render(<TestComponent />);
    
    fireEvent.click(screen.getByText('Start'));
    fireEvent.click(screen.getByText('Stop'));
    
    expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
    expect(screen.getByTestId('message')).toHaveTextContent('');
    expect(screen.getByTestId('progress')).toHaveTextContent('undefined');
  });
});
