/**
 * Circular buffer for efficient O(1) commit storage.
 * Automatically evicts oldest entries when capacity is reached.
 */

export class CircularBuffer<T> {
  private buffer: (T | undefined)[];
  private head = 0;
  private tail = 0;
  private count = 0;

  constructor(private capacity: number) {
    this.buffer = new Array(capacity);
  }

  push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this.count === this.capacity) {
      this.tail = (this.tail + 1) % this.capacity;
    } else {
      this.count++;
    }
  }

  get(index: number): T | undefined {
    if (index < 0 || index >= this.count) return undefined;
    return this.buffer[(this.tail + index) % this.capacity];
  }

  toArray(): T[] {
    const result: T[] = [];
    for (let i = 0; i < this.count; i++) {
      const item = this.buffer[(this.tail + i) % this.capacity];
      if (item !== undefined) result.push(item);
    }
    return result;
  }

  get size(): number {
    return this.count;
  }

  clear(): void {
    this.buffer = new Array(this.capacity);
    this.head = 0;
    this.tail = 0;
    this.count = 0;
  }

  last(): T | undefined {
    if (this.count === 0) return undefined;
    const idx = (this.head - 1 + this.capacity) % this.capacity;
    return this.buffer[idx];
  }

  [Symbol.iterator](): Iterator<T> {
    let i = 0;
    return {
      next: () => {
        if (i >= this.count) return { done: true, value: undefined };
        const value = this.buffer[(this.tail + i) % this.capacity] as T;
        i++;
        return { done: false, value };
      },
    };
  }
}
