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
  private layoutObserver: MutationObserver | undefined;
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
    this.watchLayout();
  }

  /**
   * Follows the stage's `data-layout` so cards resize themselves when the operator switches
   * layouts: arena cards fit the video window, fullscreen cards use the whole canvas.
   */
  private watchLayout(): void {
    const stage = this.zone.closest('#stage');
    if (!stage || typeof MutationObserver === 'undefined') return;
    this.applyLayout(stage.getAttribute('data-layout') ?? '');
    this.layoutObserver = new MutationObserver(() => {
      this.applyLayout(stage.getAttribute('data-layout') ?? '');
    });
    this.layoutObserver.observe(stage, { attributes: true, attributeFilter: ['data-layout'] });
  }

  private applyLayout(layout: string): void {
    // Card content is authored against the arena video window; other layouts have more room,
    // so the same card is drawn slightly larger there. The CSS still owns position.
    const scale =
      layout === 'fullscreen' ? 1.15 : layout === 'arena' ? 1 : layout === 'ticker' ? 0.85 : 1;
    this.zone.style.setProperty('--layout-card-scale', String(scale));
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
    if (!active) {
      this.clearHideTimer();
      this.onAir?.hide();
      this.onAir = null;
      this.zone.removeAttribute('data-on-air');
      return;
    }
    const next = this.views.get(active.cardId);
    // An id this overlay build does not know: keep what is on air, including its hide timer.
    // Clearing the timer before this check used to strand the current card for the rest of the
    // broadcast, because nothing else ever hides it.
    if (!next) return;
    this.clearHideTimer();

    if (this.onAir && this.onAir !== next) this.onAir.hide();
    this.onAir = next;
    if (this.match) next.update(this.match);
    next.setLook(this.look);
    next.show();
    this.zone.dataset.onAir = active.cardId;

    if (next.def.needsHistory && this.match && this.opts.fetchHistory) {
      const id = this.match.id;
      void this.opts
        .fetchHistory(id)
        .then((h) => {
          if (h && this.onAir === next) {
            next.history = h;
            next.render();
          }
        })
        .catch(() => undefined); // a failed history fetch leaves the card showing its empty state
    }

    if (active.durationSec > 0) {
      this.timer = this.setTimer(
        () => {
          this.timer = null;
          if (this.onAir === next) {
            next.hide();
            this.onAir = null;
            this.zone.removeAttribute('data-on-air');
          }
        },
        active.durationSec * 1000 + SAFETY_MS,
      );
    }
  }

  private clearHideTimer(): void {
    if (this.timer !== null) {
      this.clearTimer(this.timer);
      this.timer = null;
    }
  }

  destroy(): void {
    this.layoutObserver?.disconnect();
    this.clearHideTimer();
    for (const v of this.views.values()) v.destroy();
    this.views.clear();
  }
}

export { getCardDef };
