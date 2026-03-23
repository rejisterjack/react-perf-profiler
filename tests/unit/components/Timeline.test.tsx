import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Timeline } from '@/panel/components/Visualizations/Timeline';

// Mock the profiler store
vi.mock('@/panel/stores/profilerStore', () => ({
  useProfilerStore: vi.fn(),
}));

// Mock the worker client
vi.mock('@/panel/workers/workerClient', () => ({
  timelineWorker: {
    generateTimeline: vi.fn(),
    cancel: vi.fn(),
  },
}));

// Mock d3
vi.mock('d3', () => ({
  select: vi.fn(() => ({
    selectAll: vi.fn(() => ({
      remove: vi.fn(),
    })),
    append: vi.fn(() => ({
      attr: vi.fn().mockReturnThis(),
      call: vi.fn().mockReturnThis(),
      text: vi.fn().mockReturnThis(),
      selectAll: vi.fn(() => ({
        data: vi.fn(() => ({
          join: vi.fn(() => ({
            attr: vi.fn().mockReturnThis(),
            on: vi.fn().mockReturnThis(),
          })),
        })),
      })),
    })),
  })),
  extent: vi.fn(() => [0, 1000]),
  scaleLinear: vi.fn(() => ({
    domain: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    nice: vi.fn().mockReturnThis(),
    ticks: vi.fn(() => [0, 500, 1000]),
  })),
  axisBottom: vi.fn(() => ({
    tickFormat: vi.fn().mockReturnThis(),
    ticks: vi.fn().mockReturnThis(),
    scale: vi.fn().mockReturnThis(),
  })),
  axisLeft: vi.fn(() => ({
    ticks: vi.fn().mockReturnThis(),
  })),
  zoom: vi.fn(() => ({
    scaleExtent: vi.fn().mockReturnThis(),
    extent: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    transform: vi.fn().mockReturnThis(),
  })),
  zoomIdentity: {},
}));

import { useProfilerStore } from '@/panel/stores/profilerStore';
import { timelineWorker } from '@/panel/workers/workerClient';

const mockUseProfilerStore = useProfilerStore as unknown as ReturnType<typeof vi.fn>;
const mockGenerateTimeline = timelineWorker.generateTimeline as unknown as ReturnType<typeof vi.fn>;

describe('Timeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "Record some commits" empty state', () => {
    mockUseProfilerStore.mockReturnValue({ commits: [] });

    render(<Timeline />);

    expect(screen.getByText(/record some commits to see timeline/i)).toBeInTheDocument();
  });

  it('renders loading spinner', async () => {
    mockUseProfilerStore.mockReturnValue({
      commits: [{ id: '1', timestamp: 1000, duration: 10, nodes: [] }],
    });

    // Make generateTimeline return a pending promise
    mockGenerateTimeline.mockReturnValue(new Promise(() => {}));

    render(<Timeline />);

    expect(screen.getByText(/generating timeline/i)).toBeInTheDocument();
  });

  it('renders SVG with role="img" and aria-label', async () => {
    mockUseProfilerStore.mockReturnValue({
      commits: [{ id: '1', timestamp: 1000, duration: 10, nodes: [] }],
    });

    mockGenerateTimeline.mockResolvedValue({
      timeline: {
        events: [],
        startTime: 0,
        endTime: 1000,
      },
    });

    render(<Timeline />);

    // Wait for the async effect to complete
    await vi.waitFor(() => {
      const svg = screen.getByRole('img');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('aria-label', expect.stringContaining('Timeline'));
    });
  });

  it('Reset Zoom button has aria-label', async () => {
    mockUseProfilerStore.mockReturnValue({
      commits: [{ id: '1', timestamp: 1000, duration: 10, nodes: [] }],
    });

    mockGenerateTimeline.mockResolvedValue({
      timeline: {
        events: [],
        startTime: 0,
        endTime: 1000,
      },
    });

    render(<Timeline />);

    await vi.waitFor(() => {
      expect(screen.getByRole('button', { name: /reset zoom/i })).toBeInTheDocument();
    });
  });

  it('has wasted filter checkbox', async () => {
    mockUseProfilerStore.mockReturnValue({
      commits: [{ id: '1', timestamp: 1000, duration: 10, nodes: [] }],
    });

    mockGenerateTimeline.mockResolvedValue({
      timeline: {
        events: [],
        startTime: 0,
        endTime: 1000,
      },
    });

    render(<Timeline />);

    await vi.waitFor(() => {
      const checkbox = screen.getByRole('checkbox', { name: /wasted renders only/i });
      expect(checkbox).toBeInTheDocument();
    });
  });
});
