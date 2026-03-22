import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useDebounce,
  useDebouncedCallback,
  useDebounceState,
} from '@/panel/hooks/useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 500));
    
    expect(result.current).toBe('initial');
  });

  it('should debounce value updates', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'initial' } }
    );
    
    rerender({ value: 'updated' });
    expect(result.current).toBe('initial');
    
    act(() => {
      vi.advanceTimersByTime(500);
    });
    
    expect(result.current).toBe('updated');
  });

  it('should reset timer on rapid changes', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'initial' } }
    );
    
    rerender({ value: 'change1' });
    
    act(() => {
      vi.advanceTimersByTime(300);
    });
    
    rerender({ value: 'change2' });
    
    act(() => {
      vi.advanceTimersByTime(300);
    });
    
    // Should still be initial because timer was reset
    expect(result.current).toBe('initial');
    
    act(() => {
      vi.advanceTimersByTime(200);
    });
    
    expect(result.current).toBe('change2');
  });

  it('should handle number values', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 100),
      { initialProps: { value: 0 } }
    );
    
    rerender({ value: 42 });
    
    act(() => {
      vi.advanceTimersByTime(100);
    });
    
    expect(result.current).toBe(42);
  });

  it('should handle object values', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 100),
      { initialProps: { value: { a: 1 } } }
    );
    
    const newValue = { a: 2 };
    rerender({ value: newValue });
    
    act(() => {
      vi.advanceTimersByTime(100);
    });
    
    expect(result.current).toBe(newValue);
  });
});

describe('useDebouncedCallback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should debounce callback execution', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 500));
    
    act(() => {
      result.current('arg1');
    });
    
    expect(callback).not.toHaveBeenCalled();
    
    act(() => {
      vi.advanceTimersByTime(500);
    });
    
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('arg1');
  });

  it('should pass multiple arguments', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 100));
    
    act(() => {
      result.current('arg1', 'arg2', 123);
    });
    
    act(() => {
      vi.advanceTimersByTime(100);
    });
    
    expect(callback).toHaveBeenCalledWith('arg1', 'arg2', 123);
  });

  it('should cancel pending execution on rapid calls', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 500));
    
    act(() => {
      result.current('first');
    });
    
    act(() => {
      vi.advanceTimersByTime(300);
    });
    
    act(() => {
      result.current('second');
    });
    
    act(() => {
      vi.advanceTimersByTime(300);
    });
    
    expect(callback).not.toHaveBeenCalled();
    
    act(() => {
      vi.advanceTimersByTime(200);
    });
    
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('second');
  });

  it('should support leading edge execution', () => {
    const callback = vi.fn();
    const { result } = renderHook(() =>
      useDebouncedCallback(callback, 500, { leading: true, trailing: false })
    );
    
    act(() => {
      result.current('first');
    });
    
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('first');
    
    act(() => {
      vi.advanceTimersByTime(500);
    });
    
    // Should not execute again on trailing edge
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should execute on both edges when configured', () => {
    const callback = vi.fn();
    const { result } = renderHook(() =>
      useDebouncedCallback(callback, 500, { leading: true, trailing: true })
    );
    
    act(() => {
      result.current('first');
    });
    
    expect(callback).toHaveBeenCalledTimes(1);
    
    act(() => {
      vi.advanceTimersByTime(500);
    });
    
    expect(callback).toHaveBeenCalledTimes(1); // Same call, not trailing
  });

  it('should cleanup timeout on unmount', () => {
    const callback = vi.fn();
    const { result, unmount } = renderHook(() => useDebouncedCallback(callback, 500));
    
    act(() => {
      result.current('test');
    });
    
    unmount();
    
    act(() => {
      vi.advanceTimersByTime(500);
    });
    
    // Callback should not be called after unmount
    expect(callback).not.toHaveBeenCalled();
  });
});

describe('useDebounceState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return initial value', () => {
    const { result } = renderHook(() => useDebounceState('initial', 500));
    
    expect(result.current[0]).toBe('initial');
  });

  it('should debounce state updates', () => {
    const { result } = renderHook(() => useDebounceState('initial', 500));
    
    act(() => {
      result.current[1]('updated');
    });
    
    // Value should not change immediately
    expect(result.current[0]).toBe('initial');
    
    act(() => {
      vi.advanceTimersByTime(500);
    });
    
    expect(result.current[0]).toBe('updated');
  });

  it('should support immediate updates', () => {
    const { result } = renderHook(() => useDebounceState('initial', 500));
    
    act(() => {
      result.current[2]('immediate');
    });
    
    expect(result.current[0]).toBe('immediate');
  });

  it('should cancel pending updates', () => {
    const { result } = renderHook(() => useDebounceState('initial', 500));
    
    act(() => {
      result.current[1]('pending');
    });
    
    act(() => {
      result.current[3](); // Cancel
    });
    
    act(() => {
      vi.advanceTimersByTime(500);
    });
    
    // Value should remain initial
    expect(result.current[0]).toBe('initial');
  });

  it('should handle function updates', () => {
    const { result } = renderHook(() => useDebounceState(0, 100));
    
    act(() => {
      result.current[1]((prev) => prev + 1);
    });
    
    act(() => {
      vi.advanceTimersByTime(100);
    });
    
    expect(result.current[0]).toBe(1);
  });
});
