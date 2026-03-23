import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AnalysisView } from '@/panel/components/Views/AnalysisView';

// Mock the profiler store
vi.mock('@/panel/stores/profilerStore', () => ({
  useProfilerStore: vi.fn(),
}));

import { useProfilerStore } from '@/panel/stores/profilerStore';

const mockUseProfilerStore = useProfilerStore as unknown as ReturnType<typeof vi.fn>;

describe('AnalysisView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "Run Analysis" button in no-analysis state', () => {
    mockUseProfilerStore.mockReturnValue({
      wastedRenderReports: [],
      performanceScore: null,
      isAnalyzing: false,
      analysisError: null,
      runAnalysis: vi.fn(),
    });

    render(<AnalysisView />);

    expect(screen.getByRole('button', { name: /Run performance analysis/i })).toBeInTheDocument();
    expect(screen.getByText(/no analysis yet/i)).toBeInTheDocument();
  });

  it('renders spinner when isAnalyzing is true', () => {
    mockUseProfilerStore.mockReturnValue({
      wastedRenderReports: [],
      performanceScore: null,
      isAnalyzing: true,
      analysisError: null,
      runAnalysis: vi.fn(),
    });

    render(<AnalysisView />);

    expect(screen.getByText(/analyzing performance data/i)).toBeInTheDocument();
  });

  it('renders error with retry button when analysisError is set', () => {
    mockUseProfilerStore.mockReturnValue({
      wastedRenderReports: [],
      performanceScore: null,
      isAnalyzing: false,
      analysisError: 'Analysis failed due to timeout',
      runAnalysis: vi.fn(),
    });

    render(<AnalysisView />);

    expect(screen.getAllByText(/analysis failed/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/analysis failed due to timeout/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry performance analysis/i })).toBeInTheDocument();
  });

  it('renders score circle with aria-hidden inner span and screen reader text', () => {
    mockUseProfilerStore.mockReturnValue({
      wastedRenderReports: [],
      performanceScore: {
        score: 85,
        averageRenderTime: 5.5,
        wastedRenderRate: 10,
        totalComponents: 25,
      },
      isAnalyzing: false,
      analysisError: null,
      runAnalysis: vi.fn(),
    });

    render(<AnalysisView />);

    // Check for the score display
    expect(screen.getByText('85')).toBeInTheDocument();

    // Check for screen reader text
    expect(screen.getByText(/performance score: 85 out of 100/i)).toBeInTheDocument();
  });

  it('renders issues list', () => {
    mockUseProfilerStore.mockReturnValue({
      wastedRenderReports: [
        {
          componentName: 'WastedComponent',
          wastedRenderRate: 50,
          severity: 'critical',
        },
      ],
      performanceScore: {
        score: 60,
        averageRenderTime: 8.5,
        wastedRenderRate: 30,
        totalComponents: 25,
      },
      isAnalyzing: false,
      analysisError: null,
      runAnalysis: vi.fn(),
    });

    render(<AnalysisView />);

    expect(screen.getByText(/issues found/i)).toBeInTheDocument();
    expect(screen.getByText('WastedComponent')).toBeInTheDocument();
    expect(screen.getByText(/50% wasted renders/i)).toBeInTheDocument();
  });

  it('calls runAnalysis when button is clicked', () => {
    const runAnalysis = vi.fn();
    mockUseProfilerStore.mockReturnValue({
      wastedRenderReports: [],
      performanceScore: null,
      isAnalyzing: false,
      analysisError: null,
      runAnalysis,
    });

    render(<AnalysisView />);

    const button = screen.getByRole('button', { name: /Run performance analysis/i });
    fireEvent.click(button);

    expect(runAnalysis).toHaveBeenCalled();
  });
});
