import type { EngineEvent } from '@stumpcast/shared';

export type BannerKind = 'FOUR' | 'SIX' | 'WICKET';
export const BANNER_KINDS: readonly BannerKind[] = ['FOUR', 'SIX', 'WICKET'];

export interface BannerItem {
  id: string;
  kind: BannerKind;
  payload: Record<string, unknown>;
  queuedAt: number;
}

export const isBannerEvent = (e: EngineEvent): e is EngineEvent & { type: BannerKind } =>
  (BANNER_KINDS as readonly string[]).includes(e.type);

const MAX_QUEUE = 4;
/** Anything waiting longer than this is no longer news. */
const STALE_MS = 12_000;

/**
 * Plays banners one at a time. Duplicate ids are ignored, a wicket outranks boundaries when the
 * queue is full, and stale items are dropped so the overlay never replays old action late.
 */
export class BannerQueue {
  private queue: BannerItem[] = [];
  private playing: BannerItem | null = null;
  private readonly seen = new Set<string>();

  constructor(
    private readonly play: (item: BannerItem, done: () => void) => void,
    private readonly now: () => number = Date.now,
  ) {}

  get pending(): readonly BannerItem[] {
    return this.queue;
  }

  get current(): BannerItem | null {
    return this.playing;
  }

  enqueue(e: EngineEvent): boolean {
    if (!isBannerEvent(e) || this.seen.has(e.id)) return false;
    this.seen.add(e.id);
    if (this.seen.size > 500) this.seen.delete(this.seen.values().next().value as string);

    this.queue.push({ id: e.id, kind: e.type, payload: e.payload, queuedAt: this.now() });
    while (this.queue.length > MAX_QUEUE) {
      // Drop the oldest boundary first; only drop a wicket if nothing else can go.
      const i = this.queue.findIndex((q) => q.kind !== 'WICKET');
      this.queue.splice(i === -1 ? 0 : i, 1);
    }
    this.pump();
    return true;
  }

  private pump(): void {
    if (this.playing) return;
    const t = this.now();
    this.queue = this.queue.filter((q) => t - q.queuedAt <= STALE_MS);
    const next = this.queue.shift();
    if (!next) return;
    this.playing = next;
    let finished = false;
    this.play(next, () => {
      if (finished) return;
      finished = true;
      this.playing = null;
      this.pump();
    });
  }
}
