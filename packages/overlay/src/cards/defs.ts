import type { MatchHistory, MatchState } from '@stumpcast/shared';
import { battingTeam, bowlingTeam, situationText } from '../format';
import { el, fixed, note, per, row, stat, svg, svgEl } from './dom';

export interface CardContext {
  history?: MatchHistory;
}

export interface CardDef {
  id: string;
  title: string;
  /** Needs `/api/match/:id/history` before it can draw. */
  needsHistory?: boolean;
  render(s: MatchState, ctx: CardContext): Element[];
}

const striker = (s: MatchState) => s.batters.find((b) => b.onStrike) ?? s.batters[0];
const placeholder = (name: string) => name === '—';

const currentHistory = (s: MatchState, ctx: CardContext) =>
  ctx.history?.innings.find((i) => i.number === s.currentInnings);

const empty = (text: string): Element[] => [note(text)];

/* Players ----------------------------------------------------------------------------------- */

const strikerProfile: CardDef = {
  id: 'striker-profile',
  title: 'Batter',
  render(s) {
    const b = striker(s);
    if (!b || placeholder(b.name)) return empty('Waiting for the batters.');
    const next = b.runs < 50 ? 50 : b.runs < 100 ? 100 : (Math.floor(b.runs / 50) + 1) * 50;
    return [
      el('h3', 'cd-name', b.name),
      row(
        stat(`${b.runs}`, 'RUNS'),
        stat(`${b.balls}`, 'BALLS'),
        stat(per(b.runs, b.balls, 100, 1), 'STRIKE RATE'),
        stat(`${b.fours}/${b.sixes}`, '4s / 6s'),
      ),
      note(`${next - b.runs} to reach ${next}`),
    ];
  },
};

const bowlerSpell: CardDef = {
  id: 'bowler-spell',
  title: 'Bowler',
  render(s) {
    const w = s.bowler;
    if (placeholder(w.name)) return empty('Waiting for the bowler.');
    const overs = w.overs + w.balls / 6;
    return [
      el('h3', 'cd-name', w.name),
      row(
        stat(`${w.overs}.${w.balls}`, 'OVERS'),
        stat(`${w.maidens}`, 'MAIDENS'),
        stat(`${w.runs}`, 'RUNS'),
        stat(`${w.wkts}`, 'WICKETS'),
        stat(per(w.runs, overs), 'ECONOMY'),
      ),
    ];
  },
};

const strikerVsBowler: CardDef = {
  id: 'striker-vs-bowler',
  title: 'Batter v Bowler',
  render(s) {
    const b = striker(s);
    const w = s.bowler;
    if (!b || placeholder(b.name) || placeholder(w.name)) return empty('Waiting for the players.');
    const left = el('div', 'cd-side');
    left.append(
      el('h3', 'cd-name', b.name),
      row(stat(`${b.runs}`, 'RUNS'), stat(`${b.balls}`, 'BALLS')),
    );
    const right = el('div', 'cd-side');
    right.append(
      el('h3', 'cd-name', w.name),
      row(stat(`${w.wkts}-${w.runs}`, 'FIGURES'), stat(`${w.overs}.${w.balls}`, 'OVERS')),
    );
    const vs = row(left, el('span', 'cd-vs', 'v'), right);
    return [vs];
  },
};

/* Match flow -------------------------------------------------------------------------------- */

const partnership: CardDef = {
  id: 'partnership',
  title: 'Partnership',
  render(s) {
    const [a, b] = s.batters;
    if (placeholder(a.name) || placeholder(b.name)) return empty('Waiting for the batters.');
    const total = a.runs + b.runs;
    const share = total > 0 ? (a.runs / total) * 100 : 50;
    const bar = el('div', 'cd-bar');
    const fill = el('div', 'cd-bar-fill');
    fill.style.width = `${share.toFixed(1)}%`;
    bar.append(fill);
    return [
      row(stat(`${s.partnership.runs}`, 'RUNS', 'cd-big'), stat(`${s.partnership.balls}`, 'BALLS')),
      row(
        el('span', 'cd-name', `${a.name} ${a.runs} (${a.balls})`),
        el('span', 'cd-name', `${b.name} ${b.runs} (${b.balls})`),
      ),
      bar,
      note('Bar shows each batter’s share of their innings runs'),
    ];
  },
};

const chaseGauge: CardDef = {
  id: 'chase-gauge',
  title: 'Chase',
  render(s) {
    if (s.runsNeeded === undefined || s.target === undefined) {
      return empty(s.projected !== undefined ? `Projected total ${s.projected}` : 'Not a chase.');
    }
    if (s.runsNeeded === 0) return [el('h3', 'cd-name', 'Target reached')];
    const rrr = s.rrr ?? 0;
    // Pressure: how far the required rate is above the current one, clamped to a 0-100 scale.
    const ratio = s.crr > 0 ? rrr / s.crr : rrr > 0 ? 2 : 1;
    const pressure = Math.max(0, Math.min(100, ((ratio - 0.5) / 1.5) * 100));
    const bar = el('div', 'cd-bar cd-pressure');
    const fill = el('div', 'cd-bar-fill');
    fill.style.width = `${pressure.toFixed(0)}%`;
    bar.append(fill);
    return [
      row(
        stat(`${s.runsNeeded}`, `NEED OFF ${s.ballsLeft ?? 0}`, 'cd-big'),
        stat(fixed(s.crr), 'CURRENT RATE'),
        stat(fixed(rrr), 'REQUIRED RATE'),
      ),
      bar,
      note(`Target ${s.target}`),
    ];
  },
};

const matchSituation: CardDef = {
  id: 'match-situation',
  title: 'Match situation',
  render(s) {
    const lines: HTMLElement[] = [];
    const sit = situationText(s);
    if (sit) lines.push(el('h3', 'cd-name', sit));
    lines.push(
      row(
        stat(`${s.score.runs}-${s.score.wkts}`, battingTeam(s).name.toUpperCase()),
        stat(`${s.score.overs}.${s.score.balls}`, 'OVERS'),
      ),
    );
    if (s.toss) {
      const winner = s.teams.find((t) => t.id === s.toss!.winnerTeamId);
      if (winner) lines.push(note(`${winner.name} won the toss and chose to ${s.toss.decision}`));
    }
    if (s.venue) lines.push(note(s.venue));
    return lines;
  },
};

const powerplay: CardDef = {
  id: 'powerplay',
  title: 'Powerplay',
  render(s) {
    if (!s.powerplay) return empty('Powerplay figures are available for T20 and ODI.');
    const pp = s.powerplay;
    const out: HTMLElement[] = [
      row(
        stat(`${pp.runs}-${pp.wkts}`, pp.complete ? 'POWERPLAY' : 'SO FAR'),
        stat(s.boundaries ? `${s.boundaries.fours}/${s.boundaries.sixes}` : '–', '4s / 6s'),
        stat(s.dotBallPct !== undefined ? `${s.dotBallPct.toFixed(0)}%` : '–', 'DOT BALLS'),
      ),
    ];
    if (s.ballsObserved !== undefined) out.push(note(`Based on ${s.ballsObserved} balls seen`));
    return out;
  },
};

/* Analytics --------------------------------------------------------------------------------- */

const W = 760;
const H = 220;

const manhattan: CardDef = {
  id: 'manhattan',
  title: 'Manhattan',
  needsHistory: true,
  render(s, ctx) {
    const h = currentHistory(s, ctx);
    if (!h || h.overs.length === 0) return empty('Runs per over appear once an over is complete.');
    const overs = h.overs;
    const max = Math.max(6, ...overs.map((o) => o.runs));
    const chart = svg(W, H);
    chart.classList.add('cd-chart');
    const slot = (W - 40) / Math.max(overs.length, 10);
    overs.forEach((o, i) => {
      const bh = (o.runs / max) * (H - 50);
      const x = 30 + i * slot;
      chart.append(
        svgEl('rect', {
          x,
          y: H - 30 - bh,
          width: Math.max(4, slot - 6),
          height: Math.max(1, bh),
          class: 'cd-rect',
          'data-over': o.over,
        }),
        svgEl(
          'text',
          { x: x + (slot - 6) / 2, y: H - 12, class: 'cd-axis', 'text-anchor': 'middle' },
          String(o.over),
        ),
        svgEl(
          'text',
          { x: x + (slot - 6) / 2, y: H - 34 - bh, class: 'cd-value', 'text-anchor': 'middle' },
          String(o.runs),
        ),
      );
      for (let w = 0; w < o.wkts; w++) {
        chart.append(
          svgEl('circle', {
            cx: x + (slot - 6) / 2,
            cy: H - 30 - bh - 22 - w * 12,
            r: 5,
            class: 'cd-wicket',
          }),
        );
      }
    });
    return [chart];
  },
};

const worm: CardDef = {
  id: 'worm',
  title: 'Worm',
  needsHistory: true,
  render(s, ctx) {
    const innings = ctx.history?.innings.filter((i) => i.cumulative.length > 0) ?? [];
    if (innings.length === 0) return empty('The worm needs at least one completed over.');
    const maxOvers = Math.max(s.oversLimit ?? 0, ...innings.map((i) => i.cumulative.length));
    const maxRuns = Math.max(10, ...innings.map((i) => i.cumulative.at(-1) ?? 0));
    const chart = svg(W, H);
    chart.classList.add('cd-chart');
    chart.append(
      svgEl('line', { x1: 30, y1: H - 24, x2: W - 10, y2: H - 24, class: 'cd-axisline' }),
    );
    innings.forEach((inn, idx) => {
      const pts = [[0, 0], ...inn.cumulative.map((r, i) => [i + 1, r] as const)];
      const d = pts
        .map(([o, r], i) => {
          const x = 30 + (o! / maxOvers) * (W - 50);
          const y = H - 24 - (r! / maxRuns) * (H - 44);
          return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
        })
        .join(' ');
      chart.append(svgEl('path', { d, class: `cd-line cd-line-${idx % 2}`, fill: 'none' }));
    });
    const legend = row(
      ...innings.map((inn, i) => {
        const team = s.teams.find((t) => t.id === inn.battingTeamId);
        return el(
          'span',
          `cd-legend cd-legend-${i % 2}`,
          `${team?.short ?? '?'} ${inn.cumulative.at(-1) ?? 0}`,
        );
      }),
    );
    return [chart, legend];
  },
};

const winProbability: CardDef = {
  id: 'win-probability',
  title: 'Win probability',
  render(s) {
    if (!s.winProb) return empty('No win-probability estimate for this format.');
    const a = Math.round(s.winProb.teamA * 100);
    const bar = el('div', 'cd-bar');
    const fill = el('div', 'cd-bar-fill');
    fill.style.width = `${a}%`;
    bar.append(fill);
    return [
      row(
        stat(`${a}%`, s.teams[0].name.toUpperCase()),
        stat(`${100 - a}%`, s.teams[1].name.toUpperCase()),
      ),
      bar,
      note('Estimate based on the score, balls left and wickets in hand'),
    ];
  },
};

const fallOfWickets: CardDef = {
  id: 'fall-of-wickets',
  title: 'Fall of wickets',
  needsHistory: true,
  render(s, ctx) {
    const h = currentHistory(s, ctx);
    if (!h || h.fow.length === 0) return empty('No wickets have fallen.');
    const list = el('ol', 'cd-fow');
    for (const f of h.fow) {
      const li = el('li', '', `${f.runs}-${f.wkts}`);
      li.append(el('span', 'cd-fow-sub', `${f.out ? `${f.out}, ` : ''}${f.overs}.${f.balls} ov`));
      list.append(li);
    }
    return [list];
  },
};

/* Presentation ------------------------------------------------------------------------------ */

const milestone: CardDef = {
  id: 'milestone',
  title: 'Milestone',
  render(s) {
    const best = [...s.batters].sort((a, b) => b.runs - a.runs)[0];
    if (best && best.runs >= 50 && !placeholder(best.name)) {
      const hundred = best.runs >= 100;
      return [
        el('h3', 'cd-big-name', best.name),
        row(
          stat(`${best.runs}`, hundred ? 'HUNDRED' : 'FIFTY', 'cd-big'),
          stat(`${best.balls}`, 'BALLS'),
          stat(per(best.runs, best.balls, 100, 1), 'STRIKE RATE'),
        ),
      ];
    }
    return [row(stat(`${s.score.runs}`, `${battingTeam(s).name.toUpperCase()} TOTAL`, 'cd-big'))];
  },
};

const toss: CardDef = {
  id: 'toss',
  title: 'Toss',
  render(s) {
    if (!s.toss) return empty('The toss result is not available.');
    const winner = s.teams.find((t) => t.id === s.toss!.winnerTeamId);
    return [
      el('h3', 'cd-big-name', winner?.name ?? 'Toss'),
      note(`won the toss and chose to ${s.toss.decision}`),
      ...(s.venue ? [note(s.venue)] : []),
    ];
  },
};

const postMatch: CardDef = {
  id: 'post-match',
  title: 'Result',
  render(s) {
    const out: HTMLElement[] = [
      el('h3', 'cd-big-name', s.status === 'result' && s.result ? s.result : 'Match in progress'),
    ];
    const top = [...s.batters].sort((a, b) => b.runs - a.runs)[0];
    if (top && !placeholder(top.name)) {
      out.push(
        row(
          stat(`${top.runs}`, top.name.toUpperCase()),
          stat(`${s.bowler.wkts}-${s.bowler.runs}`, s.bowler.name.toUpperCase()),
        ),
      );
    }
    return out;
  },
};

const fullScorecard: CardDef = {
  id: 'full-scorecard',
  title: 'Scorecard',
  render(s) {
    const t = el('table', 'cd-table');
    const head = el('tr');
    for (const h of ['Innings', 'Score', 'Overs']) head.append(el('th', '', h));
    t.append(head);
    const innings = s.innings.length > 0 ? s.innings : [];
    for (const inn of innings) {
      const team = s.teams.find((x) => x.id === inn.battingTeamId);
      const r = el('tr');
      r.append(
        el('td', '', team?.name ?? '?'),
        el('td', '', `${inn.score.runs}-${inn.score.wkts}`),
        el('td', '', `${inn.score.overs}.${inn.score.balls}`),
      );
      t.append(r);
    }
    const out: HTMLElement[] = [t];
    const batters = s.batters.filter((b) => !placeholder(b.name));
    if (batters.length > 0) {
      out.push(
        row(
          ...batters.map((b) =>
            el('span', 'cd-name', `${b.name}${b.onStrike ? '*' : ''} ${b.runs} (${b.balls})`),
          ),
        ),
      );
    }
    if (!placeholder(s.bowler.name)) {
      out.push(
        note(
          `${s.bowler.name} ${s.bowler.wkts}-${s.bowler.runs} (${s.bowler.overs}.${s.bowler.balls})`,
        ),
      );
    }
    out.push(note(`${bowlingTeam(s).name} bowling`));
    return out;
  },
};

/* Wagon wheel: needs shot direction, which none of our sources provide yet ------------------ */

const wagonWheel: CardDef = {
  id: 'wagon-wheel',
  title: 'Wagon wheel',
  render(s) {
    const size = 260;
    const c = size / 2;
    const chart = svg(size, size);
    chart.classList.add('cd-wheel');
    for (let i = 0; i < 8; i++) {
      const a0 = (i / 8) * Math.PI * 2 - Math.PI / 2;
      const a1 = ((i + 1) / 8) * Math.PI * 2 - Math.PI / 2;
      const r = c - 8;
      const p = (a: number) =>
        `${(c + r * Math.cos(a)).toFixed(1)} ${(c + r * Math.sin(a)).toFixed(1)}`;
      chart.append(
        svgEl('path', {
          d: `M${c} ${c} L${p(a0)} A${r} ${r} 0 0 1 ${p(a1)} Z`,
          class: 'cd-sector',
          'data-sector': i,
        }),
      );
    }
    const b = s.boundaries;
    return [
      chart,
      note('Shot direction is not available from the current data source.'),
      ...(b ? [row(stat(`${b.fours}`, 'FOURS'), stat(`${b.sixes}`, 'SIXES'))] : []),
    ];
  },
};

export const CARD_DEFS: readonly CardDef[] = [
  strikerProfile,
  bowlerSpell,
  strikerVsBowler,
  partnership,
  chaseGauge,
  matchSituation,
  powerplay,
  manhattan,
  worm,
  winProbability,
  fallOfWickets,
  milestone,
  toss,
  postMatch,
  fullScorecard,
  wagonWheel,
];

export const getCardDef = (id: string): CardDef | undefined => CARD_DEFS.find((c) => c.id === id);
