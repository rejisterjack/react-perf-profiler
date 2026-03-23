import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OptimizationSuggestions } from '@/panel/components/Analysis/OptimizationSuggestions';
import type { WastedRenderReport, MemoEffectivenessReport } from '@/shared/types';

describe('OptimizationSuggestions', () => {
  const mockWastedReports: WastedRenderReport[] = [
    {
      componentName: 'HeavyComponent',
      totalRenders: 20,
      wastedRenders: 15,
      wastedRenderRate: 0.75,
      recommendedAction: 'memo',
      estimatedSavingsMs: 50,
      severity: 'critical',
      issues: [],
    },
  ];

  const mockMemoReports: MemoEffectivenessReport[] = [
    {
      componentName: 'MemoComponent',
      hasMemo: true,
      currentHitRate: 0.2,
      optimalHitRate: 0.8,
      isEffective: false,
      issues: [{ type: 'inline-function', propName: 'onClick', description: 'Inline handler', suggestion: 'Use useCallback' }],
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
    
    expect(screen.getByText(/high wasted render rate in heavycomponent/i)).toBeInTheDocument();
    expect(screen.getByText(/critical/i)).toBeInTheDocument();
  });

  it('shows code examples', () => {
    render(
      <OptimizationSuggestions 
        wastedReports={mockWastedReports} 
        memoReports={[]} 
      />
    );
    
    expect(screen.getByText(/react.memo/i)).toBeInTheDocument();
  });

  it('shows estimated impact', () => {
    render(
      <OptimizationSuggestions 
        wastedReports={mockWastedReports} 
        memoReports={[]} 
      />
    );
    
    expect(screen.getByText(/estimated impact/i)).toBeInTheDocument();
    expect(screen.getByText(/~50.0ms per interaction/i)).toBeInTheDocument();
  });

  it('shows memoization suggestions', () => {
    render(
      <OptimizationSuggestions 
        wastedReports={[]} 
        memoReports={mockMemoReports} 
      />
    );
    
    expect(screen.getByText(/memoization issue: inline-function/i)).toBeInTheDocument();
  });
});