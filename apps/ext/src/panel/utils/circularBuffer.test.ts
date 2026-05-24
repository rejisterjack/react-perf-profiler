import { describe, it, expect } from 'vitest';
import { CircularBuffer } from './circularBuffer';

describe('CircularBuffer', () => {
  it('pushes and retrieves items', () => {
    const buf = new CircularBuffer<number>(5);
    buf.push(1);
    buf.push(2);
    buf.push(3);
    expect(buf.size).toBe(3);
    expect(buf.get(0)).toBe(1);
    expect(buf.get(1)).toBe(2);
    expect(buf.get(2)).toBe(3);
  });

  it('wraps around when capacity is exceeded', () => {
    const buf = new CircularBuffer<number>(3);
    buf.push(1);
    buf.push(2);
    buf.push(3);
    buf.push(4);
    buf.push(5);
    expect(buf.size).toBe(3);
    expect(buf.get(0)).toBe(3);
    expect(buf.get(1)).toBe(4);
    expect(buf.get(2)).toBe(5);
  });

  it('returns undefined for out-of-bounds', () => {
    const buf = new CircularBuffer<number>(3);
    buf.push(1);
    expect(buf.get(-1)).toBeUndefined();
    expect(buf.get(5)).toBeUndefined();
  });

  it('converts to array', () => {
    const buf = new CircularBuffer<number>(3);
    buf.push(1);
    buf.push(2);
    buf.push(3);
    buf.push(4);
    expect(buf.toArray()).toEqual([2, 3, 4]);
  });

  it('returns last item', () => {
    const buf = new CircularBuffer<number>(3);
    expect(buf.last()).toBeUndefined();
    buf.push(10);
    buf.push(20);
    expect(buf.last()).toBe(20);
  });

  it('clears the buffer', () => {
    const buf = new CircularBuffer<number>(5);
    buf.push(1);
    buf.push(2);
    buf.clear();
    expect(buf.size).toBe(0);
    expect(buf.toArray()).toEqual([]);
  });

  it('is iterable', () => {
    const buf = new CircularBuffer<number>(5);
    buf.push(10);
    buf.push(20);
    buf.push(30);
    expect([...buf]).toEqual([10, 20, 30]);
  });

  it('handles single capacity', () => {
    const buf = new CircularBuffer<number>(1);
    buf.push(1);
    buf.push(2);
    expect(buf.size).toBe(1);
    expect(buf.get(0)).toBe(2);
    expect(buf.last()).toBe(2);
  });

  it('handles wrap-around with exact capacity push', () => {
    const buf = new CircularBuffer<number>(4);
    for (let i = 0; i < 8; i++) buf.push(i);
    expect(buf.size).toBe(4);
    expect(buf.toArray()).toEqual([4, 5, 6, 7]);
  });
});
