import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ProfileCompare } from '@/panel/components/Analysis/ProfileCompare';

// Mock the profiler store
vi.mock('@/panel/stores/profilerStore', () => ({
  useProfilerStore: vi.fn(),
}));

// Mock the profile comparison utils
vi.mock('@/panel/utils/profileComparison', () => ({
  compareProfiles: vi.fn(),
}));

import { useProfilerStore } from '@/panel/stores/profilerStore';
import { compareProfiles } from '@/panel/utils/profileComparison';

const mockUseProfilerStore = useProfilerStore as unknown as ReturnType<typeof vi.fn>;
const mockCompareProfiles = compareProfiles as unknown as ReturnType<typeof vi.fn>;

describe('ProfileCompare', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state with role="status" when no commits', () => {
    mockUseProfilerStore.mockReturnValue({ commits: [] });

    render(<ProfileCompare />);

    const statusContainer = screen.getByRole('status');
    expect(statusContainer).toBeInTheDocument();
    expect(screen.getByText(/record a session first/i)).toBeInTheDocument();
  });

  it('renders "Pin current as baseline" button with commit count', () => {
    mockUseProfilerStore.mockReturnValue({
      commits: [
        { id: '1', timestamp: 1000, duration: 10, nodes: [] },
        { id: '2', timestamp: 2000, duration: 15, nodes: [] },
        { id: '3', timestamp: 3000, duration: 12, nodes: [] },
      ],
    });

    render(<ProfileCompare />);

    expect(screen.getByRole('button', { name: /pin current as baseline \(3 commits\)/i })).toBeInTheDocument();
  });

  it('stores baseline when pin button is clicked', () => {
    mockUseProfilerStore.mockReturnValue({
      commits: [
        { id: '1', timestamp: 1000, duration: 10, nodes: [] },
        { id: '2', timestamp: 2000, duration: 15, nodes: [] },
      ],
    });

    render(<ProfileCompare />);

    const pinButton = screen.getByRole('button', { name: /pin current as baseline/i });
    fireEvent.click(pinButton);

    // After clicking, baseline info should be shown
    expect(screen.getByText(/baseline:/i)).toBeInTheDocument();
    // Check baseline info text which contains commit count
    expect(screen.getByText(/baseline:/i).parentElement?.textContent).toContain('2 commits');
  });

  it('renders "Compare with current" button after pinning', () => {
    mockUseProfilerStore.mockReturnValue({
      commits: [
        { id: '1', timestamp: 1000, duration: 10, nodes: [] },
        { id: '2', timestamp: 2000, duration: 15, nodes: [] },
      ],
    });

    render(<ProfileCompare />);

    const pinButton = screen.getByRole('button', { name: /pin current as baseline/i });
    fireEvent.click(pinButton);

    expect(screen.getByRole('button', { name: /compare with current/i })).toBeInTheDocument();
  });

  it('renders comparison table with headers after comparison', () => {
    mockUseProfilerStore.mockReturnValue({
      commits: [
        { id: '1', timestamp: 1000, duration: 10, nodes: [{ displayName: 'App', actualDuration: 5, baseDuration: 5, selfBaseDuration: 5, treeBaseDuration: 5, isMemoized: false, alternate: null, id: 1, tag: 0 }] },
      ],
    });

    mockCompareProfiles.mockReturnValue({
      components: [
        {
          name: 'App',
          renderCountDelta: 2,
          renderCountDeltaPct: 50,
          avgDurationDelta: 1.5,
          avgDurationDeltaPct: 30,
          wastedRendersDelta: 1,
          isNew: false,
          isRemoved: false,
        },
      ],
      totalRenderCountDelta: 2,
      totalWastedRendersDelta: 1,
    });

    render(<ProfileCompare />);

    // Pin baseline
    const pinButton = screen.getByRole('button', { name: /pin current as baseline/i });
    fireEvent.click(pinButton);

    // Compare
    const compareButton = screen.getByRole('button', { name: /compare with current/i });
    fireEvent.click(compareButton);

    // Check table headers - use getAllByRole since there may be multiple matches
    const columnheaders = screen.getAllByRole('columnheader');
    expect(columnheaders.length).toBeGreaterThanOrEqual(4);
    // Check that all expected headers exist somewhere in the table
    const headerTexts = columnheaders.map(h => h.textContent);
    expect(headerTexts.some(text => /component/i.test(text || ''))).toBe(true);
    expect(headerTexts.some(text => /renders/i.test(text || ''))).toBe(true);
    expect(headerTexts.some(text => /duration/i.test(text || ''))).toBe(true);
    expect(headerTexts.some(text => /wasted/i.test(text || ''))).toBe(true);

    // Check component row
    expect(screen.getByText('App')).toBeInTheDocument();
  });

  it('filter input has aria-label', () => {
    mockUseProfilerStore.mockReturnValue({
      commits: [
        { id: '1', timestamp: 1000, duration: 10, nodes: [] },
      ],
    });

    mockCompareProfiles.mockReturnValue({
      components: [],
      totalRenderCountDelta: 0,
      totalWastedRendersDelta: 0,
    });

    render(<ProfileCompare />);

    // Pin and compare
    fireEvent.click(screen.getByRole('button', { name: /pin current as baseline/i }));
    fireEvent.click(screen.getByRole('button', { name: /compare with current/i }));

    const filterInput = screen.getByRole('searchbox', { name: /filter comparison results by component name/i });
    expect(filterInput).toBeInTheDocument();
  });

  it('button is not rendered when no commits', () => {
    mockUseProfilerStore.mockReturnValue({ commits: [] });

    render(<ProfileCompare />);

    // Should not have the pin baseline button
    expect(screen.queryByRole('button', { name: /pin current as baseline/i })).not.toBeInTheDocument();
  });
});
