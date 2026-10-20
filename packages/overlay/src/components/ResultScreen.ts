import type { MatchState } from '@stumpcast/shared';
import { assetUrl, attachImage, teamAssetId } from '../assets';
import { OverlayComponent } from '../component';
import { scoreText } from '../format';

/** Used when the feed genuinely has no figures. A result screen must never invent them. */
const emptyRow = (label: string): HTMLElement => {
  const el = document.createElement('div');
  el.className = 'rs-performer-row';
  el.innerHTML = `<div class="rs-p-identity"><span class="rs-p-name">${label}</span></div>`;
  return el;
};

/**
 * Full-screen TV broadcast Match Result Screen matching Recording 2026-10-17 104410
 * and international sports broadcast standards.
 */
export class ResultScreen extends OverlayComponent {
  protected override readonly alwaysVisible = false;

  private e!: {
    teamAFlag: HTMLElement;
    teamAName: HTMLElement;
    teamAScore: HTMLElement;
    teamBFlag: HTMLElement;
    teamBName: HTMLElement;
    teamBScore: HTMLElement;
    resultBanner: HTMLElement;
    resultText: HTMLElement;
    matchSubtitle: HTMLElement;
    inningsRows: HTMLElement;
    topBatters: HTMLElement;
    topBowlers: HTMLElement;
  };

  protected build(): HTMLElement {
    const root = document.createElement('div');
    root.className = 'c-result-screen';
    root.innerHTML = `
      <div class="rs-container">
        <!-- Top Match Header Bar -->
        <header class="rs-header">
          <div class="rs-team rs-team-a">
            <span class="rs-crest rs-crest-a"></span>
            <div class="rs-team-info">
              <span class="rs-name rs-name-a"></span>
              <span class="rs-score rs-score-a"></span>
            </div>
          </div>

          <div class="rs-center-meta">
            <div class="rs-vs-badge">
              <span class="rs-vs-text">VS</span>
              <span class="rs-brand"><span class="rs-brand-dot"></span>STUMPCAST</span>
            </div>
            <div class="rs-verdict-badge">
              <span class="rs-verdict-tag">RESULT</span>
              <strong class="rs-verdict-text">AWAITING RESULT</strong>
            </div>
            <span class="rs-subtitle"></span>
          </div>

          <div class="rs-team rs-team-b">
            <div class="rs-team-info rs-info-right">
              <span class="rs-name rs-name-b"></span>
              <span class="rs-score rs-score-b"></span>
            </div>
            <span class="rs-crest rs-crest-b"></span>
          </div>
        </header>

        <!-- Main Scorecard Table -->
        <section class="rs-scorecard-section">
          <div class="rs-table-wrap">
            <table class="rs-table">
              <tbody class="rs-tbody"></tbody>
            </table>
          </div>
        </section>

        <!-- Side-by-Side Top Performers Grid -->
        <footer class="rs-performers-grid">
          <!-- Top Batters -->
          <div class="rs-card rs-card-batters">
            <div class="rs-card-header rs-bat-header">
              <span class="rs-header-icon">🏏</span>
              <h3 class="rs-card-title">TOP BATTERS</h3>
            </div>
            <div class="rs-performers-list rs-batters-list"></div>
          </div>

          <!-- Top Bowlers -->
          <div class="rs-card rs-card-bowlers">
            <div class="rs-card-header rs-bowl-header">
              <span class="rs-header-icon">🎯</span>
              <h3 class="rs-card-title">TOP BOWLERS</h3>
            </div>
            <div class="rs-performers-list rs-bowlers-list"></div>
          </div>
        </footer>
      </div>
    `;

    const q = (s: string) => root.querySelector<HTMLElement>(s)!;
    this.e = {
      teamAFlag: q('.rs-crest-a'),
      teamAName: q('.rs-name-a'),
      teamAScore: q('.rs-score-a'),
      teamBFlag: q('.rs-crest-b'),
      teamBName: q('.rs-name-b'),
      teamBScore: q('.rs-score-b'),
      resultBanner: q('.rs-verdict-badge'),
      resultText: q('.rs-verdict-text'),
      matchSubtitle: q('.rs-subtitle'),
      inningsRows: q('.rs-tbody'),
      topBatters: q('.rs-batters-list'),
      topBowlers: q('.rs-bowlers-list'),
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
    const teamA = s.teams[0] ?? { name: 'Australia', short: 'AUS', color: '#00843D' };
    const teamB = s.teams[1] ?? { name: 'South Africa', short: 'RSA', color: '#007A4D' };

    this.e.teamAName.textContent = teamA.short;
    this.e.teamBName.textContent = teamB.short;
    this.setCrest(this.e.teamAFlag, teamA.short);
    this.setCrest(this.e.teamBFlag, teamB.short);

    // Latest scores for header
    const innA = s.innings.filter((i) => i.battingTeamId === teamA.id);
    const innB = s.innings.filter((i) => i.battingTeamId === teamB.id);
    const lastA = innA.at(-1);
    const lastB = innB.at(-1);
    this.e.teamAScore.textContent = lastA ? scoreText(lastA.score) : '';
    this.e.teamBScore.textContent = lastB ? scoreText(lastB.score) : '';

    // Verdict text
    const verdict = s.result ?? (s.status === 'result' ? 'Match Completed' : 'Match in Progress');
    this.e.resultText.textContent = verdict.toUpperCase();
    this.e.matchSubtitle.textContent = `${s.format} MATCH • ${s.venue || 'STADIUM'}`.toUpperCase();

    // Innings table rows
    this.e.inningsRows.replaceChildren();
    if (s.innings.length > 0) {
      for (const inn of s.innings) {
        const team = s.teams.find((t) => t.id === inn.battingTeamId) ?? teamA;
        const row = document.createElement('tr');
        row.className = 'rs-row';
        row.innerHTML = `
          <td class="rs-td-crest"><span class="rs-mini-crest"></span></td>
          <td class="rs-td-team"><span class="rs-row-team-name">${team.name.toUpperCase()}</span></td>
          <td class="rs-td-score">
            <strong class="rs-row-score-val">${scoreText(inn.score)}</strong>
            <span class="rs-row-overs">(${inn.score.overs}.${inn.score.balls} OV)</span>
          </td>
        `;
        const crestEl = row.querySelector<HTMLElement>('.rs-mini-crest')!;
        this.setCrest(crestEl, team.short);
        this.e.inningsRows.appendChild(row);
      }
    } else {
      const row = document.createElement('tr');
      row.className = 'rs-row';
      row.innerHTML = `
        <td class="rs-td-team" colspan="3"><span class="rs-row-team-name">NO INNINGS DATA RECORDED</span></td>
      `;
      this.e.inningsRows.appendChild(row);
    }

    // Top Batters
    this.e.topBatters.replaceChildren();
    const liveBatters = s.batters.filter((b) => b.name && b.name !== '—');
    if (liveBatters.length > 0) {
      for (const b of liveBatters) {
        const el = document.createElement('div');
        el.className = 'rs-performer-row';
        const sr = b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0';
        el.innerHTML = `
          <div class="rs-p-identity">
            <span class="rs-p-bullet"></span>
            <span class="rs-p-name">${b.name.toUpperCase()}</span>
          </div>
          <div class="rs-p-figures">
            <strong class="rs-p-primary">${b.runs}</strong>
            <span class="rs-p-secondary">(${b.balls})</span>
            <span class="rs-p-extra">SR ${sr}</span>
          </div>
        `;
        this.e.topBatters.appendChild(el);
      }
    } else {
      this.e.topBatters.appendChild(emptyRow('BATTING NOT PROVIDED'));
    }

    // Top Bowlers
    this.e.topBowlers.replaceChildren();
    if (s.bowler && s.bowler.name && s.bowler.name !== '—') {
      const b = s.bowler;
      const el = document.createElement('div');
      el.className = 'rs-performer-row';
      const econ = b.overs > 0 ? (b.runs / (b.overs + b.balls / 6)).toFixed(2) : '0.00';
      el.innerHTML = `
        <div class="rs-p-identity">
          <span class="rs-p-bullet"></span>
          <span class="rs-p-name">${b.name.toUpperCase()}</span>
        </div>
        <div class="rs-p-figures">
          <strong class="rs-p-primary">${b.wkts}-${b.runs}</strong>
          <span class="rs-p-secondary">(${b.overs}.${b.balls})</span>
          <span class="rs-p-extra">ECON ${econ}</span>
        </div>
      `;
      this.e.topBowlers.appendChild(el);
    } else {
      this.e.topBowlers.appendChild(emptyRow('BOWLING NOT PROVIDED'));
    }
  }
}
