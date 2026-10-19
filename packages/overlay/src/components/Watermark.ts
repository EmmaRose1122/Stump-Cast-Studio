import type { MatchState } from '@stumpcast/shared';
import { OverlayComponent } from '../component';

/** Free-tier mark (OV-7). Hidden by setting `visible = false` once a licence is active. */
export class Watermark extends OverlayComponent {
  protected override readonly alwaysVisible = true;

  protected build(): HTMLElement {
    const root = document.createElement('div');
    root.className = 'c-watermark';
    root.textContent = 'Made with StumpCast Studio';
    return root;
  }

  update(_state: MatchState): void {
    /* static */
  }

  setVisible(visible: boolean): void {
    this.root.hidden = !visible;
  }
}
