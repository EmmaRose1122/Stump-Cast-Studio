import type { MatchState } from '@stumpcast/shared';
import { assetUrl, attachImage, teamAssetId } from '../assets';
import { OverlayComponent } from '../component';

/** Two-sided win-probability bar. Hidden when the engine has no estimate (e.g. Tests). */
export class WinProb extends OverlayComponent {
  protected override readonly alwaysVisible = true;
  private e!: Record<'a' | 'b' | 'fillA' | 'pctA' | 'pctB' | 'crestA' | 'crestB', HTMLElement>;

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
    const url = assetUrl('teams', teamAssetId(short));
    if (host.dataset.src === url) return;
    host.dataset.src = url;
    host.replaceChildren();
    attachImage(host, url);
  }

  update(s: MatchState): void {
    this.root.hidden = !s.winProb;
    if (!s.winProb) return;
    this.e.a.textContent = s.teams[0].short;
    this.e.b.textContent = s.teams[1].short;
    this.e.fillA.style.width = `${(s.winProb.teamA * 100).toFixed(1)}%`;
    this.e.fillA.style.background = s.teams[0].color;
    const pctA = Math.round(s.winProb.teamA * 100);
    const pctB = s.winProb.teamB !== undefined ? Math.round(s.winProb.teamB * 100) : 100 - pctA;
    this.e.pctA.textContent = `${pctA}%`;
    this.e.pctB.textContent = `${pctB}%`;
    if (s.teams && s.teams.length >= 2) {
      this.setCrest(this.e.crestA, s.teams[0].short);
      this.setCrest(this.e.crestB, s.teams[1].short);
    }
  }
}
