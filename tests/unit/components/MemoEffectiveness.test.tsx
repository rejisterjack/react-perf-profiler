import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoEffectiveness } from '@/panel/components/Analysis/MemoEffectiveness';
import type { MemoEffectivenessReport } from '@/shared/types';

describe('MemoEffectiveness', () => {
  const mockReports: MemoEffectivenessReport[] = [
    {
      componentName: 'ExpensiveComponent',
      hasMemo: true,
      currentHitRate: 0.3,
      optimalHitRate: 0.9,
      isEffective: false,
      issues: [
        { type: 'unstable-callback', propName: 'onClick', description: 'Unstable callback', suggestion: 'Use useCallback' },
      ],
      recommendations: [{ type: 'useCallback', description: 'Wrap callbacks' }],
    },
    {
      componentName: 'GoodComponent',
      hasMemo: true,
      currentHitRate: 0.9,
      optimalHitRate: 0.95,
      isEffective: true,
      issues: [],
      recommendations: [],
    },
  ];

  it('renders empty state when no reports', () => {
    render(<MemoEffectiveness reports={[]} />);
    
    expect(screen.getByText(/no memoized components found/i)).toBeInTheDocument();
  });

  it('shows ineffective count badge', () => {
    render(<MemoEffectiveness reports={mockReports} />);
    
    expect(screen.getByText(/1 issues/i)).toBeInTheDocument();
  });

  it('shows component effectiveness', () => {
    render(<MemoEffectiveness reports={mockReports} />);
    
    expect(screen.getByText(/expensivecomponent/i)).toBeInTheDocument();
    expect(screen.getByText('30%')).toBeInTheDocument();
  });

  it('shows improvement potential', () => {
    render(<MemoEffectiveness reports={mockReports} />);
    
    // ExpensiveComponent has optimal 90% and shows improvement
    expect(screen.getByText(/\+60%/i)).toBeInTheDocument(); // Improvement
    // Check that optimal hit rate is shown somewhere
    expect(screen.getAllByText(/90%/i).length).toBeGreaterThan(0);
  });

  it('shows issue suggestions', () => {
    render(<MemoEffectiveness reports={mockReports} />);
    
    expect(screen.getByText(/use usecallback/i)).toBeInTheDocument();
  });
});