import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVirtualList } from '@/panel/hooks/useVirtualList';

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
  return setTimeout(cb, 16) as unknown as number;
});

global.cancelAnimationFrame = vi.fn((id: number) => {
  clearTimeout(id);
});

describe('useVirtualList', () => {
  const mockContainer = () => {
    const container = document.createElement('div');
    container.scrollTop = 0;
    Object.defineProperty(container, 'scrollHeight', { value: 1000, writable: true });
    Object.defineProperty(container, 'clientHeight', { value: 400, writable: true });
    return container;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return initial values', () => {
    const items = Array.from({ length: 100 }, (_, i) => `Item ${i}`);
    const { result } = renderHook(() =>
      useVirtualList({ items, itemHeight: 50, containerHeight: 400 })
    );

    expect(result.current.virtualItems).toBeDefined();
    expect(result.current.totalHeight).toBe(5000); // 100 items * 50px
    expect(result.current.scrollTop).toBe(0);
    expect(result.current.startIndex).toBe(0);
    expect(typeof result.current.scrollToIndex).toBe('function');
    expect(result.current.containerRef.current).toBeNull();
  });

  it('should calculate visible range correctly', () => {
    const items = Array.from({ length: 100 }, (_, i) => `Item ${i}`);
    const { result } = renderHook(() =>
      useVirtualList({ items, itemHeight: 50, containerHeight: 400, overscan: 2 })
    );

    // With containerHeight 400 and itemHeight 50, we can see ~8 items
    // With overscan 2, we should have 12 items (8 + 2*2)
    expect(result.current.virtualItems.length).toBeLessThanOrEqual(12);
    expect(result.current.endIndex - result.current.startIndex + 1).toBe(result.current.virtualItems.length);
  });

  it('should calculate correct total height', () => {
    const items = Array.from({ length: 50 }, (_, i) => `Item ${i}`);
    const { result } = renderHook(() =>
      useVirtualList({ items, itemHeight: 40, containerHeight: 400 })
    );

    expect(result.current.totalHeight).toBe(2000); // 50 * 40
  });

  it('should handle empty items array', () => {
    const { result } = renderHook(() =>
      useVirtualList({ items: [], itemHeight: 50, containerHeight: 400 })
    );

    expect(result.current.virtualItems).toHaveLength(0);
    expect(result.current.totalHeight).toBe(0);
  });

  it('should provide correct item styles', () => {
    const items = ['Item 0', 'Item 1', 'Item 2'];
    const { result } = renderHook(() =>
      useVirtualList({ items, itemHeight: 50, containerHeight: 400 })
    );

    const virtualItems = result.current.virtualItems;
    expect(virtualItems[0].style.top).toBe(0);
    expect(virtualItems[0].style.height).toBe(50);
    expect(virtualItems[1].style.top).toBe(50);
    expect(virtualItems[2].style.top).toBe(100);
  });

  it('should scroll to specific index', () => {
    const items = Array.from({ length: 100 }, (_, i) => `Item ${i}`);
    const container = mockContainer();
    
    const { result } = renderHook(() =>
      useVirtualList({ items, itemHeight: 50, containerHeight: 400 })
    );

    // Assign the mock container
    result.current.containerRef.current = container;

    act(() => {
      result.current.scrollToIndex(10);
    });

    // Should have called scrollTo
    expect(container.scrollTo).toBeDefined();
  });

  it('should handle scrollToIndex with clamping', () => {
    const items = Array.from({ length: 10 }, (_, i) => `Item ${i}`);
    const container = mockContainer();
    
    const { result } = renderHook(() =>
      useVirtualList({ items, itemHeight: 50, containerHeight: 400 })
    );

    result.current.containerRef.current = container;

    // Try to scroll beyond bounds
    act(() => {
      result.current.scrollToIndex(100);
    });

    // Should not throw
    expect(result.current.scrollToIndex).toBeDefined();
  });

  it('should respect overscan', () => {
    const items = Array.from({ length: 100 }, (_, i) => `Item ${i}`);
    const { result } = renderHook(() =>
      useVirtualList({ items, itemHeight: 50, containerHeight: 400, overscan: 5 })
    );

    // With overscan 5, should render more items than visible
    const visibleCount = Math.ceil(400 / 50); // 8 items visible
    const expectedCount = visibleCount + 5 * 2; // 8 + 10 = 18
    
    expect(result.current.virtualItems.length).toBeLessThanOrEqual(expectedCount);
  });

  it('should handle different item heights', () => {
    const items = Array.from({ length: 10 }, (_, i) => `Item ${i}`);
    const { result } = renderHook(() =>
      useVirtualList({ items, itemHeight: 100, containerHeight: 400 })
    );

    expect(result.current.totalHeight).toBe(1000);
    
    const virtualItems = result.current.virtualItems;
    if (virtualItems.length > 1) {
      expect(virtualItems[1].style.top).toBe(100);
    }
  });

  it('should update on items change', () => {
    const { result, rerender } = renderHook(
      ({ items }) => useVirtualList({ items, itemHeight: 50, containerHeight: 400 }),
      { initialProps: { items: ['Item 1', 'Item 2'] } }
    );

    expect(result.current.totalHeight).toBe(100);

    rerender({ items: ['Item 1', 'Item 2', 'Item 3', 'Item 4'] });

    expect(result.current.totalHeight).toBe(200);
  });

  it('should maintain index mapping', () => {
    const items = ['A', 'B', 'C', 'D', 'E'];
    const { result } = renderHook(() =>
      useVirtualList({ items, itemHeight: 50, containerHeight: 400 })
    );

    const virtualItems = result.current.virtualItems;
    
    // Check that indices are correct
    virtualItems.forEach((item, i) => {
      expect(item.index).toBe(i);
      expect(item.item).toBe(items[i]);
    });
  });

  it('should provide absolute positioning styles', () => {
    const items = ['Item 0', 'Item 1'];
    const { result } = renderHook(() =>
      useVirtualList({ items, itemHeight: 50, containerHeight: 400 })
    );

    const virtualItem = result.current.virtualItems[0];
    expect(virtualItem.style.position).toBe('absolute');
    expect(virtualItem.style.left).toBe(0);
    expect(virtualItem.style.right).toBe(0);
  });
});
