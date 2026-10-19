export interface Scheduler {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
}

const realScheduler: Scheduler = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
};

interface Entry<T> {
  value: T;
  enqueuedAt: number;
}

export const MAX_DELAY_SEC = 60;

/**
 * Holds items and releases them, in order, `delaySec` after they were pushed (ME-6). The delay
 * can change at any time: each entry keeps its enqueue time, so a longer delay holds back the
 * queue, a shorter one releases what is now due, and nothing is lost or reordered.
 * A delay of 0 is a synchronous pass-through.
 */
export class DelayBuffer<T> {
  private queue: Entry<T>[] = [];
  private delayMs = 0;
  private timer: unknown = null;

  constructor(
    private readonly release: (value: T) => void,
    delaySec = 0,
    private readonly sched: Scheduler = realScheduler,
  ) {
    this.delayMs = DelayBuffer.clamp(delaySec) * 1000;
  }

  private static clamp(sec: number): number {
    if (!Number.isFinite(sec)) return 0;
    return Math.min(MAX_DELAY_SEC, Math.max(0, sec));
  }

  get delaySec(): number {
    return this.delayMs / 1000;
  }

  get size(): number {
    return this.queue.length;
  }

  push(value: T): void {
    // Pass straight through only when nothing is waiting, otherwise order would break.
    if (this.delayMs === 0 && this.queue.length === 0) {
      this.release(value);
      return;
    }
    this.queue.push({ value, enqueuedAt: this.sched.now() });
    this.drain();
  }

  setDelay(sec: number): void {
    this.delayMs = DelayBuffer.clamp(sec) * 1000;
    this.drain();
  }

  /** Release everything immediately, in order (e.g. on shutdown). */
  flush(): void {
    this.clearTimer();
    const all = this.queue;
    this.queue = [];
    for (const e of all) this.release(e.value);
  }

  private drain(): void {
    this.clearTimer();
    const now = this.sched.now();
    while (this.queue.length > 0) {
      const head = this.queue[0]!;
      const due = head.enqueuedAt + this.delayMs;
      if (due > now) {
        this.timer = this.sched.setTimeout(() => this.drain(), due - now);
        return;
      }
      this.queue.shift();
      this.release(head.value);
    }
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      this.sched.clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
