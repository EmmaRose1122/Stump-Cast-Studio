import type { MatchState } from '@stumpcast/shared';
import { OverlayComponent } from '../component';

/** Optional "Data delayed" badge shown while the watchdog is raised (default off in Settings). */
export class DataBadge extends OverlayComponent {
  protected override readonly alwaysVisible = true;

  protected build(): HTMLElement {
    const root = document.createElement('div');
    root.className = 'c-databadge';
    root.textContent = 'Data delayed';
    root.hidden = true;
    return root;
  }

  update(_state: MatchState): void {
    /* driven by the health channel */
  }

  setVisible(visible: boolean): void {
    this.root.hidden = !visible;
  }
}
