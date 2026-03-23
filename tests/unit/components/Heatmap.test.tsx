import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Heatmap } from '@/panel/components/Visualizations/Heatmap';

// Mock the profiler store
vi.mock('@/panel/stores/profilerStore', () => ({
  useProfilerStore: vi.fn(),
}));

import { useProfilerStore } from '@/panel/stores/profilerStore';

const mockUseProfilerStore = useProfilerStore as unknown as ReturnType<typeof vi.fn>;

describe('Heatmap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when no commits', () => {
    mockUseProfilerStore.mockReturnValue({ commits: [] });

    render(<Heatmap />);
    
    expect(screen.getByText(/record commits to see component heatmap/i)).toBeInTheDocument();
  });

  it('has proper ARIA attributes on SVG', () => {
    mockUseProfilerStore.mockReturnValue({
      commits: [{
        id: '1',
        timestamp: 1000,
        nodes: [{ displayName: 'App', actualDuration: 10, baseDuration: 10, isMemoized: false }],
      }],
    });

    render(<Heatmap />);
    
    const svg = screen.getByRole('img');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('aria-label', expect.stringContaining('Heatmap'));
  });

  it('renders color mode buttons', () => {
    mockUseProfilerStore.mockReturnValue({
      commits: [{
        id: '1',
        timestamp: 1000,
        nodes: [{ displayName: 'App', actualDuration: 10, baseDuration: 10, isMemoized: false }],
      }],
    });

    render(<Heatmap />);
    
    expect(screen.getByRole('button', { name: /count/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /duration/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /wasted/i })).toBeInTheDocument();
  });

  it('changes color mode when button clicked', () => {
    mockUseProfilerStore.mockReturnValue({
      commits: [{
        id: '1',
        timestamp: 1000,
        nodes: [{ displayName: 'App', actualDuration: 10, baseDuration: 10, isMemoized: false }],
      }],
    });

    render(<Heatmap />);
    
    const durationButton = screen.getByRole('button', { name: /duration/i });
    fireEvent.click(durationButton);
    
    // The active state should change (we can check the button has the active class)
    expect(durationButton.className).toContain('active');
  });
});