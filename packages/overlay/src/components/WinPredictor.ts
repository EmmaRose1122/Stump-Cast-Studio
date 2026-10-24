import type { MatchState, Team } from '@stumpcast/shared';
import { slug } from '@stumpcast/shared';
import { assetUrl, attachImage, teamAssetId } from '../assets';
import { OverlayComponent } from '../component';
import { battingTeam, bowlingTeam } from '../format';

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');

/**
 * Win prediction with faces.
 *
 * The old bar carried crests only. A crest is a flag; the thing a viewer recognises is the player,
 * so each side also shows who is actually out there — the two batters for the batting side and the
 * bowler for the bowling side. Photos resolve the same way the player cards do (local asset under
 * the player slug), then fall back to the photo the score site published in the squad, then to
 * initials, so the panel is never empty on a freshly scraped match.
 */
export class WinPredictor extends OverlayComponent {
  protected override readonly alwaysVisible = true;
  private e!: Record<
    'aTeam' | 'bTeam' | 'pctA' | 'pctB' | 'fillA' | 'crestA' | 'crestB' | 'avA' | 'avB',
    HTMLElement
  >;

  protected build(): HTMLElement {
    const root = document.createElement('section');
    root.className = 'c-winpredictor';
    root.innerHTML = `
      <div class="wpr-label">WIN PREDICTOR <span class="wpr-est">EST.</span></div>
      <div class="wpr-card">
        <div class="wpr-side wpr-side-a">
          <span class="wpr-crest wpr-crest-a"></span>
          <span class="wpr-avatars wpr-av-a"></span>
          <span class="wpr-team wpr-team-a"></span>
        </div>
        <span class="wpr-pct wpr-pct-a"></span>
        <div class="wpr-bar"><div class="wpr-fill"></div></div>
        <span class="wpr-pct wpr-pct-b"></span>
        <div class="wpr-side wpr-side-b">
          <span class="wpr-team wpr-team-b"></span>
          <span class="wpr-avatars wpr-av-b"></span>
          <span class="wpr-crest wpr-crest-b"></span>
        </div>
      </div>`;
    const q = (s: string) => root.querySelector<HTMLElement>(s)!;
    this.e = {
      aTeam: q('.wpr-team-a'),
      bTeam: q('.wpr-team-b'),
      pctA: q('.wpr-pct-a'),
      pctB: q('.wpr-pct-b'),
      fillA: q('.wpr-fill'),
      crestA: q('.wpr-crest-a'),
      crestB: q('.wpr-crest-b'),
      avA: q('.wpr-av-a'),
      avB: q('.wpr-av-b'),
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

  /** The squad photo for a player name, if the scrape carried one. */
  private publishedPhoto(team: Team | undefined, name: string): string | undefined {
    return team?.squad?.find((p) => p.name === name)?.imageUrl;
  }

  /** Local broadcast cutout first, then its flat fallback, then whatever the score site published. */
  private photoSources(team: Team | undefined, name: string): string[] {
    const local = assetUrl('players', slug(name));
    return [local, local.replace(/\.webp$/, '.svg'), this.publishedPhoto(team, name)].filter(
      (u): u is string => Boolean(u),
    );
  }

  /**
   * Rebuilds one side's avatar strip only when the players or their images change, so a score
   * update does not re-download every face. The slot keeps the player's initials until a source
   * loads, so a missing photo degrades to a readable badge rather than a broken icon.
   */
  private setAvatars(host: HTMLElement, team: Team | undefined, names: string[]): void {
    const people = names.filter((n) => n && n !== '—').slice(0, 2);
    const key = people.map((n) => `${n}|${this.photoSources(team, n).join(',')}`).join('~');
    if (host.dataset.key === key) return;
    host.dataset.key = key;
    host.replaceChildren();

    for (const name of people) {
      const slot = document.createElement('span');
      slot.className = 'wpr-avatar';
      slot.textContent = initials(name);
      const sources = this.photoSources(team, name);
      if (sources.length > 0) {
        const img = document.createElement('img');
        img.alt = '';
        img.decoding = 'async';
        img.className = 'asset-img';
        img.style.display = 'none';
        let index = 0;
        img.addEventListener('load', () => {
          img.style.display = '';
          slot.classList.add('has-image');
        });
        img.addEventListener('error', () => {
          index += 1;
          const next = sources[index];
          if (next) {
            img.src = next;
            return;
          }
          img.remove();
        });
        img.src = sources[0]!;
        slot.append(img);
      }
      host.append(slot);
    }
  }

  update(s: MatchState): void {
    const available = Boolean(s.winProb) && s.teams.length >= 2;
    this.root.hidden = !available;
    if (!available || !s.winProb) return;

    const bat = battingTeam(s);
    const bowl = bowlingTeam(s);
    const pBat = bat.id === s.teams[0].id ? s.winProb.teamA : s.winProb.teamB;

    this.e.aTeam.textContent = bat.short;
    this.e.bTeam.textContent = bowl.short;
    this.e.fillA.style.width = `${(pBat * 100).toFixed(1)}%`;
    this.e.fillA.style.background = bat.color;
    if (this.e.fillA.parentElement) {
      this.e.fillA.parentElement.style.background = bowl.color;
    }
    const pctBat = Math.round(pBat * 100);
    // One number, not two: rounding both halves independently can put 101% on air.
    this.e.pctA.textContent = `${pctBat}%`;
    this.e.pctB.textContent = `${100 - pctBat}%`;
    this.setCrest(this.e.crestA, bat.short);
    this.setCrest(this.e.crestB, bowl.short);

    // Who is on the field right now, not the whole XI.
    const batNames = (s.batters ?? []).map((b) => b.name);
    const bowlNames = s.bowler ? [s.bowler.name] : [];
    this.setAvatars(
      this.e.avA,
      s.teams.find((t) => t.id === bat.id),
      batNames,
    );
    this.setAvatars(
      this.e.avB,
      s.teams.find((t) => t.id === bowl.id),
      bowlNames,
    );
  }
}
