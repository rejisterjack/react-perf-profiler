import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TreeNode } from '@/panel/components/ComponentTree/TreeNode';
import type { TreeNode as TreeNodeType } from '@/panel/stores/profilerStore';

describe('TreeNode', () => {
  const createMockNode = (overrides: Partial<TreeNodeType> = {}): TreeNodeType => ({
    id: 'node-1',
    name: 'TestComponent',
    depth: 0,
    hasChildren: true,
    isExpanded: false,
    isSelected: false,
    renderCount: 5,
    wastedRenders: 2,
    averageDuration: 1.5,
    isMemoized: false,
    severity: 'warning',
    parentId: null,
    childIds: [],
    fiberId: 1,
    ...overrides,
  });

  it('should render component name', () => {
    const node = createMockNode();
    render(
      <TreeNode
        node={node}
        isSelected={false}
        isExpanded={false}
        onSelect={vi.fn()}
        onToggle={vi.fn()}
      />
    );
    expect(screen.getByText('TestComponent')).toBeInTheDocument();
  });

  it('should render with correct ARIA attributes', () => {
    const node = createMockNode();
    render(
      <TreeNode
        node={node}
        isSelected={false}
        isExpanded={false}
        onSelect={vi.fn()}
        onToggle={vi.fn()}
      />
    );
    const treeItem = screen.getByRole('treeitem');
    expect(treeItem).toHaveAttribute('aria-selected', 'false');
    expect(treeItem).toHaveAttribute('aria-level', '1');
    expect(treeItem).toHaveAttribute('data-node-id', 'node-1');
  });

  it('should show selected state', () => {
    const node = createMockNode();
    const { rerender } = render(
      <TreeNode
        node={node}
        isSelected={false}
        isExpanded={false}
        onSelect={vi.fn()}
        onToggle={vi.fn()}
      />
    );
    
    rerender(
      <TreeNode
        node={node}
        isSelected={true}
        isExpanded={false}
        onSelect={vi.fn()}
        onToggle={vi.fn()}
      />
    );
    
    const treeItem = screen.getByRole('treeitem');
    expect(treeItem).toHaveAttribute('aria-selected', 'true');
  });

  it('should show expanded state with chevron down', () => {
    const node = createMockNode({ hasChildren: true });
    render(
      <TreeNode
        node={node}
        isSelected={false}
        isExpanded={true}
        onSelect={vi.fn()}
        onToggle={vi.fn()}
      />
    );
    
    const toggleButton = screen.getByRole('button');
    expect(toggleButton).toHaveAttribute('aria-label', 'Collapse TestComponent');
  });

  it('should show collapsed state with chevron right', () => {
    const node = createMockNode({ hasChildren: true });
    render(
      <TreeNode
        node={node}
        isSelected={false}
        isExpanded={false}
        onSelect={vi.fn()}
        onToggle={vi.fn()}
      />
    );
    
    const toggleButton = screen.getByRole('button');
    expect(toggleButton).toHaveAttribute('aria-label', 'Expand TestComponent');
  });

  it('should hide toggle button when no children', () => {
    const node = createMockNode({ hasChildren: false });
    render(
      <TreeNode
        node={node}
        isSelected={false}
        isExpanded={false}
        onSelect={vi.fn()}
        onToggle={vi.fn()}
      />
    );
    
    const toggleButton = screen.getByRole('button');
    expect(toggleButton).toBeDisabled();
  });

  it('should call onSelect when node is clicked', () => {
    const node = createMockNode();
    const onSelect = vi.fn();
    render(
      <TreeNode
        node={node}
        isSelected={false}
        isExpanded={false}
        onSelect={onSelect}
        onToggle={vi.fn()}
      />
    );
    
    fireEvent.click(screen.getByRole('treeitem'));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('should call onToggle when toggle button is clicked', () => {
    const node = createMockNode({ hasChildren: true });
    const onToggle = vi.fn();
    render(
      <TreeNode
        node={node}
        isSelected={false}
        isExpanded={false}
        onSelect={vi.fn()}
        onToggle={onToggle}
      />
    );
    
    fireEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('should stop propagation when toggle is clicked', () => {
    const node = createMockNode({ hasChildren: true });
    const onSelect = vi.fn();
    const onToggle = vi.fn();
    render(
      <TreeNode
        node={node}
        isSelected={false}
        isExpanded={false}
        onSelect={onSelect}
        onToggle={onToggle}
      />
    );
    
    const toggleButton = screen.getByRole('button');
    fireEvent.click(toggleButton);
    expect(onSelect).not.toHaveBeenCalled();
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('should handle keyboard toggle with Enter key', () => {
    const node = createMockNode({ hasChildren: true });
    const onToggle = vi.fn();
    render(
      <TreeNode
        node={node}
        isSelected={false}
        isExpanded={false}
        onSelect={vi.fn()}
        onToggle={onToggle}
      />
    );
    
    const toggleButton = screen.getByRole('button');
    fireEvent.keyDown(toggleButton, { key: 'Enter' });
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('should handle keyboard toggle with Space key', () => {
    const node = createMockNode({ hasChildren: true });
    const onToggle = vi.fn();
    render(
      <TreeNode
        node={node}
        isSelected={false}
        isExpanded={false}
        onSelect={vi.fn()}
        onToggle={onToggle}
      />
    );
    
    const toggleButton = screen.getByRole('button');
    fireEvent.keyDown(toggleButton, { key: ' ' });
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('should show wasted renders badge when > 0', () => {
    const node = createMockNode({ wastedRenders: 3 });
    render(
      <TreeNode
        node={node}
        isSelected={false}
        isExpanded={false}
        onSelect={vi.fn()}
        onToggle={vi.fn()}
      />
    );
    
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('should show render count badge', () => {
    const node = createMockNode({ renderCount: 10 });
    render(
      <TreeNode
        node={node}
        isSelected={false}
        isExpanded={false}
        onSelect={vi.fn()}
        onToggle={vi.fn()}
      />
    );
    
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('should show memoized badge for memoized components', () => {
    const node = createMockNode({ isMemoized: true });
    render(
      <TreeNode
        node={node}
        isSelected={false}
        isExpanded={false}
        onSelect={vi.fn()}
        onToggle={vi.fn()}
      />
    );
    
    expect(screen.getByText('M')).toBeInTheDocument();
  });

  it('should apply correct padding based on depth', () => {
    const node = createMockNode({ depth: 2 });
    render(
      <TreeNode
        node={node}
        isSelected={false}
        isExpanded={false}
        onSelect={vi.fn()}
        onToggle={vi.fn()}
      />
    );
    
    const treeItem = screen.getByRole('treeitem');
    expect(treeItem).toHaveStyle({ paddingLeft: '32px' });
  });

  it('should apply correct ARIA level based on depth', () => {
    const node = createMockNode({ depth: 3 });
    render(
      <TreeNode
        node={node}
        isSelected={false}
        isExpanded={false}
        onSelect={vi.fn()}
        onToggle={vi.fn()}
      />
    );
    
    const treeItem = screen.getByRole('treeitem');
    expect(treeItem).toHaveAttribute('aria-level', '4');
  });

  it('should show component name with title attribute', () => {
    const node = createMockNode({ name: 'VeryLongComponentName' });
    render(
      <TreeNode
        node={node}
        isSelected={false}
        isExpanded={false}
        onSelect={vi.fn()}
        onToggle={vi.fn()}
      />
    );
    
    const nameElement = screen.getByText('VeryLongComponentName');
    expect(nameElement).toHaveAttribute('title', 'VeryLongComponentName');
  });

  it('should have data-fiber-id attribute', () => {
    const node = createMockNode({ fiberId: 42 });
    render(
      <TreeNode
        node={node}
        isSelected={false}
        isExpanded={false}
        onSelect={vi.fn()}
        onToggle={vi.fn()}
      />
    );
    
    const treeItem = screen.getByRole('treeitem');
    expect(treeItem).toHaveAttribute('data-fiber-id', '42');
  });

  it('should render with different severity levels', () => {
    const severities: Array<'none' | 'info' | 'warning' | 'critical'> = ['none', 'info', 'warning', 'critical'];
    
    severities.forEach((severity) => {
      const node = createMockNode({ severity, id: `node-${severity}` });
      const { unmount } = render(
        <TreeNode
          node={node}
          isSelected={false}
          isExpanded={false}
          onSelect={vi.fn()}
          onToggle={vi.fn()}
        />
      );
      
      expect(screen.getByRole('treeitem')).toBeInTheDocument();
      unmount();
    });
  });
});
