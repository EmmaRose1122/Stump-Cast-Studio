import type { MatchState } from '@stumpcast/shared';
import { OverlayComponent } from '../component';

/** The gap between two appearances is re-rolled inside this band on every cycle (never a fixed period). */
const POPUP_MIN_GAP_MS = 10_000;
const POPUP_MAX_GAP_MS = 15_000;
const POPUP_DURATION_MS = 3_000;
/** First appearance after the licence has had time to land: an ad that pops before a paid
 *  channel is resolved is an ad on air. */
const FIRST_POPUP_DELAY_MS = 3_000;

export interface UpgradePopupOptions {
  /** Injectable so the random gap can be asserted; defaults to Math.random. */
  random?: () => number;
  /** Injectable clock, defaults to Date.now. */
  now?: () => number;
}

/**
 * The free-tier upgrade nudge. Appears for exactly 3 s every random 10-15 s and is never allowed
 * to stay on screen: the gap is a self-cancelling setTimeout chain (a setInterval cannot vary its
 * period) and the hide is also enforced by an absolute deadline, because a throttled or occluded
 * renderer can delay a timeout far past 3 s while the box still covers the score.
 */
export class UpgradePopup extends OverlayComponent {
  protected override readonly alwaysVisible = true;

  private readonly random: () => number;
  private readonly now: () => number;
  /** The one pending hop of the chain. Cleared and re-rolled on every cycle. */
  private cycleTimer: ReturnType<typeof setTimeout> | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  /** Timestamp after which the popup must be off screen, whatever the timers manage to do. */
  private hideAt = 0;
  private popupShown = false;
  private running = false;
  private dismissed = false;

  constructor(options: UpgradePopupOptions = {}) {
    super();
    this.random = options.random ?? Math.random;
    this.now = options.now ?? Date.now;
  }

  protected build(): HTMLElement {
    const root = document.createElement('div');
    root.className = 'c-upgrade-popup';
    root.innerHTML = `
      <div class="upgrade-popup-backdrop"></div>
      <div class="upgrade-popup-box">
        <div class="upgrade-popup-icon">&#9733;</div>
        <h3 class="upgrade-popup-title">Go Pro on StumpCast Studio</h3>
        <p class="upgrade-popup-text">Remove this watermark and unlock all 29+ professional TV Looks with a Pro licence.</p>
        <div class="upgrade-popup-actions">
          <button class="upgrade-popup-btn upgrade-popup-btn-primary" type="button">Get License Key</button>
          <button class="upgrade-popup-btn upgrade-popup-btn-close" type="button">Dismiss</button>
        </div>
        <p class="upgrade-popup-note">Enter your licence key in StumpCast Studio to activate Pro features.</p>
      </div>
    `;
    const closeBtn = root.querySelector('.upgrade-popup-btn-close');
    closeBtn?.addEventListener('click', () => this.dismiss());
    const getBtn = root.querySelector('.upgrade-popup-btn-primary');
    getBtn?.addEventListener('click', () => {
      window.open('https://wa.me/?text=Hi%2C%20I%20want%20to%20buy%20a%20StumpCast%20Pro%20licence%20key', '_blank');
    });
    return root;
  }

  update(_state: MatchState): void {}

  /** Called for an unlicensed channel only; a licensed user never sees the popup. */
  start(): void {
    if (this.running || this.dismissed) return;
    this.running = true;
    document.addEventListener('visibilitychange', this.onPageVisible);
    window.addEventListener('focus', this.onPageVisible);
    // Cancellable like the rest: a licence applied inside the intro window must not pop the ad.
    this.scheduleNext(FIRST_POPUP_DELAY_MS);
  }

  stop(): void {
    this.running = false;
    this.clearChain();
    this.clearHide();
    // Unconditional: an ad must never survive a stop() because a flag happened to be out of sync.
    this.popupShown = false;
    this.hideAt = 0;
    this.root?.classList.remove('visible');
  }

  /** Dismiss silences the popup for the rest of this page's life, not just this appearance. */
  dismiss(): void {
    this.dismissed = true;
    this.stop();
  }

  override destroy(): void {
    this.stop();
    document.removeEventListener('visibilitychange', this.onPageVisible);
    window.removeEventListener('focus', this.onPageVisible);
    super.destroy?.();
  }

  /** Gap until the next appearance: a fresh roll in the 10-15 s band, every single cycle. */
  nextGapMs(): number {
    const roll = this.random();
    const clamped = Number.isFinite(roll) ? Math.min(1, Math.max(0, roll)) : 0;
    return Math.round(POPUP_MIN_GAP_MS + clamped * (POPUP_MAX_GAP_MS - POPUP_MIN_GAP_MS));
  }

  private scheduleNext(gapMs: number): void {
    this.clearChain();
    if (!this.running) return;
    this.cycleTimer = setTimeout(() => {
      this.cycleTimer = null;
      this.cycle();
    }, gapMs);
  }

  private cycle(): void {
    if (!this.running || this.dismissed) return;
    // An appearance that outlived its deadline (throttled hide timer) comes off first, and the
    // chain that enforcement re-arms owns the next hop - this cycle must not show it twice.
    if (this.enforceDeadline()) return;
    this.showPopup();
  }

  private showPopup(): void {
    if (this.popupShown) return;
    this.popupShown = true;
    this.root.classList.add('visible');
    this.hideAt = this.now() + POPUP_DURATION_MS;
    this.clearHide();
    this.hideTimer = setTimeout(() => {
      this.hideTimer = null;
      this.hidePopup();
    }, POPUP_DURATION_MS);
  }

  private hidePopup(): void {
    if (!this.popupShown) return;
    this.popupShown = false;
    this.hideAt = 0;
    this.clearHide();
    this.root.classList.remove('visible');
    if (this.running && !this.dismissed) this.scheduleNext(this.nextGapMs());
  }

  /**
   * A hidden or occluded renderer throttles chained timers - Electron leaves background
   * throttling on by default - so the 3 s hide can arrive late or never while the box sits over
   * the score. The absolute deadline is the backstop: it is checked the moment the page is looked
   * at again. Returns true when it had to clear an overdue appearance.
   */
  private enforceDeadline(): boolean {
    if (!this.popupShown || this.now() < this.hideAt) return false;
    this.hidePopup();
    return true;
  }

  private readonly onPageVisible = (): void => {
    if (document.visibilityState === 'hidden') return;
    this.enforceDeadline();
    if (this.running && !this.dismissed && !this.cycleTimer) this.scheduleNext(this.nextGapMs());
  };

  private clearChain(): void {
    if (this.cycleTimer) {
      clearTimeout(this.cycleTimer);
      this.cycleTimer = null;
    }
  }

  private clearHide(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }
}
