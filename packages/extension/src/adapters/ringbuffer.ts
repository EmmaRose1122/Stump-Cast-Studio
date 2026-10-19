/** Fixed-size log: adapters never throw to the page, they record here for diagnostics (X6). */
export class RingBuffer<T> {
  private items: T[] = [];

  constructor(private readonly capacity = 200) {}

  push(item: T): void {
    this.items.push(item);
    if (this.items.length > this.capacity) this.items.shift();
  }

  toArray(): T[] {
    return [...this.items];
  }

  get size(): number {
    return this.items.length;
  }
}
