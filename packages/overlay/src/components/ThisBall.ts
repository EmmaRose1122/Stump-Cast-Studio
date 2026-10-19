import type { MatchState } from '@stumpcast/shared';
import { OverlayComponent } from '../component';
import { ballChip } from '../format';

/** Large single-delivery callout above the right-side over and stats rail. */
export class ThisBall extends OverlayComponent {
  protected override readonly alwaysVisible = true;
  private value!: HTMLElement;
  private detail!: HTMLElement;

  protected build(): HTMLElement {
    const root = document.createElement('section');
    root.className = 'c-thisball';
    root.innerHTML = `
      <span class="tb-label">THIS BALL</span>
      <div class="tb-body">
        <strong class="tb-value">—</strong>
        <span class="tb-detail">Waiting for delivery</span>
        <span class="tb-brand-pill"><span class="tb-brand-dot"></span>STUMPCAST STUDIO</span>
      </div>`;
    this.value = root.querySelector('.tb-value')!;
    this.detail = root.querySelector('.tb-detail')!;
    return root;
  }

  update(state: MatchState): void {
    const last = state.lastBalls.at(-1);
    if (!last) {
      this.value.textContent = '—';
      this.detail.textContent = 'Waiting for delivery';
      return;
    }
    const chip = ballChip(last);
    this.value.textContent = chip.kind === 'dot' ? '0' : chip.label.toUpperCase();
    this.value.dataset.kind = chip.kind;
    if (last.wicket) this.detail.textContent = 'WICKET';
    else if (last.extras) this.detail.textContent = last.extras.type.toUpperCase();
    else if (last.runs === 4) this.detail.textContent = 'FOUR';
    else if (last.runs === 6) this.detail.textContent = 'SIX';
    else this.detail.textContent = last.runs === 0 ? 'DOT' : `${last.runs} RUN${last.runs === 1 ? '' : 'S'}`;
  }
}
