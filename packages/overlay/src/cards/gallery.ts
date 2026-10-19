import {
  deriveStats,
  fixtures,
  type Look,
  type MatchHistory,
  type MatchState,
} from '@stumpcast/shared';
import { CardView } from './CardManager';
import { CARD_DEFS } from './defs';
import { el } from './dom';

/** Deterministic made-up history so analytic cards have something to draw in the gallery. */
export const sampleHistory = (s: MatchState): MatchHistory => {
  const overs = Math.max(1, s.score.overs);
  let total = 0;
  const cumulative: number[] = [];
  const stats: MatchHistory['innings'][number]['overs'] = [];
  for (let o = 1; o <= overs; o++) {
    const runs = [4, 9, 6, 12, 3, 8, 14, 5, 7, 10, 2, 11][o % 12]!;
    const wkts = o % 5 === 0 ? 1 : 0;
    total += runs;
    cumulative.push(total);
    stats.push({ over: o, runs, wkts, approximate: false });
  }
  const mkInnings = (number: number, battingTeamId: string, scale: number) => ({
    number,
    battingTeamId,
    overs: stats.map((o) => ({ ...o, runs: Math.round(o.runs * scale) })),
    cumulative: cumulative.map((c) => Math.round(c * scale)),
    fow: [
      { wkts: 1, runs: 23, overs: 3, balls: 2, out: 'A Batter' },
      { wkts: 2, runs: 57, overs: 7, balls: 5, out: 'B Batter' },
    ],
  });
  return {
    matchId: s.id,
    innings: [mkInnings(1, s.teams[0].id, 1), mkInnings(s.currentInnings || 2, s.teams[1].id, 0.9)],
  };
};

/**
 * Design-QA page (`?gallery=1`): every card rendered against the T20, Test and result fixtures,
 * including a long name, so overflow and fallbacks are easy to check by eye.
 */
export const mountGallery = (host: HTMLElement, look: Look): void => {
  host.replaceChildren();
  host.style.overflow = 'auto';
  host.classList.add('gallery');

  const longName = 'Abdullah Ahmadzai Khan Mohammadzai';
  const states: { label: string; state: MatchState }[] = [
    { label: 'T20 mid-innings', state: deriveStats(fixtures.t20) },
    { label: 'Test day 4', state: deriveStats(fixtures.test) },
    { label: 'Result', state: deriveStats(fixtures.result) },
    {
      label: 'Long names',
      state: deriveStats({
        ...fixtures.t20,
        batters: [
          { ...fixtures.t20.batters[0], name: longName },
          { ...fixtures.t20.batters[1], name: 'Muhammad Abdul Rahman Siddiqui' },
        ],
        bowler: { ...fixtures.t20.bowler, name: 'Shahzaib Muhammad Hussain Qureshi' },
      }),
    },
  ];

  for (const { label, state } of states) {
    const section = el('section', 'gallery-section');
    section.append(el('h2', 'gallery-title', label));
    const grid = el('div', 'gallery-grid');
    for (const def of CARD_DEFS) {
      const view = new CardView(def);
      view.mount(grid, look);
      view.history = sampleHistory(state);
      view.update(state);
      view.show();
    }
    section.append(grid);
    host.append(section);
  }
};
