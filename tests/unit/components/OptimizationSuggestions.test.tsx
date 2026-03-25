import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OptimizationSuggestions } from '@/panel/components/Analysis/OptimizationSuggestions';
import type { WastedRenderReport, MemoReport } from '@/shared/types';

describe('OptimizationSuggestions', () => {
  const mockWastedReports: WastedRenderReport[] = [
    {
      componentName: 'HeavyComponent',
      renderCount: 20,
      totalRenders: 20,
      wastedRenders: 15,
      wastedRenderRate: 0.75,
      recommendedAction: 'memo',
      estimatedSavingsMs: 50,
      severity: 'critical',
      issues: [],
    },
  ];

  const mockMemoReports: MemoReport[] = [
    {
      componentName: 'MemoComponent',
      hasMemo: true,
      currentHitRate: 0.2,
      optimalHitRate: 0.8,
      isEffective: false,
      issues: [{ type: 'inline-function', description: 'Inline handler', suggestion: 'Use useCallback' }],
      recommendations: [{ type: 'useCallback', description: 'Wrap handler' }],
    },
  ];

  it('renders all good state when no suggestions', () => {
    render(<OptimizationSuggestions wastedReports={[]} memoReports={[]} />);
    
    expect(screen.getByText(/all good/i)).toBeInTheDocument();
    expect(screen.getByText(/no optimization suggestions at this time/i)).toBeInTheDocument();
  });

  it('renders suggestion count', () => {
    render(
      <OptimizationSuggestions 
        wastedReports={mockWastedReports} 
        memoReports={[]} 
      />
    );
    
    expect(screen.getByText(/1 suggestion/i)).toBeInTheDocument();
  });

  it('shows wasted render suggestions', () => {
    render(
      <OptimizationSuggestions 
        wastedReports={mockWastedReports} 
        memoReports={[]} 
      />
    );
    
    // Check that the component name is shown in the title
    expect(screen.getByText(/Wrap HeavyComponent with React.memo/i)).toBeInTheDocument();
    // Check for critical severity badge (use first occurrence)
    expect(screen.getAllByText(/critical/i)[0]).toBeInTheDocument();
  });

  it('shows code view button', () => {
    render(
      <OptimizationSuggestions 
        wastedReports={mockWastedReports} 
        memoReports={[]} 
      />
    );
    
    // Check for the view code button
    expect(screen.getByText(/view code fix/i)).toBeInTheDocument();
  });

  it('shows estimated improvement', () => {
    render(
      <OptimizationSuggestions 
        wastedReports={mockWastedReports} 
        memoReports={[]} 
      />
    );
    
    expect(screen.getByText(/estimated improvement/i)).toBeInTheDocument();
  });

  it('shows memoization suggestions', () => {
    render(
      <OptimizationSuggestions 
        wastedReports={[]} 
        memoReports={mockMemoReports} 
      />
    );
    
    // Check that memo component is listed
    expect(screen.getByText(/MemoComponent/i)).toBeInTheDocument();
    // Check for warning badge
    expect(screen.getByText(/warning/i)).toBeInTheDocument();
  });
});
