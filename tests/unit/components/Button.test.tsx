import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '@/panel/components/Common/Button/Button';

describe('Button', () => {
  it('should render button with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('should apply default variant and size', () => {
    render(<Button>Test</Button>);
    const button = screen.getByRole('button');
    // Check for CSS module classes (hashed in production, clean in tests)
    expect(button.className).toMatch(/button/);
    expect(button.className).toMatch(/secondary/);
    expect(button.className).toMatch(/md/);
  });

  it('should apply primary variant', () => {
    render(<Button variant="primary">Test</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toMatch(/primary/);
  });

  it('should apply danger variant', () => {
    render(<Button variant="danger">Delete</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toMatch(/danger/);
  });

  it('should apply ghost variant', () => {
    render(<Button variant="ghost">Cancel</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toMatch(/ghost/);
  });

  it('should apply small size', () => {
    render(<Button size="sm">Small</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toMatch(/sm/);
  });

  it('should apply large size', () => {
    render(<Button size="lg">Large</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toMatch(/lg/);
  });

  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('should be disabled when loading', () => {
    render(<Button loading>Loading</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('should show spinner when loading', () => {
    render(<Button loading>Loading</Button>);
    // The spinner is a span with class containing 'spinner'
    const button = screen.getByRole('button');
    expect(button.querySelector('[class*="spinner"]')).toBeInTheDocument();
  });

  it('should forward ref', () => {
    const ref = { current: null as HTMLButtonElement | null };
    render(<Button ref={ref}>Test</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it('should apply custom className', () => {
    render(<Button className="custom-class">Test</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-class');
  });

  it('should handle click events', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    
    screen.getByRole('button').click();
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should not handle click when disabled', () => {
    const handleClick = vi.fn();
    render(<Button disabled onClick={handleClick}>Click</Button>);
    
    screen.getByRole('button').click();
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('should render with type attribute', () => {
    render(<Button type="submit">Submit</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('type', 'submit');
  });
});
