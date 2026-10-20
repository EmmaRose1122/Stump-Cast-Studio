import type { MatchState, Team } from '@stumpcast/shared';
import { assetUrl, attachImage, teamAssetId } from '../assets';
import { OverlayComponent } from '../component';

export type PreMatchScene = 'auto' | 'clock' | 'toss' | 'squad1' | 'squad2';

/** Seconds a pinned auto-cycle stays on one scene (Settings > Video can override; see `sceneSec`). */
const CYCLE_MS = 15_000;

const STATUS_LINE: Record<string, string> = {
  pre: 'YET TO BEGIN',
  live: 'IN PLAY',
  break: 'BREAK',
  innings_break: 'INNINGS BREAK',
  result: 'COMPLETE',
};

/**
 * Pre-Match TV broadcast presentation screen showing countdown clock, captains comparison,
 * toss outcome, and full team playing XIs.
 */
export class PreMatchScreen extends OverlayComponent {
  protected override readonly alwaysVisible = false;

  private activeScene: PreMatchScene = 'auto';
  private autoCycleIndex = 0;
  private timer: number | null = null;
  private currentState: MatchState | null = null;

  private e!: {
    container: HTMLElement;
    matchTitle: HTMLElement;
    venueText: HTMLElement;
    sceneTabs: HTMLElement;
    sceneContainer: HTMLElement;
  };

  protected build(): HTMLElement {
    const root = document.createElement('div');
    root.className = 'c-prematch-screen';
    root.innerHTML = `
      <div class="pms-container">
        <!-- Top Match Banner -->
        <header class="pms-header">
          <div class="pms-brand-pill">
            <span class="pms-live-dot"></span>
            <span>PRE-MATCH BROADCAST</span>
          </div>
          <h1 class="pms-title"></h1>
          <p class="pms-venue"></p>
        </header>

        <!-- Dynamic Scene Content Area -->
        <main class="pms-scene-area">
          <div class="pms-scene pms-scene-clock">
            <div class="pms-clock-center">
              <span class="pms-clock-label">WAITING FOR MATCH DATA</span>
            </div>
          </div>
        </main>
      </div>
    `;

    const q = (s: string) => root.querySelector<HTMLElement>(s)!;
    this.e = {
      container: q('.pms-container'),
      matchTitle: q('.pms-title'),
      venueText: q('.pms-venue'),
      sceneTabs: root,
      sceneContainer: q('.pms-scene-area'),
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

  setScene(scene: PreMatchScene): void {
    this.activeScene = scene;
    if (scene !== 'auto') this.autoCycleIndex = 0;
    this.syncCycle();
    if (this.currentState) this.renderScene(this.currentState);
  }

  private renderScene(s: MatchState): void {
    const teamA = s.teams[0] ?? { name: 'South Africa', short: 'RSA', color: '#007A4D' };
    const teamB = s.teams[1] ?? { name: 'Australia', short: 'AUS', color: '#00843D' };

    let effectiveScene = this.activeScene;
    if (effectiveScene === 'auto') {
      const scenes: PreMatchScene[] = ['clock', 'toss', 'squad1', 'squad2'];
      effectiveScene = scenes[this.autoCycleIndex % scenes.length] ?? 'clock';
    }

    this.e.matchTitle.textContent = `${teamA.name.toUpperCase()} VS ${teamB.name.toUpperCase()}`;
    this.e.venueText.textContent = `${s.format} MATCH • ${s.venue || 'STADIUM'} • MATCH DAY SHOW`.toUpperCase();

    const area = this.e.sceneContainer;
    area.replaceChildren();

    if (effectiveScene === 'clock') {
      // Match info panel. The feed carries no start time, captain or pitch report, so none is shown.
      const el = document.createElement('div');
      el.className = 'pms-scene pms-scene-clock';
      const teamCard = (t: (typeof teamA), side: 'a' | 'b') => `
        <div class="pms-captain-card">
          <div class="pms-cap-badge">${t.short}</div>
          <div class="pms-cap-crest pms-crest-${side}"></div>
          <h2 class="pms-cap-name">${t.name.toUpperCase()}</h2>
          <div class="pms-cap-stats">
            <div class="pms-cap-stat"><span>TOSS</span><strong>${this.tossRole(s, t.id)}</strong></div>
          </div>
        </div>`;
      el.innerHTML = `
        <div class="pms-captains-grid">
          ${teamCard(teamA, 'a')}

          <div class="pms-clock-center">
            <span class="pms-clock-label">MATCH STATUS</span>
            <div class="pms-clock-display">
              <div class="pms-clock-unit">
                <strong>${STATUS_LINE[s.status] ?? s.status.toUpperCase()}</strong>
                <span>${s.format}</span>
              </div>
            </div>
            <div class="pms-pitch-badge">
              <span>${(s.venue ?? 'VENUE NOT ANNOUNCED').toUpperCase()}</span>
            </div>
          </div>

          ${teamCard(teamB, 'b')}
        </div>
      `;
      this.setCrest(el.querySelector<HTMLElement>('.pms-crest-a')!, teamA.short);
      this.setCrest(el.querySelector<HTMLElement>('.pms-crest-b')!, teamB.short);
      area.appendChild(el);
    } else if (effectiveScene === 'toss') {
      // Official toss presentation — nothing is claimed until the feed reports a toss.
      const tossTeam = s.toss ? (s.toss.winnerTeamId === teamA.id ? teamA : teamB) : null;
      const el = document.createElement('div');
      el.className = 'pms-scene pms-scene-toss';
      el.innerHTML = `
        <div class="pms-toss-card">
          <div class="pms-toss-badge">${s.toss ? 'OFFICIAL TOSS RESULT' : 'PRE-MATCH'}</div>
          <div class="pms-toss-crest"></div>
          <h2 class="pms-toss-headline">
            ${tossTeam ? `${tossTeam.name.toUpperCase()} WON THE TOSS` : 'THE TOSS IS YET TO TAKE PLACE'}
          </h2>
          <p class="pms-toss-decision">
            ${s.toss ? `ELECTED TO ${s.toss.decision.toUpperCase()} FIRST` : 'CONFIRMED AS SOON AS IT IS CALLED'}
          </p>
          <div class="pms-toss-teams-row">
            <span class="pms-toss-pill">${teamA.name}: ${this.tossRole(s, teamA.id)}</span>
            <span class="pms-toss-pill">${teamB.name}: ${this.tossRole(s, teamB.id)}</span>
          </div>
        </div>
      `;
      if (tossTeam) this.setCrest(el.querySelector<HTMLElement>('.pms-toss-crest')!, tossTeam.short);
      area.appendChild(el);
    } else if (effectiveScene === 'squad1') {
      this.renderSquad(area, teamA);
    } else if (effectiveScene === 'squad2') {
      this.renderSquad(area, teamB);
    }
  }

  /** The feed carries no line-ups, so the squad scene says so instead of listing invented players. */
  private renderSquad(area: HTMLElement, team: Team): void {
    const el = document.createElement('div');
    el.className = 'pms-scene pms-scene-squad';
    el.innerHTML = `
      <div class="pms-squad-container">
        <div class="pms-squad-header">
          <div class="pms-squad-crest"></div>
          <div>
            <h2 class="pms-squad-team-name">${team.name.toUpperCase()} PLAYING XI</h2>
            <span class="pms-squad-sub">LINE-UP NOT ANNOUNCED IN THE FEED</span>
          </div>
        </div>
      </div>
    `;
    this.setCrest(el.querySelector<HTMLElement>('.pms-squad-crest')!, team.short);
    area.appendChild(el);
  }

  /** What the toss decided for one side, or a pending label while the toss has not happened. */
  private tossRole(s: MatchState, teamId: string): string {
    if (!s.toss) return 'PENDING';
    const winnerBats = s.toss.decision === 'bat';
    const isWinner = s.toss.winnerTeamId === teamId;
    if (isWinner) return winnerBats ? 'BATTING FIRST' : 'FIELDING FIRST';
    return winnerBats ? 'FIELDING FIRST' : 'BATTING FIRST';
  }

  update(s: MatchState): void {
    this.currentState = s;
    this.renderScene(s);
    this.syncCycle();
  }

  override show(data?: unknown): void {
    super.show(data);
    this.syncCycle();
  }

  override hide(): void {
    this.stopCycle();
    super.hide();
  }

  /** The cycler runs only while the screen is on air and the operator has not pinned a scene. */
  private syncCycle(): void {
    if (this.activeScene !== 'auto' || !this.isVisible || !this.currentState) {
      this.stopCycle();
      return;
    }
    if (this.timer !== null) return;
    this.timer = window.setInterval(() => {
      if (this.activeScene === 'auto' && this.currentState) {
        this.autoCycleIndex++;
        this.renderScene(this.currentState);
      }
    }, CYCLE_MS);
  }

  private stopCycle(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  override destroy(): void {
    this.stopCycle();
    super.destroy?.();
  }
}
