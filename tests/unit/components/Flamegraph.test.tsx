import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Flamegraph } from '@/panel/components/Visualizations/Flamegraph';

// Mock the profiler store
vi.mock('@/panel/stores/profilerStore', () => ({
  useProfilerStore: vi.fn(),
  selectSelectedCommit: vi.fn(),
}));

// Mock the worker client
vi.mock('@/panel/workers/workerClient', () => ({
  analysisWorker: {
    generateFlamegraph: vi.fn(),
  },
}));

// Mock d3 - simplified mock for basic tests
vi.mock('d3', () => ({
  select: vi.fn(() => ({
    selectAll: vi.fn(() => ({
      remove: vi.fn(),
    })),
    append: vi.fn(() => ({
      attr: vi.fn().mockReturnThis(),
      selectAll: vi.fn(() => ({
        data: vi.fn(() => ({
          join: vi.fn(() => ({
            attr: vi.fn().mockReturnThis(),
            text: vi.fn().mockReturnThis(),
            style: vi.fn().mockReturnThis(),
            on: vi.fn().mockReturnThis(),
            append: vi.fn(() => ({
              attr: vi.fn().mockReturnThis(),
              text: vi.fn().mockReturnThis(),
            })),
          })),
        })),
      })),
    })),
  })),
  hierarchy: vi.fn(() => ({
    sum: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
  })),
  partition: vi.fn(() => ({
    size: vi.fn(() => ({
      padding: vi.fn(() => vi.fn(() => ({
        descendants: vi.fn(() => []),
      }))),
    })),
  })),
  scaleSequential: vi.fn(() => ({
    domain: vi.fn().mockReturnThis(),
  })),
  interpolateYlOrRd: vi.fn(),
  max: vi.fn(() => 16),
}));

import { useProfilerStore, selectSelectedCommit } from '@/panel/stores/profilerStore';
import { analysisWorker } from '@/panel/workers/workerClient';

const mockUseProfilerStore = useProfilerStore as unknown as ReturnType<typeof vi.fn>;
const mockSelectSelectedCommit = selectSelectedCommit as unknown as ReturnType<typeof vi.fn>;
const mockGenerateFlamegraph = analysisWorker.generateFlamegraph as unknown as ReturnType<typeof vi.fn>;

describe('Flamegraph', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "Select a commit" empty state', () => {
    mockUseProfilerStore.mockImplementation((selector) => {
      if (selector === mockSelectSelectedCommit) return null;
      return {};
    });

    render(<Flamegraph />);

    expect(screen.getByText(/select a commit to view flamegraph/i)).toBeInTheDocument();
  });

  it('renders error state with message', async () => {
    mockUseProfilerStore.mockImplementation((selector) => {
      if (selector === mockSelectSelectedCommit) return {
        id: '1',
        timestamp: 1000,
        duration: 10,
        nodes: [],
      };
      return {};
    });
    mockGenerateFlamegraph.mockRejectedValue(new Error('Failed to generate flamegraph'));

    render(<Flamegraph />);

    await waitFor(() => {
      expect(screen.getByText(/failed to render flamegraph/i)).toBeInTheDocument();
      expect(screen.getByText(/failed to generate flamegraph/i)).toBeInTheDocument();
    });
  });
});
