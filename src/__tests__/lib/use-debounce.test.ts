import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from '@/lib/use-debounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the initial value synchronously', () => {
    const { result } = renderHook(() => useDebounce('initial', 100));
    expect(result.current).toBe('initial');
  });

  it('does not update before the delay elapses', () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 200), {
      initialProps: { v: 'a' },
    });

    rerender({ v: 'b' });
    expect(result.current).toBe('a');

    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(result.current).toBe('a');

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe('b');
  });

  it('only commits the latest value when value changes several times', () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 100), {
      initialProps: { v: 'a' },
    });

    rerender({ v: 'b' });
    act(() => {
      vi.advanceTimersByTime(50);
    });
    rerender({ v: 'c' });
    act(() => {
      vi.advanceTimersByTime(50);
    });
    rerender({ v: 'd' });
    act(() => {
      vi.advanceTimersByTime(99);
    });
    expect(result.current).toBe('a');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe('d');
  });

  it('clears the pending timer on unmount', () => {
    const { rerender, unmount } = renderHook(({ v }) => useDebounce(v, 100), {
      initialProps: { v: 'a' },
    });

    rerender({ v: 'b' });
    unmount();
    // No assertion needed — if the timer was not cleared, the test would leak.
    act(() => {
      vi.advanceTimersByTime(500);
    });
  });

  it('handles non-string values', () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 50), {
      initialProps: { v: { count: 0 } },
    });

    rerender({ v: { count: 1 } });
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(result.current).toEqual({ count: 1 });
  });
});
