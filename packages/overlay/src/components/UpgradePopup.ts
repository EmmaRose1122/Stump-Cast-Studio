import type { MatchState } from '@stumpcast/shared';
import { OverlayComponent } from '../component';

const POPUP_INTERVAL_MS = 8000;
const POPUP_DURATION_MS = 3000;

export class UpgradePopup extends OverlayComponent {
  protected override readonly alwaysVisible = true;

  private timer: ReturnType<typeof setInterval> | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private popupShown = false;

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
    closeBtn?.addEventListener('click', () => this.hidePopup());
    const getBtn = root.querySelector('.upgrade-popup-btn-primary');
    getBtn?.addEventListener('click', () => {
      window.open('https://wa.me/?text=Hi%2C%20I%20want%20to%20buy%20a%20StumpCast%20Pro%20licence%20key', '_blank');
    });
    return root;
  }

  update(_state: MatchState): void {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.showPopup(), POPUP_INTERVAL_MS);
    setTimeout(() => this.showPopup(), 3000);
  }

  stop(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this.hideTimer) { clearTimeout(this.hideTimer); this.hideTimer = null; }
    this.hidePopup();
  }

  private showPopup(): void {
    if (this.popupShown) return;
    this.popupShown = true;
    const root = this.root;
    root.classList.add('visible');
    this.hideTimer = setTimeout(() => this.hidePopup(), POPUP_DURATION_MS);
  }

  private hidePopup(): void {
    if (!this.popupShown) return;
    this.popupShown = false;
    const root = this.root;
    root.classList.remove('visible');
    if (this.hideTimer) { clearTimeout(this.hideTimer); this.hideTimer = null; }
  }
}
