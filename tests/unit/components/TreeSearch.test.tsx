import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TreeSearch, type SeverityFilter } from '@/panel/components/ComponentTree/TreeSearch';

describe('TreeSearch', () => {
  const defaultProps = {
    value: '',
    onChange: vi.fn(),
    severityFilter: [] as SeverityFilter[],
    onSeverityFilterChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders search input with proper ARIA attributes', () => {
    render(<TreeSearch {...defaultProps} />);
    
    const input = screen.getByRole('searchbox');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-label', 'Filter components by name');
    expect(input).toHaveAttribute('placeholder', 'Filter components...');
  });

  it('calls onChange when input changes', () => {
    render(<TreeSearch {...defaultProps} />);
    
    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'App' } });
    
    expect(defaultProps.onChange).toHaveBeenCalledWith('App');
  });

  it('calls onChange with empty string when Escape is pressed', () => {
    const onChange = vi.fn();
    render(<TreeSearch {...defaultProps} value="test" onChange={onChange} />);
    
    const input = screen.getByRole('searchbox');
    fireEvent.keyDown(input, { key: 'Escape' });
    
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('displays results count when provided', () => {
    render(<TreeSearch {...defaultProps} resultsCount={5} totalCount={10} />);
    
    expect(screen.getByText('5 / 10')).toBeInTheDocument();
    expect(screen.getByText('5 / 10')).toHaveAttribute('aria-live', 'polite');
  });

  it('renders severity filter buttons with proper ARIA', () => {
    render(<TreeSearch {...defaultProps} />);
    
    const toolbar = screen.getByRole('toolbar');
    expect(toolbar).toHaveAttribute('aria-label', 'Filter by severity');
    
    const criticalButton = screen.getByRole('button', { name: /filter by critical severity/i });
    expect(criticalButton).toHaveAttribute('aria-pressed', 'false');
    expect(criticalButton).toBeInTheDocument();
  });

  it('toggles severity filter on button click', () => {
    const onSeverityFilterChange = vi.fn();
    render(
      <TreeSearch 
        {...defaultProps} 
        onSeverityFilterChange={onSeverityFilterChange} 
      />
    );
    
    const criticalButton = screen.getByRole('button', { name: /filter by critical severity/i });
    fireEvent.click(criticalButton);
    
    expect(onSeverityFilterChange).toHaveBeenCalledWith(['critical']);
  });

  it('shows clear button when value is present', () => {
    render(<TreeSearch {...defaultProps} value="test" />);
    
    const clearButton = screen.getByRole('button', { name: /clear search/i });
    expect(clearButton).toBeInTheDocument();
    
    fireEvent.click(clearButton);
    expect(defaultProps.onChange).toHaveBeenCalledWith('');
  });

  it('toggles off active severity filter', () => {
    const onSeverityFilterChange = vi.fn();
    render(
      <TreeSearch 
        {...defaultProps} 
        severityFilter={['critical']}
        onSeverityFilterChange={onSeverityFilterChange} 
      />
    );
    
    const criticalButton = screen.getByRole('button', { name: /filter by critical severity/i });
    expect(criticalButton).toHaveAttribute('aria-pressed', 'true');
    
    fireEvent.click(criticalButton);
    expect(onSeverityFilterChange).toHaveBeenCalledWith([]);
  });
});