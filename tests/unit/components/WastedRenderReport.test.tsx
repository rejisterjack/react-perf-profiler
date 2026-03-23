import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WastedRenderReport } from '@/panel/components/Analysis/WastedRenderReport';
import type { WastedRenderReport as WastedRenderReportType } from '@/shared/types';

describe('WastedRenderReport', () => {
  const mockReports: WastedRenderReportType[] = [
    {
      componentName: 'App',
      totalRenders: 10,
      wastedRenders: 5,
      wastedRenderRate: 0.5,
      recommendedAction: 'memo',
      estimatedSavingsMs: 10,
      severity: 'critical',
      issues: [],
    },
    {
      componentName: 'Header',
      totalRenders: 8,
      wastedRenders: 2,
      wastedRenderRate: 0.25,
      recommendedAction: 'useCallback',
      estimatedSavingsMs: 5,
      severity: 'warning',
      issues: [],
    },
  ];

  it('renders empty state when no reports', () => {
    render(<WastedRenderReport reports={[]} />);
    
    expect(screen.getByText(/no wasted renders detected/i)).toBeInTheDocument();
  });

  it('renders report header with critical count', () => {
    render(<WastedRenderReport reports={mockReports} />);
    
    expect(screen.getByRole('heading', { name: /wasted renders/i })).toBeInTheDocument();
    expect(screen.getByText(/1 critical/i)).toBeInTheDocument();
  });

  it('renders component reports sorted by rate', () => {
    render(<WastedRenderReport reports={mockReports} />);
    
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    
    // App should come first (50% rate)
    expect(items[0]).toHaveTextContent('App');
    expect(items[0]).toHaveTextContent('50%');
  });

  it('shows action recommendations', () => {
    render(<WastedRenderReport reports={mockReports} />);
    
    expect(screen.getByText(/wrap with react.memo/i)).toBeInTheDocument();
  });

  it('shows render stats', () => {
    render(<WastedRenderReport reports={mockReports} />);
    
    expect(screen.getByText(/10 renders/i)).toBeInTheDocument();
    expect(screen.getByText(/5 wasted/i)).toBeInTheDocument();
    expect(screen.getByText(/10.0ms saved/i)).toBeInTheDocument();
  });
});