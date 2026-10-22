import type { MatchState } from '@stumpcast/shared';
import { OverlayComponent } from '../component';

/**
 * Runs given away, split the way a scorecard line reads them. The feed never sends the breakdown
 * directly, so the engine counts it off the ball stream — when it has not seen enough balls to
 * know, the panel stays off air rather than showing zeros as fact.
 */
export class ExtrasRail extends OverlayComponent {
  protected override readonly alwaysVisible = true;
  private wide!: HTMLElement;
  private noball!: HTMLElement;
  private bye!: HTMLElement;

  protected build(): HTMLElement {
    const root = document.createElement('section');
    root.className = 'c-extras';
    root.innerHTML = `
      <div class="ex-label">GIVEN AWAY</div>
      <div class="ex-row">
        <div class="ex-cell"><strong class="ex-wide">0</strong><span class="ex-cap">WIDE</span></div>
        <div class="ex-cell"><strong class="ex-noball">0</strong><span class="ex-cap">NO BALL</span></div>
        <div class="ex-cell"><strong class="ex-bye">0</strong><span class="ex-cap">BYE + LB</span></div>
      </div>`;
    this.wide = root.querySelector('.ex-wide')!;
    this.noball = root.querySelector('.ex-noball')!;
    this.bye = root.querySelector('.ex-bye')!;
    return root;
  }

  update(s: MatchState): void {
    const x = s.extras;
    if (!x) {
      this.root.hidden = true;
      return;
    }
    this.wide.textContent = String(x.wide);
    this.noball.textContent = String(x.noball);
    this.bye.textContent = String(x.bye + x.legbye);
    const total = x.wide + x.noball + x.bye + x.legbye + x.penalty;
    this.root.hidden = total === 0;
  }
}
