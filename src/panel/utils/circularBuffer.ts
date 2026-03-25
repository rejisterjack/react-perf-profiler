/**
 * Circular Buffer Implementation for O(1) Commit Storage
 * @module panel/utils/circularBuffer
 */

/**
 * Circular buffer for efficient O(1) append and eviction
 * When full, new items overwrite the oldest ones
 */
export class CircularBuffer<T> {
  private buffer: (T | undefined)[];
  private head = 0; // Index of oldest item
  private tail = 0; // Index where next item will be written
  private count = 0; // Current number of items
  private capacity: number;

  constructor(capacity: number) {
    this.capacity = Math.max(1, capacity);
    this.buffer = new Array(this.capacity);
  }

  /**
   * Add an item to the buffer (O(1))
   * If full, overwrites the oldest item
   */
  push(item: T): void {
    this.buffer[this.tail] = item;
    
    if (this.count === this.capacity) {
      // Buffer is full, move head forward (overwrite oldest)
      this.head = (this.head + 1) % this.capacity;
    } else {
      this.count++;
    }
    
    this.tail = (this.tail + 1) % this.capacity;
  }

  /**
   * Get all items in order (oldest to newest)
   * Returns a copy, safe for external mutation
   */
  toArray(): T[] {
    const result: T[] = [];
    for (let i = 0; i < this.count; i++) {
      const idx = (this.head + i) % this.capacity;
      const item = this.buffer[idx];
      if (item !== undefined) {
        result.push(item);
      }
    }
    return result;
  }

  /**
   * Get item at index (0 = oldest, length-1 = newest)
   */
  get(index: number): T | undefined {
    if (index < 0 || index >= this.count) {
      return undefined;
    }
    const idx = (this.head + index) % this.capacity;
    return this.buffer[idx];
  }

  /**
   * Get the most recently added item
   */
  getLast(): T | undefined {
    if (this.count === 0) return undefined;
    const idx = (this.tail - 1 + this.capacity) % this.capacity;
    return this.buffer[idx];
  }

  /**
   * Get the oldest item
   */
  getFirst(): T | undefined {
    if (this.count === 0) return undefined;
    return this.buffer[this.head];
  }

  /**
   * Current number of items
   */
  get length(): number {
    return this.count;
  }

  /**
   * Maximum capacity
   */
  get maxSize(): number {
    return this.capacity;
  }

  /**
   * Whether buffer is full
   */
  get isFull(): boolean {
    return this.count === this.capacity;
  }

  /**
   * Whether buffer is empty
   */
  get isEmpty(): boolean {
    return this.count === 0;
  }

  /**
   * Clear all items
   */
  clear(): void {
    this.head = 0;
    this.tail = 0;
    this.count = 0;
    this.buffer = new Array(this.capacity);
  }

  /**
   * Resize the buffer (keeps most recent items)
   */
  resize(newCapacity: number): void {
    const items = this.toArray();
    this.capacity = Math.max(1, newCapacity);
    this.buffer = new Array(this.capacity);
    this.head = 0;
    this.tail = 0;
    this.count = 0;
    
    // Keep only the most recent items that fit
    const startIndex = Math.max(0, items.length - this.capacity);
    for (let i = startIndex; i < items.length; i++) {
      this.push(items[i]!);
    }
  }

  /**
   * Iterate over items (oldest to newest)
   */
  *[Symbol.iterator](): Iterator<T> {
    for (let i = 0; i < this.count; i++) {
      const idx = (this.head + i) % this.capacity;
      const item = this.buffer[idx];
      if (item !== undefined) {
        yield item;
      }
    }
  }
}

export default CircularBuffer;
