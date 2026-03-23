import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PerformanceScore } from '@/panel/components/Analysis/PerformanceScore';
import type { PerformanceMetrics } from '@/panel/stores/profilerStore';

describe('PerformanceScore', () => {
  const mockScore: PerformanceMetrics = {
    score: 75,
    averageRenderTime: 5.5,
    wastedRenderRate: 15,
    averageMemoHitRate: 80,
    totalComponents: 25,
  };

  it('renders null when score is null', () => {
    const { container } = render(<PerformanceScore score={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders role="progressbar" with correct ARIA values', () => {
    render(<PerformanceScore score={mockScore} />);

    const progressBars = screen.getAllByRole('progressbar');
    expect(progressBars.length).toBeGreaterThan(0);

    // Check that one of the progressbars is the Wasted Renders category
    const wastedRendersBar = progressBars.find(bar =>
      bar.getAttribute('aria-label')?.includes('Wasted Renders')
    );
    expect(wastedRendersBar).toBeDefined();
    expect(wastedRendersBar).toHaveAttribute('aria-valuemin', '0');
    expect(wastedRendersBar).toHaveAttribute('aria-valuemax', '100');
  });

  it('renders circular progress with aria-label="Performance score"', () => {
    render(<PerformanceScore score={mockScore} />);

    const scoreElement = screen.getByLabelText(/performance score/i);
    expect(scoreElement).toBeInTheDocument();
  });

  it('renders all 4 category bars', () => {
    render(<PerformanceScore score={mockScore} />);

    expect(screen.getByText(/wasted renders/i)).toBeInTheDocument();
    expect(screen.getByText(/memoization/i)).toBeInTheDocument();
    expect(screen.getByText(/render time/i)).toBeInTheDocument();
    expect(screen.getByText(/component count/i)).toBeInTheDocument();
  });

  it('renders summary stats', () => {
    render(<PerformanceScore score={mockScore} />);

    expect(screen.getByText('25')).toBeInTheDocument(); // Total components
    expect(screen.getByText(/components/i)).toBeInTheDocument();
    expect(screen.getByText(/avg render/i)).toBeInTheDocument();
    expect(screen.getByText(/wasted rate/i)).toBeInTheDocument();
  });

  it('displays correct score value', () => {
    render(<PerformanceScore score={mockScore} />);

    // The score should be displayed somewhere in the component
    expect(screen.getByText('75')).toBeInTheDocument();
  });
});
