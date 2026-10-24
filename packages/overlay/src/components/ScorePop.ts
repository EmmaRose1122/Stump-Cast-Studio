import { gsap } from 'gsap';
import type { MatchState } from '@stumpcast/shared';
import { OverlayComponent } from '../component';
import { ballChip, scoreText } from '../format';

/** The pop-up is a glance at one delivery: three seconds, then it is gone. */
const POP_MS = 3000;

/**
 * Ball-to-ball score strip in the band directly under the centre video. Every delivery shows the
 * ball, the score it produced and the overs, then disappears.
 */
export class ScorePop extends OverlayComponent {
  protected override readonly alwaysVisible = true;
  private ballEl!: HTMLElement;
  private scoreEl!: HTMLElement;
  private detailEl!: HTMLElement;
  private oversEl!: HTMLElement;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastKey: string | null = null;
  /** Lets the strip in the same band step aside while this is on air. */
  onVisibility: (visible: boolean) => void = () => undefined;

  protected build(): HTMLElement {
    const root = document.createElement('div');
    root.className = 'c-score-pop';
    root.hidden = true;
    root.innerHTML = `
      <span class="sp-ball"></span>
      <strong class="sp-score"></strong>
      <span class="sp-detail"></span>
      <span class="sp-overs"></span>`;
    this.ballEl = root.querySelector('.sp-ball')!;
    this.scoreEl = root.querySelector('.sp-score')!;
    this.detailEl = root.querySelector('.sp-detail')!;
    this.oversEl = root.querySelector('.sp-overs')!;
    return root;
  }

  update(state: MatchState): void {
    const ball = state.thisOver[state.thisOver.length - 1] ?? state.lastBalls[state.lastBalls.length - 1];
    const key = `${state.id}:${state.currentInnings}:${state.score.overs}.${state.score.balls}:${state.score.runs}:${state.score.wkts}:${state.thisOver.length}`;
    // The first state seen is only the baseline; a re-render of the same delivery stays silent.
    if (ball && this.lastKey !== null && key !== this.lastKey) this.reveal(state, ball);
    this.lastKey = key;
  }

  private reveal(state: MatchState, ball: NonNullable<MatchState['thisOver'][number]>): void {
    const chip = ballChip(ball);
    this.root.dataset.kind = chip.kind;
    this.ballEl.textContent = chip.label;
    this.scoreEl.textContent = scoreText(state.score);

    const striker = state.batters.find((b) => b.onStrike);
    const w = state.lastWicket;
    if (chip.kind === 'wicket' && w) {
      this.detailEl.textContent = `WICKET • ${w.name.toUpperCase()} ${w.runs} (${w.balls})`;
    } else {
      this.detailEl.textContent =
        striker && striker.name !== '—' ? `${striker.name} ${striker.runs} (${striker.balls})` : '';
    }
    this.oversEl.textContent = `${state.score.overs}.${state.score.balls} OV`;

    const root = this.root;
    root.hidden = false;
    this.onVisibility(true);
    gsap.killTweensOf(root);
    gsap.fromTo(root, { opacity: 0, y: -24 }, { opacity: 1, y: 0, duration: 0.2, ease: 'power2.out' });
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.dismiss(), POP_MS);
  }

  private dismiss(): void {
    this.timer = null;
    gsap.killTweensOf(this.root);
    this.root.hidden = true;
    this.onVisibility(false);
  }

  override destroy(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    gsap.killTweensOf(this.root);
    super.destroy?.();
  }
}
