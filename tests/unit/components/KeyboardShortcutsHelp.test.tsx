import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { KeyboardShortcutsHelp } from '@/panel/components/Common/KeyboardShortcutsHelp/KeyboardShortcutsHelp';

vi.mock('focus-trap-react', () => ({ default: ({ children }: { children: React.ReactNode }) => children }));

describe('KeyboardShortcutsHelp', () => {
  const mockShortcuts = [
    { key: 'r', description: 'Start/Stop recording', category: 'recording', preventDefault: false, requireNonInput: false, feedbackMessage: undefined },
    { key: 'c', description: 'Clear data', category: 'data', preventDefault: false, requireNonInput: false, feedbackMessage: undefined },
  ];

  it('renders nothing when closed', () => {
    const { container } = render(
      <KeyboardShortcutsHelp 
        isOpen={false} 
        onClose={vi.fn()} 
        shortcuts={mockShortcuts} 
      />
    );
    
    expect(container.firstChild).toBeNull();
  });

  it('renders dialog when open', () => {
    render(
      <KeyboardShortcutsHelp 
        isOpen={true} 
        onClose={vi.fn()} 
        shortcuts={mockShortcuts} 
      />
    );
    
    expect(screen.getByRole('dialog', { hidden: true })).toBeInTheDocument();
    expect(screen.getByText(/keyboard shortcuts/i)).toBeInTheDocument();
  });

  it('calls onClose when Escape key pressed', () => {
    const onClose = vi.fn();
    render(
      <KeyboardShortcutsHelp 
        isOpen={true} 
        onClose={onClose} 
        shortcuts={mockShortcuts} 
      />
    );
    
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when overlay clicked', () => {
    const onClose = vi.fn();
    const { container } = render(
      <KeyboardShortcutsHelp 
        isOpen={true} 
        onClose={onClose} 
        shortcuts={mockShortcuts} 
      />
    );
    
    const overlay = container.querySelector('[aria-hidden="true"]');
    if (overlay) {
      fireEvent.click(overlay);
      expect(onClose).toHaveBeenCalled();
    }
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(
      <KeyboardShortcutsHelp 
        isOpen={true} 
        onClose={onClose} 
        shortcuts={mockShortcuts} 
      />
    );
    
    const closeButton = screen.getByRole('button', { name: /close keyboard shortcuts help/i, hidden: true });
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalled();
  });

  it('renders shortcut categories', () => {
    render(
      <KeyboardShortcutsHelp 
        isOpen={true} 
        onClose={vi.fn()} 
        shortcuts={mockShortcuts} 
      />
    );
    
    expect(screen.getByText(/start\/stop recording/i)).toBeInTheDocument();
    expect(screen.getByText(/clear data/i)).toBeInTheDocument();
  });

  it('has proper ARIA attributes', () => {
    render(
      <KeyboardShortcutsHelp 
        isOpen={true} 
        onClose={vi.fn()} 
        shortcuts={mockShortcuts} 
      />
    );
    
    const dialog = screen.getByRole('dialog', { hidden: true });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'keyboard-shortcuts-title');
  });
});