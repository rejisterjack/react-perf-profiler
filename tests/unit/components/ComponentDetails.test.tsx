import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComponentDetails } from '@/panel/components/Analysis/ComponentDetails';

// Mock the profiler store
vi.mock('@/panel/stores/profilerStore', () => ({
  useProfilerStore: vi.fn(),
}));

import { useProfilerStore } from '@/panel/stores/profilerStore';

const mockUseProfilerStore = useProfilerStore as unknown as ReturnType<typeof vi.fn>;

describe('ComponentDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when no component selected', () => {
    mockUseProfilerStore.mockReturnValue({
      selectedComponent: null,
      componentData: new Map(),
      wastedRenderReports: [],
      memoReports: [],
      commits: [],
    });

    render(<ComponentDetails />);
    
    expect(screen.getByText(/select a component to view details/i)).toBeInTheDocument();
  });

  it('renders component stats when selected', () => {
    mockUseProfilerStore.mockReturnValue({
      selectedComponent: 'App',
      componentData: new Map([
        ['App', {
          name: 'App',
          renderCount: 10,
          wastedRenders: 2,
          wastedRenderRate: 0.2,
          averageDuration: 5.5,
          totalDuration: 55,
          isMemoized: true,
          memoHitRate: 0.8,
          commitIds: [],
          severity: 'none',
        }],
      ]),
      wastedRenderReports: [],
      memoReports: [],
      commits: [],
    });

    render(<ComponentDetails />);
    
    expect(screen.getByRole('heading', { name: 'App' })).toBeInTheDocument();
    expect(screen.getByText(/total renders/i)).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText(/memoized/i)).toBeInTheDocument();
  });

  it('shows commit history', () => {
    mockUseProfilerStore.mockReturnValue({
      selectedComponent: 'App',
      componentData: new Map([
        ['App', {
          name: 'App',
          renderCount: 10,
          wastedRenders: 0,
          wastedRenderRate: 0,
          averageDuration: 5,
          totalDuration: 50,
          isMemoized: false,
          memoHitRate: 0,
          commitIds: [],
          severity: 'none',
        }],
      ]),
      wastedRenderReports: [],
      memoReports: [],
      commits: [
        { id: '1', timestamp: 1000, duration: 10, nodes: [{ displayName: 'App', actualDuration: 10, baseDuration: 10, selfBaseDuration: 5, treeBaseDuration: 10, isMemoized: false, alternate: null, id: 1, tag: 0 }] },
        { id: '2', timestamp: 2000, duration: 15, nodes: [{ displayName: 'App', actualDuration: 10, baseDuration: 10, selfBaseDuration: 5, treeBaseDuration: 10, isMemoized: false, alternate: null, id: 1, tag: 0 }] },
      ],
    });

    render(<ComponentDetails />);
    
    expect(screen.getByText(/commit history/i)).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes('Appears in') && content.includes('2') && content.includes('commits'))).toBeInTheDocument();
  });
});