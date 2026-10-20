import type { MatchState } from '@stumpcast/shared';
import { OverlayComponent } from '../component';
import { oversText } from '../format';

const sr = (runs: number, balls: number): string => (balls > 0 ? ((runs / balls) * 100).toFixed(1) : '—');
const econ = (runs: number, overs: number, balls: number): string => {
  const o = overs + balls / 6;
  return o > 0 ? (runs / o).toFixed(2) : '—';
};

/**
 * Batting and bowling figures under the centre stream frame. The feed only carries the two
 * batters at the crease and the current bowler, so that is all this shows — nothing is inferred.
 */
export class PerformanceStrip extends OverlayComponent {
  protected override readonly alwaysVisible = true;
  private batRows!: HTMLElement;
  private bowlRow!: HTMLElement;
  private empty = true;
  private suppressed = false;

  protected build(): HTMLElement {
    const root = document.createElement('section');
    root.className = 'c-perf-strip';
    root.hidden = true;
    root.innerHTML = `
      <div class="ps-group ps-batting">
        <span class="ps-heading">BATTING</span>
        <div class="ps-rows"></div>
      </div>
      <div class="ps-group ps-bowling">
        <span class="ps-heading">BOWLING</span>
        <div class="ps-rows"></div>
      </div>`;
    this.batRows = root.querySelector('.ps-batting .ps-rows')!;
    this.bowlRow = root.querySelector('.ps-bowling .ps-rows')!;
    return root;
  }

  update(s: MatchState): void {
    const real = (name: string) => name && name !== '—';
    const batters = s.batters.filter((b) => real(b.name));

    this.batRows.replaceChildren(
      ...batters.map((b) =>
        this.row(
          b.name,
          b.onStrike,
          `${b.runs} (${b.balls})`,
          `SR ${sr(b.runs, b.balls)}`,
          `${b.fours}×4 ${b.sixes}×6`,
        ),
      ),
    );

    const w = s.bowler;
    this.bowlRow.replaceChildren(
      real(w.name)
        ? this.row(w.name, false, `${w.wkts}-${w.runs}`, `ECON ${econ(w.runs, w.overs, w.balls)}`, `${oversText(w)} OV`)
        : this.placeholder(),
    );

    this.empty = batters.length === 0 && !real(w.name);
    this.root.hidden = this.empty || this.suppressed;
  }

  /** The lower-third pop-up owns the same band, so the strip steps aside while it is on air. */
  setSuppressed(suppressed: boolean): void {
    this.suppressed = suppressed;
    this.root.hidden = this.empty || suppressed;
  }

  private row(name: string, onStrike: boolean, figures: string, rate: string, extra: string): HTMLElement {
    const el = document.createElement('div');
    el.className = `ps-row${onStrike ? ' ps-on-strike' : ''}`;
    el.innerHTML = `
      <span class="ps-name"></span>
      <strong class="ps-figures"></strong>
      <span class="ps-rate"></span>
      <span class="ps-extra"></span>`;
    el.querySelector<HTMLElement>('.ps-name')!.textContent = onStrike ? `${name} *` : name;
    el.querySelector<HTMLElement>('.ps-figures')!.textContent = figures;
    el.querySelector<HTMLElement>('.ps-rate')!.textContent = rate;
    el.querySelector<HTMLElement>('.ps-extra')!.textContent = extra;
    return el;
  }

  private placeholder(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'ps-row ps-empty';
    el.textContent = 'NOT BOWLED YET';
    return el;
  }
}
