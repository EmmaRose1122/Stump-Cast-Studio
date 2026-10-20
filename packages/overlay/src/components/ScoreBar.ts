import type { MatchState } from '@stumpcast/shared';
import { assetUrl, attachImage, teamAssetId } from '../assets';
import { OverlayComponent } from '../component';
import { battingTeam, bowlingTeam, oversText, scoreText, situationText } from '../format';

/** Teams, crests, score, overs, situation line and run rates. */
export class ScoreBar extends OverlayComponent {
  protected override readonly alwaysVisible = true;
  private e!: Record<
    | 'bat'
    | 'batShort'
    | 'batHistory'
    | 'batCrest'
    | 'bowl'
    | 'bowlShort'
    | 'bowlHistory'
    | 'bowlCrest'
    | 'score'
    | 'overs'
    | 'situation'
    | 'needLabel'
    | 'needVal'
    | 'scoreInline'
    | 'oversInline'
    | 'crr'
    | 'rrr',
    HTMLElement
  >;

  protected build(): HTMLElement {
    const root = document.createElement('div');
    root.className = 'c-scorebar';
    root.innerHTML = `
      <div class="sb-team sb-bat">
        <span class="sb-crest"></span>
        <span class="sb-team-copy">
          <span class="sb-name"></span>
          <span class="sb-short"></span>
          <span class="sb-live-row">
            <span class="sb-history"></span>
            <span class="sb-score-inline">0-0</span>
            <span class="sb-overs-inline">
              <strong class="sb-overs-num">0.0</strong>
              <span class="sb-overs-label">OVERS</span>
            </span>
          </span>
        </span>
      </div>
      <div class="sb-score-wrap">
        <span class="sb-score">0-0</span>
        <span class="sb-overs">0.0</span>
      </div>
      <div class="sb-meta">
        <div class="sb-need-badge">
          <span class="sb-need-label">NEED</span>
          <span class="sb-need-val">—</span>
        </div>
        <span class="sb-situation"></span>
        <span class="sb-chip sb-crr"></span>
        <span class="sb-chip sb-rrr"></span>
        <span class="sb-brand-pill"><span class="sb-brand-dot"></span>STUMPCAST STUDIO</span>
      </div>
      <div class="sb-team sb-bowl">
        <span class="sb-team-copy">
          <span class="sb-name"></span>
          <span class="sb-short"></span>
          <span class="sb-history"></span>
        </span>
        <span class="sb-crest"></span>
      </div>`;
    const q = (s: string) => root.querySelector<HTMLElement>(s)!;
    this.e = {
      bat: q('.sb-bat .sb-name'),
      batShort: q('.sb-bat .sb-short'),
      batHistory: q('.sb-bat .sb-history'),
      scoreInline: q('.sb-score-inline'),
      oversInline: q('.sb-overs-inline'),
      batCrest: q('.sb-bat .sb-crest'),
      bowl: q('.sb-bowl .sb-name'),
      bowlShort: q('.sb-bowl .sb-short'),
      bowlHistory: q('.sb-bowl .sb-history'),
      bowlCrest: q('.sb-bowl .sb-crest'),
      score: q('.sb-score'),
      overs: q('.sb-overs'),
      situation: q('.sb-situation'),
      needLabel: q('.sb-need-label'),
      needVal: q('.sb-need-val'),
      crr: q('.sb-crr'),
      rrr: q('.sb-rrr'),
    };
    return root;
  }

  /** Crest image over a coloured letter; only touches the DOM when the team changed. */
  private setCrest(host: HTMLElement, short: string): void {
    const id = teamAssetId(short);
    const url = id ? assetUrl('teams', id) : '';
    if (host.dataset.src === url) return;
    host.dataset.src = url;
    host.replaceChildren();
    host.classList.remove('has-image');
    host.textContent = short.slice(0, 1);
    if (url) attachImage(host, url);
  }

  update(s: MatchState): void {
    const bat = battingTeam(s);
    const bowl = bowlingTeam(s);
    this.e.bat.textContent = bat.name;
    this.e.batShort.textContent = bat.short;
    this.e.bowl.textContent = bowl.name;
    this.e.bowlShort.textContent = bowl.short;
    const previousBatInnings = s.innings
      .filter((innings) => innings.battingTeamId === bat.id && innings.number !== s.currentInnings)
      .map((innings) => scoreText(innings.score));
    const bowlingInnings = s.innings
      .filter((innings) => innings.battingTeamId === bowl.id)
      .map((innings) => scoreText(innings.score));
    this.e.batHistory.textContent = previousBatInnings.join(' & ');
    this.e.batHistory.hidden = previousBatInnings.length === 0;
    this.e.bowlHistory.textContent = bowlingInnings.join(' & ');
    this.e.bowlHistory.hidden = bowlingInnings.length === 0;
    this.root.style.setProperty('--team-bat-color', bat.color);
    this.root.style.setProperty('--team-bowl-color', bowl.color);
    this.e.batCrest.style.background = bat.color;
    this.e.bowlCrest.style.background = bowl.color;
    this.setCrest(this.e.batCrest, bat.short);
    this.setCrest(this.e.bowlCrest, bowl.short);
    this.e.score.textContent = scoreText(s.score);
    this.e.overs.textContent = oversText(s.score);
    this.e.scoreInline.textContent = scoreText(s.score);
    const qOversNum = this.e.oversInline.querySelector<HTMLElement>('.sb-overs-num');
    if (qOversNum) {
      qOversNum.textContent = oversText(s.score);
    } else {
      this.e.oversInline.textContent = `${oversText(s.score)} OVERS`;
    }

    const sit = situationText(s);
    this.e.situation.textContent = sit ?? '';
    this.e.situation.hidden = sit === null;

    if (s.target !== undefined) {
      const needed = Math.max(0, s.target - s.score.runs);
      if (needed === 0) {
        // A chase that is already won must not read "NEED 0".
        this.e.needLabel.textContent = 'TARGET';
        this.e.needVal.textContent = String(s.target);
      } else {
        this.e.needLabel.textContent = 'NEED';
        this.e.needVal.textContent = String(needed);
      }
    } else if (s.lead !== undefined && s.lead < 0) {
      this.e.needLabel.textContent = 'NEED';
      this.e.needVal.textContent = String(Math.abs(s.lead));
    } else if (s.day !== undefined) {
      this.e.needLabel.textContent = `DAY ${s.day}`;
      this.e.needVal.textContent = (s.session || 'STUMPS').toUpperCase();
    } else {
      this.e.needLabel.textContent = 'STATUS';
      this.e.needVal.textContent = s.status.toUpperCase();
    }

    const hasBalls = s.score.overs > 0 || s.score.balls > 0;
    this.e.crr.textContent = hasBalls ? `CRR ${s.crr.toFixed(2)}` : '';
    this.e.crr.hidden = !hasBalls;
    const showRrr = s.rrr !== undefined && s.status !== 'result';
    this.e.rrr.textContent = showRrr ? `RRR ${s.rrr!.toFixed(2)}` : '';
    this.e.rrr.hidden = !showRrr;
  }
}
