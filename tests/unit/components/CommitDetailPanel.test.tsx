import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { CommitDetailPanel } from '@/panel/components/Views/CommitDetailPanel';

// Mock the profiler store
vi.mock('@/panel/stores/profilerStore', () => ({
  useProfilerStore: vi.fn(),
}));

import { useProfilerStore } from '@/panel/stores/profilerStore';

const mockUseProfilerStore = useProfilerStore as unknown as ReturnType<typeof vi.fn>;

describe('CommitDetailPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "Select a commit" empty state', () => {
    mockUseProfilerStore.mockReturnValue({
      commits: [],
      selectedCommitId: null,
      selectedComponent: null,
      wastedRenderReports: [],
    });

    render(<CommitDetailPanel />);

    expect(screen.getByText(/select a commit from the sidebar to inspect its component tree/i)).toBeInTheDocument();
  });

  it('renders commit header with index, timestamp, priority, duration badge', () => {
    mockUseProfilerStore.mockReturnValue({
      commits: [{
        id: '1',
        timestamp: Date.now(),
        duration: 15.5,
        priorityLevel: 'high',
        nodes: [],
      }],
      selectedCommitId: '1',
      selectedComponent: null,
      wastedRenderReports: [],
    });

    render(<CommitDetailPanel />);

    expect(screen.getByText(/commit #1/i)).toBeInTheDocument();
    expect(screen.getByText('high')).toBeInTheDocument();
    expect(screen.getByText(/15.5ms/i)).toBeInTheDocument();
    expect(screen.getByText(/0 components/i)).toBeInTheDocument();
  });

  it('duration badge has aria-label with severity', () => {
    mockUseProfilerStore.mockReturnValue({
      commits: [{
        id: '1',
        timestamp: Date.now(),
        duration: 25, // critical (> 16ms)
        priorityLevel: 'high',
        nodes: [],
      }],
      selectedCommitId: '1',
      selectedComponent: null,
      wastedRenderReports: [],
    });

    render(<CommitDetailPanel />);

    const durationBadge = screen.getByText(/25.0ms/i).closest('span');
    expect(durationBadge).toHaveAttribute('aria-label', expect.stringContaining('critical'));
  });

  it('renders top slow nodes table', () => {
    mockUseProfilerStore.mockReturnValue({
      commits: [{
        id: '1',
        timestamp: Date.now(),
        duration: 15,
        priorityLevel: 'normal',
        nodes: [
          { id: 1, displayName: 'SlowComponent', actualDuration: 10, baseDuration: 10, selfBaseDuration: 5, treeBaseDuration: 10, isMemoized: false, alternate: null, tag: 0 },
          { id: 2, displayName: 'FastComponent', actualDuration: 2, baseDuration: 2, selfBaseDuration: 1, treeBaseDuration: 2, isMemoized: false, alternate: null, tag: 0 },
        ],
      }],
      selectedCommitId: '1',
      selectedComponent: null,
      wastedRenderReports: [],
    });

    render(<CommitDetailPanel />);

    expect(screen.getByText(/top slow components/i)).toBeInTheDocument();
    expect(screen.getByText('SlowComponent')).toBeInTheDocument();
    expect(screen.getByText('10.0ms')).toBeInTheDocument();
  });

  it('renders component detail when selectedComponent is set', () => {
    mockUseProfilerStore.mockReturnValue({
      commits: [{
        id: '1',
        timestamp: Date.now(),
        duration: 15,
        priorityLevel: 'normal',
        nodes: [
          { id: 1, displayName: 'App', actualDuration: 10, baseDuration: 10, selfBaseDuration: 5, treeBaseDuration: 10, isMemoized: true, alternate: null, tag: 0 },
        ],
      }],
      selectedCommitId: '1',
      selectedComponent: 'App',
      wastedRenderReports: [],
    });

    render(<CommitDetailPanel />);

    expect(screen.getByText(/component detail/i)).toBeInTheDocument();
    expect(screen.getByText(/component detail —/i)).toBeInTheDocument();
    // App appears in multiple places (component detail and in the tree)
    expect(screen.getAllByText('App').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/^Render Count$/i)).toBeInTheDocument();
    expect(screen.getByText(/avg duration/i)).toBeInTheDocument();
    expect(screen.getByText(/memoized/i)).toBeInTheDocument();
  });
});
