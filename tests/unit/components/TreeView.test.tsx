import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TreeView } from '@/panel/components/ComponentTree/TreeView';

// Mock the profiler store
vi.mock('@/panel/stores/profilerStore', () => ({
  useProfilerStore: vi.fn(),
}));

// Mock the selectors
vi.mock('@/panel/stores/selectors', () => ({
  selectTreeData: vi.fn(),
}));

import { useProfilerStore } from '@/panel/stores/profilerStore';
import { selectTreeData } from '@/panel/stores/selectors';

const mockUseProfilerStore = useProfilerStore as unknown as ReturnType<typeof vi.fn>;
const mockSelectTreeData = selectTreeData as unknown as ReturnType<typeof vi.fn>;

describe('TreeView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when no data', () => {
    mockSelectTreeData.mockReturnValue(new Map());
    mockUseProfilerStore.mockImplementation((selector) => {
      if (selector === mockSelectTreeData) return new Map();
      return {
        selectedComponent: null,
        selectComponent: vi.fn(),
        expandedNodes: new Set(),
        toggleNodeExpanded: vi.fn(),
        setViewMode: vi.fn(),
      };
    });

    render(<TreeView />);
    
    expect(screen.getByText(/no component data available/i)).toBeInTheDocument();
    expect(screen.getByText(/start recording to capture react component renders/i)).toBeInTheDocument();
  });

  it('has proper ARIA roles', () => {
    const treeData = new Map([
      ['App', { id: '1', name: 'App', hasChildren: true, depth: 0, parentId: null }],
    ]);
    
    mockSelectTreeData.mockReturnValue(treeData);
    mockUseProfilerStore.mockImplementation((selector) => {
      if (selector === mockSelectTreeData) return treeData;
      return {
        selectedComponent: null,
        selectComponent: vi.fn(),
        expandedNodes: new Set(),
        toggleNodeExpanded: vi.fn(),
        setViewMode: vi.fn(),
      };
    });

    render(<TreeView />);
    
    const tree = screen.getByRole('tree');
    expect(tree).toBeInTheDocument();
    expect(tree).toHaveAttribute('aria-label', 'Component tree');
  });

  it('is keyboard accessible', () => {
    const treeData = new Map([
      ['App', { id: '1', name: 'App', hasChildren: true, depth: 0, parentId: null }],
      ['Header', { id: '2', name: 'Header', hasChildren: false, depth: 1, parentId: '1' }],
    ]);
    
    mockSelectTreeData.mockReturnValue(treeData);
    mockUseProfilerStore.mockImplementation((selector) => {
      if (selector === mockSelectTreeData) return treeData;
      return {
        selectedComponent: null,
        selectComponent: vi.fn(),
        expandedNodes: new Set(),
        toggleNodeExpanded: vi.fn(),
        setViewMode: vi.fn(),
      };
    });

    render(<TreeView />);
    
    const tree = screen.getByRole('tree');
    expect(tree).toHaveAttribute('tabIndex', '0');
  });
});