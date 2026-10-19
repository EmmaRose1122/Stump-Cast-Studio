import type { Look, MatchHistory, MatchState } from '@stumpcast/shared';
import { OverlayComponent } from '../component';
import type { ActiveCard } from '../store';
import { el } from './dom';
import { getCardDef, type CardDef } from './defs';

/** One on-air card. Content is rebuilt in place from the latest state (never replaced nodes). */
export class CardView extends OverlayComponent {
  private body!: HTMLElement;
  private state: MatchState | undefined;
  history: MatchHistory | undefined;

  constructor(readonly def: CardDef) {
    super();
  }

  protected build(): HTMLElement {
    const root = el('section', `c-card c-card-${this.def.id}`);
    root.dataset.card = this.def.id;
    const head = el('header', 'cd-head');
    head.append(el('span', 'cd-title', this.def.title));
    this.body = el('div', 'cd-body');
    root.append(head, this.body);
    return root;
  }

  update(state: MatchState): void {
    this.state = state;
    this.render();
  }

  render(): void {
    if (!this.state || !this.body) return;
    this.body.replaceChildren(...this.def.render(this.state, { history: this.history }));
  }
}

export interface CardManagerOptions {
  /** Used to fetch history for analytic cards; return undefined when unavailable. */
  fetchHistory?: (matchId: string) => Promise<MatchHistory | undefined>;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (id: unknown) => void;
}

/** Slack added to the director's duration so a missed `hide` can never strand a card on air. */
const SAFETY_MS = 3000;

/**
 * Owns the card registry. The server's director/operator decide *what* is on air; this decides
 * how it is drawn, keeps it fresh as the score changes and guarantees it eventually leaves.
 */
export class CardManager {
  private readonly views = new Map<string, CardView>();
  private onAir: CardView | null = null;
  private timer: unknown = null;
  private match: MatchState | undefined;
  private look: Look;
  private readonly setTimer: (fn: () => void, ms: number) => unknown;
  private readonly clearTimer: (id: unknown) => void;

  constructor(
    private readonly zone: HTMLElement,
    look: Look,
    defs: readonly CardDef[],
    private readonly opts: CardManagerOptions = {},
  ) {
    this.look = look;
    this.setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer =
      opts.clearTimer ?? ((id) => clearTimeout(id as ReturnType<typeof setTimeout>));
    for (const def of defs) {
      const v = new CardView(def);
      v.mount(zone, look);
      this.views.set(def.id, v);
    }
  }

  get activeId(): string | null {
    return this.onAir?.def.id ?? null;
  }

  has(id: string): boolean {
    return this.views.has(id);
  }

  setLook(look: Look): void {
    this.look = look;
    for (const v of this.views.values()) v.setLook(look);
  }

  updateMatch(match: MatchState): void {
    this.match = match;
    // Only the card on air needs to follow the score.
    this.onAir?.update(match);
  }

  /** Apply the store's `active` card (null clears). */
  apply(active: ActiveCard | null): void {
    if (this.timer !== null) {
      this.clearTimer(this.timer);
      this.timer = null;
    }
    if (!active) {
      this.onAir?.hide();
      this.onAir = null;
      return;
    }
    const next = this.views.get(active.cardId);
    if (!next) return; // an id this overlay build does not know: ignore, keep what is on air

    if (this.onAir && this.onAir !== next) this.onAir.hide();
    this.onAir = next;
    if (this.match) next.update(this.match);
    next.setLook(this.look);
    next.show();

    if (next.def.needsHistory && this.match && this.opts.fetchHistory) {
      const id = this.match.id;
      void this.opts.fetchHistory(id).then((h) => {
        if (h && this.onAir === next) {
          next.history = h;
          next.render();
        }
      });
    }

    if (active.durationSec > 0) {
      this.timer = this.setTimer(
        () => {
          this.timer = null;
          if (this.onAir === next) {
            next.hide();
            this.onAir = null;
          }
        },
        active.durationSec * 1000 + SAFETY_MS,
      );
    }
  }

  destroy(): void {
    if (this.timer !== null) this.clearTimer(this.timer);
    for (const v of this.views.values()) v.destroy();
    this.views.clear();
  }
}

export { getCardDef };
