import type { MatchState } from '@stumpcast/shared';
import { OverlayComponent } from '../component';

/**
 * Projected finish: the current rate, and what the total becomes if scoring lifts two an over.
 * Both numbers come from the engine's own projection, so the panel hides itself when the innings
 * is a chase or a Test (where a projection would be a guess).
 */
export class ProjectedScore extends OverlayComponent {
  protected override readonly alwaysVisible = true;
  private now!: HTMLElement;
  private push!: HTMLElement;
  private pushCell!: HTMLElement;

  protected build(): HTMLElement {
    const root = document.createElement('section');
    root.className = 'c-projected';
    root.innerHTML = `
      <div class="pj-label">PROJECTED SCORE</div>
      <div class="pj-row">
        <div class="pj-cell"><strong class="pj-now">—</strong><span class="pj-cap">AT THIS RATE</span></div>
        <div class="pj-cell pj-push-cell"><strong class="pj-push">—</strong><span class="pj-cap">+2 AN OVER</span></div>
      </div>`;
    this.now = root.querySelector('.pj-now')!;
    this.push = root.querySelector('.pj-push')!;
    this.pushCell = root.querySelector('.pj-push-cell')!;
    return root;
  }

  update(s: MatchState): void {
    const has = s.projected !== undefined;
    this.root.hidden = !has;
    if (!has) return;
    this.now.textContent = String(s.projected);
    const plus = s.projectedPlus2;
    this.pushCell.hidden = plus === undefined || plus === s.projected;
    if (plus !== undefined) this.push.textContent = String(plus);
  }
}
