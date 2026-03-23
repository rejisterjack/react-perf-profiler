import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CircularProgress } from '@/panel/components/Common/CircularProgress/CircularProgress';

describe('CircularProgress', () => {
  it('renders with default value', () => {
    const { container } = render(<CircularProgress value={50} />);
    
    const progressbar = container.querySelector('[role="progressbar"]');
    expect(progressbar).toBeInTheDocument();
    expect(progressbar).toHaveAttribute('aria-valuenow', '50');
    expect(progressbar).toHaveAttribute('aria-valuemin', '0');
    expect(progressbar).toHaveAttribute('aria-valuemax', '100');
  });

  it('clamps value between 0 and 100', () => {
    const { container: container1 } = render(<CircularProgress value={-10} />);
    expect(container1.querySelector('[role="progressbar"]')).toHaveAttribute('aria-valuenow', '0');
    
    const { container: container2 } = render(<CircularProgress value={150} />);
    expect(container2.querySelector('[role="progressbar"]')).toHaveAttribute('aria-valuenow', '100');
  });

  it('displays percentage label by default', () => {
    render(<CircularProgress value={75} />);
    
    expect(screen.getByText('75')).toBeInTheDocument();
  });

  it('hides label when showLabel is false', () => {
    render(<CircularProgress value={75} showLabel={false} />);
    
    expect(screen.queryByText('75')).not.toBeInTheDocument();
  });

  it('accepts custom aria-label', () => {
    const { container } = render(
      <CircularProgress value={50} aria-label="Performance score" aria-valuetext="50 out of 100" />
    );
    
    const progressbar = container.querySelector('[role="progressbar"]');
    expect(progressbar).toHaveAttribute('aria-label', 'Performance score');
    expect(progressbar).toHaveAttribute('aria-valuetext', '50 out of 100');
  });

  it('applies different color variants', () => {
    const { container: container1 } = render(<CircularProgress value={25} color="error" />);
    expect(container1.firstChild).toHaveClass('error');
    
    const { container: container2 } = render(<CircularProgress value={75} color="success" />);
    expect(container2.firstChild).toHaveClass('success');
  });

  it('accepts custom size', () => {
    const { container } = render(<CircularProgress value={50} size={100} />);
    
    expect(container.firstChild).toHaveStyle({ width: '100px', height: '100px' });
  });
});