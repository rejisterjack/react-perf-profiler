import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Icon } from '@/panel/components/Common/Icon/Icon';

describe('Icon', () => {
  it('should render icon', () => {
    render(<Icon name="record" />);
    expect(document.querySelector('svg')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    render(<Icon name="record" className="custom-icon" />);
    expect(document.querySelector('svg')).toHaveClass('custom-icon');
  });

  it('should render different icon names', () => {
    const { rerender } = render(<Icon name="record" />);
    expect(document.querySelector('svg')).toBeInTheDocument();

    rerender(<Icon name="stop" />);
    expect(document.querySelector('svg')).toBeInTheDocument();

    rerender(<Icon name="clear" />);
    expect(document.querySelector('svg')).toBeInTheDocument();

    rerender(<Icon name="settings" />);
    expect(document.querySelector('svg')).toBeInTheDocument();
  });

  it('should have aria-hidden attribute', () => {
    render(<Icon name="record" />);
    expect(document.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('should have focusable false', () => {
    render(<Icon name="record" />);
    expect(document.querySelector('svg')).toHaveAttribute('focusable', 'false');
  });
});
