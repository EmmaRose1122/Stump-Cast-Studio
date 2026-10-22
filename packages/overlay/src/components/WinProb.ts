import type { MatchState } from '@stumpcast/shared';
import { assetUrl, attachImage, teamAssetId } from '../assets';
import { OverlayComponent } from '../component';
import { battingTeam, bowlingTeam } from '../format';

/** Two-sided win-probability bar. Hidden when the engine has no estimate (e.g. Tests). */
export class WinProb extends OverlayComponent {
  protected override readonly alwaysVisible = true;
  private e!: Record<
    'a' | 'b' | 'fillA' | 'pctA' | 'pctB' | 'crestA' | 'crestB',
    HTMLElement
  >;

  protected build(): HTMLElement {
    const root = document.createElement('div');
    root.className = 'c-winprob';
    root.innerHTML = `
      <div class="wp-label">WIN %</div>
      <div class="wp-card">
        <span class="wp-crest wp-crest-a"></span>
        <span class="wp-name wp-a"></span>
        <span class="wp-pct wp-pct-a"></span>
        <div class="wp-bar"><div class="wp-fill"></div></div>
        <span class="wp-pct wp-pct-b"></span>
        <span class="wp-name wp-b"></span>
        <span class="wp-crest wp-crest-b"></span>
      </div>
      <span class="wp-title">WIN PROBABILITY (est.)</span>`;
    const q = (s: string) => root.querySelector<HTMLElement>(s)!;
    this.e = {
      a: q('.wp-a'),
      b: q('.wp-b'),
      fillA: q('.wp-fill'),
      pctA: q('.wp-pct-a'),
      pctB: q('.wp-pct-b'),
      crestA: q('.wp-crest-a'),
      crestB: q('.wp-crest-b'),
    };
    return root;
  }

  private setCrest(host: HTMLElement, short: string): void {
    const id = teamAssetId(short);
    const url = id ? assetUrl('teams', id) : '';
    if (host.dataset.src === url) return;
    host.dataset.src = url;
    host.replaceChildren();
    if (url) attachImage(host, url);
  }

  update(s: MatchState): void {
    this.root.hidden = !s.winProb || s.teams.length < 2;
    if (this.root.hidden || !s.winProb) return;
    // Left-to-right exactly as the scorebar lays it out, with the batting side first. The engine
    // numbers its pair `teamA`/`teamB` by roster order, so reading the estimate means re-pairing it
    // with the side it belongs to — otherwise a flag changes sides between the two widgets and
    // every number on the bar reads for the wrong team.
    const bat = battingTeam(s);
    const bowl = bowlingTeam(s);
    const pBat = bat.id === s.teams[0].id ? s.winProb.teamA : s.winProb.teamB;
    this.e.a.textContent = bat.short;
    this.e.b.textContent = bowl.short;
    this.e.fillA.style.width = `${(pBat * 100).toFixed(1)}%`;
    this.e.fillA.style.background = bat.color;
    const pctBat = Math.round(pBat * 100);
    // One number, not two: rounding both halves independently can put 101% on air.
    const pctBowl = 100 - pctBat;
    this.e.pctA.textContent = `${pctBat}%`;
    this.e.pctB.textContent = `${pctBowl}%`;
    this.setCrest(this.e.crestA, bat.short);
    this.setCrest(this.e.crestB, bowl.short);
  }
}
