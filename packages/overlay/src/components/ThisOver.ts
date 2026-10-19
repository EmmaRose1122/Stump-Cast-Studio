import type { MatchState } from '@stumpcast/shared';
import { OverlayComponent } from '../component';
import { ballChip } from '../format';

/** "This over" strip: one chip per delivery, with a label and the latest-ball emphasis. */
export class ThisOver extends OverlayComponent {
  protected override readonly alwaysVisible = true;
  private strip!: HTMLElement;
  private shown = '';

  protected build(): HTMLElement {
    const root = document.createElement('div');
    root.className = 'c-thisover';
    root.innerHTML = `
      <div class="to-header">
        <span class="to-label">THIS OVER</span>
        <span class="to-pill">CURRENT OVER</span>
      </div>
      <div class="to-body">
        <div class="to-strip"></div>
        <span class="to-brand-pill"><span class="to-brand-dot"></span>STUMPCAST STUDIO</span>
      </div>`;
    this.strip = root.querySelector('.to-strip')!;
    return root;
  }

  update(s: MatchState): void {
    const chips = s.thisOver.map(ballChip);
    const signature = chips.map((c) => `${c.kind}:${c.label}`).join('|');
    if (signature === this.shown) return;
    this.shown = signature;

    this.strip.replaceChildren(
      ...chips.map((c, i) => {
        const el = document.createElement('span');
        el.className = `to-ball to-${c.kind}${i === chips.length - 1 ? ' to-latest' : ''}`;
        el.textContent = c.label;
        return el;
      }),
    );
    this.root.classList.toggle('to-empty', chips.length === 0);
  }
}
