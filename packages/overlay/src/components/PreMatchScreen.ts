import type { MatchState } from '@stumpcast/shared';
import { assetUrl, attachImage, teamAssetId } from '../assets';
import { OverlayComponent } from '../component';

export type PreMatchScene = 'auto' | 'clock' | 'toss' | 'squad1' | 'squad2';

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
          <h1 class="pms-title">SOUTH AFRICA VS AUSTRALIA</h1>
          <p class="pms-venue">1ST TEST • KINGSMEAD, DURBAN • 10:00 AM LOCAL</p>
        </header>

        <!-- Dynamic Scene Content Area -->
        <main class="pms-scene-area"></main>
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
    const url = assetUrl('teams', teamAssetId(short));
    if (host.dataset.src === url) return;
    host.dataset.src = url;
    host.replaceChildren();
    attachImage(host, url);
  }

  setScene(scene: PreMatchScene): void {
    this.activeScene = scene;
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
      // Countdown & Captains Comparison
      const el = document.createElement('div');
      el.className = 'pms-scene pms-scene-clock';
      el.innerHTML = `
        <div class="pms-captains-grid">
          <!-- Captain A -->
          <div class="pms-captain-card">
            <div class="pms-cap-badge">CAPTAIN • ${teamA.short}</div>
            <div class="pms-cap-crest pms-crest-a"></div>
            <h2 class="pms-cap-name">TEMBA BAVUMA</h2>
            <div class="pms-cap-stats">
              <div class="pms-cap-stat"><span>MATCHES</span><strong>58</strong></div>
              <div class="pms-cap-stat"><span>RUNS</span><strong>3,184</strong></div>
              <div class="pms-cap-stat"><span>AVG</span><strong>37.45</strong></div>
            </div>
          </div>

          <!-- Countdown Center Clock -->
          <div class="pms-clock-center">
            <span class="pms-clock-label">COUNTDOWN TO TOSS / START</span>
            <div class="pms-clock-display">
              <div class="pms-clock-unit"><strong>00</strong><span>HRS</span></div>
              <span class="pms-clock-sep">:</span>
              <div class="pms-clock-unit"><strong>14</strong><span>MIN</span></div>
              <span class="pms-clock-sep">:</span>
              <div class="pms-clock-unit pms-unit-sec"><strong>25</strong><span>SEC</span></div>
            </div>
            <div class="pms-pitch-badge">
              <span>PITCH REPORT: HARD GREEN SURFACE, ASSISTING SEAM</span>
            </div>
          </div>

          <!-- Captain B -->
          <div class="pms-captain-card">
            <div class="pms-cap-badge">CAPTAIN • ${teamB.short}</div>
            <div class="pms-cap-crest pms-crest-b"></div>
            <h2 class="pms-cap-name">PAT CUMMINS</h2>
            <div class="pms-cap-stats">
              <div class="pms-cap-stat"><span>MATCHES</span><strong>62</strong></div>
              <div class="pms-cap-stat"><span>WICKETS</span><strong>269</strong></div>
              <div class="pms-cap-stat"><span>AVG</span><strong>22.53</strong></div>
            </div>
          </div>
        </div>
      `;
      this.setCrest(el.querySelector<HTMLElement>('.pms-crest-a')!, teamA.short);
      this.setCrest(el.querySelector<HTMLElement>('.pms-crest-b')!, teamB.short);
      area.appendChild(el);
    } else if (effectiveScene === 'toss') {
      // Official Toss Presentation
      const tossTeam = s.toss ? (s.toss.winnerTeamId === teamA.id ? teamA : teamB) : teamB;
      const decision = s.toss?.decision === 'bat' ? 'BAT' : 'BOWL';
      const el = document.createElement('div');
      el.className = 'pms-scene pms-scene-toss';
      el.innerHTML = `
        <div class="pms-toss-card">
          <div class="pms-toss-badge">OFFICIAL TOSS RESULT</div>
          <div class="pms-toss-crest"></div>
          <h2 class="pms-toss-headline">${tossTeam.name.toUpperCase()} WON THE TOSS</h2>
          <p class="pms-toss-decision">ELECTED TO ${decision} FIRST</p>
          <div class="pms-toss-teams-row">
            <span class="pms-toss-pill">${teamA.name}: FIELDING FIRST</span>
            <span class="pms-toss-pill">${teamB.name}: BATTING FIRST</span>
          </div>
        </div>
      `;
      this.setCrest(el.querySelector<HTMLElement>('.pms-toss-crest')!, tossTeam.short);
      area.appendChild(el);
    } else if (effectiveScene === 'squad1') {
      // Team 1 Playing XI
      const squad = [
        { name: 'Aiden Markram', role: 'Opening Batter' },
        { name: 'Ryan Rickelton', role: 'Batter' },
        { name: 'David Bedingham', role: 'Batter' },
        { name: 'Temba Bavuma', role: 'Captain', cap: true },
        { name: 'Tristan Stubbs', role: 'Batter' },
        { name: 'Kyle Verreynne', role: 'Wicket-Keeper', wk: true },
        { name: 'Wiaan Mulder', role: 'All-Rounder' },
        { name: 'Marco Jansen', role: 'Bowling All-Rounder' },
        { name: 'Keshav Maharaj', role: 'Spin Bowler' },
        { name: 'Kagiso Rabada', role: 'Fast Bowler' },
        { name: 'Lungi Ngidi', role: 'Fast Bowler' },
      ];
      const el = document.createElement('div');
      el.className = 'pms-scene pms-scene-squad';
      el.innerHTML = `
        <div class="pms-squad-container">
          <div class="pms-squad-header">
            <div class="pms-squad-crest"></div>
            <div>
              <h2 class="pms-squad-team-name">${teamA.name.toUpperCase()} PLAYING XI</h2>
              <span class="pms-squad-sub">OFFICIAL LINE-UP</span>
            </div>
          </div>
          <div class="pms-squad-list">
            ${squad
              .map(
                (p, i) => `
              <div class="pms-squad-player">
                <span class="pms-player-no">${i + 1}</span>
                <span class="pms-player-name">${p.name} ${p.cap ? '(C)' : ''} ${p.wk ? '(WK)' : ''}</span>
                <span class="pms-player-role">${p.role}</span>
              </div>
            `,
              )
              .join('')}
          </div>
        </div>
      `;
      this.setCrest(el.querySelector<HTMLElement>('.pms-squad-crest')!, teamA.short);
      area.appendChild(el);
    } else if (effectiveScene === 'squad2') {
      // Team 2 Playing XI
      const squad = [
        { name: 'Usman Khawaja', role: 'Opening Batter' },
        { name: 'Matt Renshaw', role: 'Opening Batter' },
        { name: 'Marnus Labuschagne', role: 'Batter' },
        { name: 'Steven Smith', role: 'Batter' },
        { name: 'Travis Head', role: 'Batter' },
        { name: 'Mitchell Marsh', role: 'All-Rounder' },
        { name: 'Alex Carey', role: 'Wicket-Keeper', wk: true },
        { name: 'Pat Cummins', role: 'Captain & Fast Bowler', cap: true },
        { name: 'Mitchell Starc', role: 'Fast Bowler' },
        { name: 'Nathan Lyon', role: 'Off-Spin Bowler' },
        { name: 'Josh Hazlewood', role: 'Fast Bowler' },
      ];
      const el = document.createElement('div');
      el.className = 'pms-scene pms-scene-squad';
      el.innerHTML = `
        <div class="pms-squad-container">
          <div class="pms-squad-header">
            <div class="pms-squad-crest"></div>
            <div>
              <h2 class="pms-squad-team-name">${teamB.name.toUpperCase()} PLAYING XI</h2>
              <span class="pms-squad-sub">OFFICIAL LINE-UP</span>
            </div>
          </div>
          <div class="pms-squad-list">
            ${squad
              .map(
                (p, i) => `
              <div class="pms-squad-player">
                <span class="pms-player-no">${i + 1}</span>
                <span class="pms-player-name">${p.name} ${p.cap ? '(C)' : ''} ${p.wk ? '(WK)' : ''}</span>
                <span class="pms-player-role">${p.role}</span>
              </div>
            `,
              )
              .join('')}
          </div>
        </div>
      `;
      this.setCrest(el.querySelector<HTMLElement>('.pms-squad-crest')!, teamB.short);
      area.appendChild(el);
    }
  }

  update(s: MatchState): void {
    this.currentState = s;
    this.renderScene(s);

    if (this.activeScene === 'auto' && !this.timer) {
      this.timer = window.setInterval(() => {
        if (this.activeScene === 'auto' && this.currentState) {
          this.autoCycleIndex++;
          this.renderScene(this.currentState);
        }
      }, 15000);
    }
  }

  override destroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    super.destroy?.();
  }
}
