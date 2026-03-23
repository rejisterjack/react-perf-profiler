import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetricsChart } from '@/panel/components/Visualizations/MetricsChart';

// Mock the profiler store
vi.mock('@/panel/stores/profilerStore', () => ({
  useProfilerStore: vi.fn(),
}));

import { useProfilerStore } from '@/panel/stores/profilerStore';

const mockUseProfilerStore = useProfilerStore as unknown as ReturnType<typeof vi.fn>;

describe('MetricsChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when no commits', () => {
    mockUseProfilerStore.mockReturnValue({ commits: [] });

    render(<MetricsChart />);
    
    expect(screen.getByText(/record commits to see metrics/i)).toBeInTheDocument();
  });

  it('renders chart type buttons', () => {
    mockUseProfilerStore.mockReturnValue({
      commits: [
        { id: '1', timestamp: 1000, duration: 10, nodes: [] },
      ],
    });

    render(<MetricsChart />);
    
    expect(screen.getByRole('button', { name: /renders/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /duration/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /components/i })).toBeInTheDocument();
  });

  it('displays stats when data is present', () => {
    mockUseProfilerStore.mockReturnValue({
      commits: [
        { id: '1', timestamp: 1000, duration: 10, nodes: [{ displayName: 'App' }] },
        { id: '2', timestamp: 2000, duration: 20, nodes: [{ displayName: 'App' }] },
      ],
    });

    render(<MetricsChart />);
    
    expect(screen.getByText(/total/i)).toBeInTheDocument();
    expect(screen.getByText(/average/i)).toBeInTheDocument();
    expect(screen.getByText(/max/i)).toBeInTheDocument();
    expect(screen.getByText(/min/i)).toBeInTheDocument();
  });
});