import type {
  CardCommand,
  DirectorRule,
  EngineEvent,
  MatchState,
  Settings,
} from '@stumpcast/shared';
import type { Scheduler } from './DelayBuffer';

export type DirectorConfig = Settings['director'];

type Source = 'director' | 'operator';

interface Item {
  cardId: string;
  durationSec: number;
  priority: number;
  queuedAt: number;
}

interface OnAir {
  cardId: string;
  source: Source;
  priority: number;
}

/** How long a 4 / 6 / WICKET banner animation owns the screen (matches the overlay timelines). */
export const ANIMATION_LOCK_MS = { FOUR: 2300, SIX: 2400, WICKET: 3000 } as const;
/** A queued card older than this is no longer relevant. */
export const QUEUE_TTL_MS = 15_000;

const realScheduler: Scheduler = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
};

/**
 * The automatic producer (AD-1..AD-5).
 * - smart: rules fire cards on events; cooldowns stop repeats.
 * - carousel: cycles a card list on a timer.
 * - manual: nothing happens by itself; the operator still can show/hide.
 * A director card never starts while a 4/6/WICKET banner is animating: it waits in a priority
 * queue (stale items are dropped). Operator actions always win.
 */
export class Director {
  private config: DirectorConfig;
  private queue: Item[] = [];
  private current: OnAir | null = null;
  private endTimer: unknown = null;
  private pumpTimer: unknown = null;
  private carouselTimer: unknown = null;
  private carouselIndex = 0;
  private lockUntil = 0;
  private readonly cooldownUntil = new Map<string, number>();
  private readonly lastRuns = new Map<string, number>();

  constructor(
    private readonly emit: (cmd: CardCommand) => void,
    config: DirectorConfig,
    private readonly sched: Scheduler = realScheduler,
  ) {
    this.config = config;
    this.restartCarousel();
  }

  get state() {
    return {
      mode: this.config.mode,
      onAir: this.current ? { ...this.current } : null,
      queued: this.queue.map((q) => q.cardId),
      locked: this.sched.now() < this.lockUntil,
    };
  }

  getConfig(): DirectorConfig {
    return this.config;
  }

  /** Apply new settings. Switching modes clears the queue but lets the card on air finish. */
  setConfig(config: DirectorConfig): void {
    const modeChanged = config.mode !== this.config.mode;
    this.config = config;
    if (modeChanged) this.queue = [];
    this.restartCarousel();
  }

  // ---- operator ---------------------------------------------------------------------------

  show(cardId: string, durationSec = 8): void {
    this.queue = this.queue.filter((q) => q.cardId !== cardId);
    this.present(
      { cardId, durationSec, priority: Number.MAX_SAFE_INTEGER, queuedAt: this.sched.now() },
      'operator',
    );
  }

  hide(cardId?: string): void {
    if (cardId && this.current?.cardId !== cardId) return;
    const was = this.current;
    this.clearEnd();
    this.current = null;
    this.emit({ action: 'hide', cardId: was?.cardId ?? cardId });
    this.schedulePump(0);
  }

  // ---- automatic --------------------------------------------------------------------------

  onEvent(e: EngineEvent): void {
    const now = this.sched.now();
    if (e.type === 'FOUR' || e.type === 'SIX' || e.type === 'WICKET') {
      this.lockUntil = Math.max(this.lockUntil, now + ANIMATION_LOCK_MS[e.type]);
    }
    if (this.config.mode === 'smart') this.fire(e.type);
  }

  /** Detect "batter reached 40 / 90" from state changes (first sight is only a baseline). */
  onState(s: MatchState): void {
    if (this.config.mode !== 'smart') {
      this.noteRuns(s);
      return;
    }
    for (const b of s.batters) {
      const key = `${s.id}:${s.currentInnings}:${b.playerId}`;
      const before = this.lastRuns.get(key);
      this.lastRuns.set(key, b.runs);
      if (before === undefined) continue;
      if (before < 40 && b.runs >= 40) this.fire('BATTER_40');
      if (before < 90 && b.runs >= 90) this.fire('BATTER_90');
    }
  }

  private noteRuns(s: MatchState): void {
    for (const b of s.batters) {
      this.lastRuns.set(`${s.id}:${s.currentInnings}:${b.playerId}`, b.runs);
    }
  }

  private fire(trigger: string): void {
    const now = this.sched.now();
    this.config.rules.forEach((rule: DirectorRule, i) => {
      if (rule.on !== trigger) return;
      const key = `${i}:${rule.on}:${rule.card}`;
      if ((this.cooldownUntil.get(key) ?? 0) > now) return;
      this.cooldownUntil.set(key, now + rule.cooldownSec * 1000);
      this.request({
        cardId: rule.card,
        durationSec: rule.durationSec,
        priority: rule.priority,
        queuedAt: now,
      });
    });
  }

  // ---- scheduling core --------------------------------------------------------------------

  private request(item: Item): void {
    if (this.config.mode === 'manual') return;
    if (this.canStart(item)) this.present(item, 'director');
    else this.enqueue(item);
  }

  private canStart(item: Item): boolean {
    if (this.sched.now() < this.lockUntil) return false;
    if (!this.current) return true;
    // A director card may replace a lower-priority director card, never an operator card.
    return this.current.source === 'director' && item.priority > this.current.priority;
  }

  private enqueue(item: Item): void {
    this.queue = this.queue.filter((q) => q.cardId !== item.cardId);
    this.queue.push(item);
    this.queue.sort((a, b) => b.priority - a.priority || a.queuedAt - b.queuedAt);
    this.schedulePump(Math.max(0, this.lockUntil - this.sched.now()));
  }

  private present(item: Item, source: Source): void {
    this.clearEnd();
    this.current = { cardId: item.cardId, source, priority: item.priority };
    this.emit({
      action: 'show',
      cardId: item.cardId,
      durationSec: item.durationSec,
      source,
    });
    if (item.durationSec > 0) {
      this.endTimer = this.sched.setTimeout(() => {
        this.endTimer = null;
        const done = this.current;
        this.current = null;
        if (done) this.emit({ action: 'hide', cardId: done.cardId });
        this.schedulePump(0);
      }, item.durationSec * 1000);
    }
  }

  private pump(): void {
    this.pumpTimer = null;
    const now = this.sched.now();
    this.queue = this.queue.filter((q) => now - q.queuedAt <= QUEUE_TTL_MS);
    if (this.config.mode === 'manual') {
      this.queue = [];
      return;
    }
    const next = this.queue[0];
    if (!next) return;
    if (now < this.lockUntil || (this.current && !this.canStart(next))) {
      this.schedulePump(this.current ? 250 : Math.max(0, this.lockUntil - now));
      return;
    }
    this.queue.shift();
    this.present(next, 'director');
    this.schedulePump(0);
  }

  private schedulePump(ms: number): void {
    if (this.pumpTimer !== null) this.sched.clearTimeout(this.pumpTimer);
    this.pumpTimer = this.sched.setTimeout(() => this.pump(), ms);
  }

  private clearEnd(): void {
    if (this.endTimer !== null) {
      this.sched.clearTimeout(this.endTimer);
      this.endTimer = null;
    }
  }

  // ---- carousel ---------------------------------------------------------------------------

  private restartCarousel(): void {
    if (this.carouselTimer !== null) {
      this.sched.clearTimeout(this.carouselTimer);
      this.carouselTimer = null;
    }
    if (this.config.mode !== 'carousel') return;
    const every = this.config.carousel.intervalSec * 1000;
    const tick = () => {
      const { cards, intervalSec } = this.config.carousel;
      const idle = !this.current && this.sched.now() >= this.lockUntil;
      if (idle && cards.length > 0) {
        const cardId = cards[this.carouselIndex % cards.length]!;
        this.carouselIndex++;
        this.present(
          {
            cardId,
            // Leave a gap so the carousel breathes instead of being always-on.
            durationSec: Math.max(3, Math.min(8, intervalSec - 2)),
            priority: 0,
            queuedAt: this.sched.now(),
          },
          'director',
        );
      }
      this.carouselTimer = this.sched.setTimeout(tick, every);
    };
    this.carouselTimer = this.sched.setTimeout(tick, every);
  }

  stop(): void {
    this.clearEnd();
    for (const t of [this.pumpTimer, this.carouselTimer]) {
      if (t !== null) this.sched.clearTimeout(t);
    }
    this.pumpTimer = this.carouselTimer = null;
  }
}
