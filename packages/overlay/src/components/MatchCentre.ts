import type { MatchState } from '@stumpcast/shared';
import { OverlayComponent } from '../component';
import { ballChip } from '../format';

/** Match context, toss and recent deliveries for the left broadcast rail. */
export class MatchCentre extends OverlayComponent {
  protected override readonly alwaysVisible = true;
  private title!: HTMLElement;
  private toss!: HTMLElement;
  private strip!: HTMLElement;
  private venue!: HTMLElement;

  protected build(): HTMLElement {
    const root = document.createElement('section');
    root.className = 'c-matchcentre';
    root.innerHTML = `
      <div class="mc-heading"><span class="mc-heading-dot"></span>MATCH CENTRE</div>
      <div class="mc-section"><span class="mc-label">LAST 6 BALLS</span><div class="mc-balls"></div></div>
      <div class="mc-detail"><span class="mc-label">MATCH</span><div class="mc-card-box"><strong class="mc-title"></strong></div></div>
      <div class="mc-detail mc-toss"><span class="mc-label">TOSS</span><div class="mc-card-box"><strong></strong></div></div>
      <div class="mc-footer"><div class="mc-venue"></div><span class="mc-brand-pill"><span class="mc-brand-dot"></span>STUMPCAST STUDIO</span></div>`;
    this.title = root.querySelector('.mc-title')!;
    this.toss = root.querySelector('.mc-toss strong')!;
    this.strip = root.querySelector('.mc-balls')!;
    this.venue = root.querySelector('.mc-venue')!;
    return root;
  }

  update(state: MatchState): void {
    this.title.textContent = state.title;
    const winner = state.toss && state.teams.find((team) => team.id === state.toss!.winnerTeamId);
    this.toss.textContent = winner ? `${winner.name} (${state.toss!.decision})` : 'Toss not available';
    this.root.querySelector('.mc-toss')!.toggleAttribute('hidden', !state.toss);
    this.venue.textContent = state.venue ?? '';
    this.venue.toggleAttribute('hidden', !state.venue);

    const balls = state.lastBalls.map(ballChip);
    this.strip.replaceChildren(...balls.map((ball, index) => {
      const chip = document.createElement('span');
      chip.className = `mc-ball mc-${ball.kind}${index === balls.length - 1 ? ' mc-latest' : ''}`;
      chip.textContent = ball.label;
      return chip;
    }));
  }
}
