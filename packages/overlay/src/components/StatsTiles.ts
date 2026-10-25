import type { MatchState } from '@stumpcast/shared';
import { OverlayComponent } from '../component';

interface Tile {
  label: string;
  value: string;
}

/** CRR, partnership, target (or lead) and wickets left. */
export class StatsTiles extends OverlayComponent {
  protected override readonly alwaysVisible = true;
  private grid!: HTMLElement;

  protected build(): HTMLElement {
    const root = document.createElement('div');
    root.className = 'c-stats';
    this.grid = root;
    return root;
  }

  static tiles(s: MatchState, isArena = false): Tile[] {
    const pshipLabel = isArena ? "P'SHIP" : 'PARTNERSHIP';
    const wktsLabel = isArena ? 'WKTS LEFT' : 'WICKETS LEFT';
    const out: Tile[] = [{ label: 'CRR', value: s.crr.toFixed(2) }];
    if (isArena) {
      out.push({ label: pshipLabel, value: `${s.partnership.runs} (${s.partnership.balls})` });
      if (s.target !== undefined && (s.currentInnings >= 2 || s.format === 'TEST')) {
        out.push({ label: 'TARGET', value: String(s.target) });
      } else if (s.rrr !== undefined) {
        out.push({ label: 'RRR', value: s.rrr.toFixed(2) });
      } else if (s.lead !== undefined) {
        out.push({
          label: s.lead >= 0 ? 'LEAD' : 'TRAIL',
          value: String(Math.abs(s.lead)),
        });
      } else if (s.projected !== undefined) {
        out.push({ label: 'PROJECTED', value: String(s.projected) });
      }
      out.push({
        label: wktsLabel,
        value: String(s.wicketsLeft ?? Math.max(0, 10 - s.score.wkts)),
      });
      return out;
    }
    if (s.rrr !== undefined) out.push({ label: 'RRR', value: s.rrr.toFixed(2) });
    out.push({ label: 'PARTNERSHIP', value: `${s.partnership.runs} (${s.partnership.balls})` });
    if (s.target !== undefined && (s.currentInnings >= 2 || s.format === 'TEST')) {
      out.push({ label: 'TARGET', value: String(s.target) });
    } else if (s.lead !== undefined) {
      out.push({
        label: s.lead >= 0 ? 'LEAD' : 'TRAIL',
        value: String(Math.abs(s.lead)),
      });
    } else if (s.projected !== undefined) {
      out.push({ label: 'PROJECTED', value: String(s.projected) });
    }
    out.push({
      label: 'WICKETS LEFT',
      value: String(s.wicketsLeft ?? Math.max(0, 10 - s.score.wkts)),
    });
    return out;
  }

  update(s: MatchState): void {
    const isArena =
      document.getElementById('stage')?.dataset.layout === 'arena' ||
      document.documentElement.dataset.layout === 'arena' ||
      Boolean(this.grid.closest("[data-layout='arena']"));
    const tiles = StatsTiles.tiles(s, isArena);
    // Reuse nodes so values change in place (no flicker, no layout thrash).
    while (this.grid.children.length > tiles.length) this.grid.lastElementChild!.remove();
    tiles.forEach((t, i) => {
      let el = this.grid.children[i] as HTMLElement | undefined;
      if (!el) {
        el = document.createElement('div');
        el.className = 'st-tile';
        el.innerHTML = '<span class="st-label"></span><span class="st-value"></span>';
        this.grid.appendChild(el);
      }
      el.querySelector('.st-value')!.textContent = t.value;
      el.querySelector('.st-label')!.textContent = t.label;
    });
  }
}
