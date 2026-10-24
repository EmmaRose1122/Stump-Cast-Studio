import { describe, expect, it } from 'vitest';
import { hasPlayerImage, rosterFromTeam } from './lib/squadRoster';

const demo = [
  { name: 'Tom Latham', role: 'Batter' },
  { name: 'Kane Williamson', role: 'Batter' },
];

describe('squad roster source', () => {
  it('shows the announced line-up, with roles, markers and the photo the site published', () => {
    const roster = rosterFromTeam(
      {
        squad: [
          {
            name: 'Finn Allen',
            role: 'Batter',
            captain: false,
            keeper: false,
            imageUrl: 'https://static.cricbuzz.com/a/img/v1/i1/c845498/finn-allen.jpg',
          },
          { name: 'Tim Seifert', role: 'WK-Batter', keeper: true },
          { name: 'Mitchell Santner', role: 'Bowling Allrounder', captain: true },
        ],
      },
      undefined,
      demo,
    );

    expect(roster.source).toBe('squad');
    expect(roster.players.map((p) => p.name)).toEqual(['Finn Allen', 'Tim Seifert', 'Mitchell Santner']);
    expect(roster.players[0]?.imageUrl).toBe(
      'https://static.cricbuzz.com/a/img/v1/i1/c845498/finn-allen.jpg',
    );
    expect(roster.players[1]?.tag).toBe('WK');
    expect(roster.players[2]?.tag).toBe('C');
  });

  it('never falls back to another tour\'s eleven when the match carries a squad', () => {
    // Regression: a NZ v IND series rendered a hard-coded XI from a different tour.
    const roster = rosterFromTeam({ squad: [{ name: 'Bevon Jacobs', role: 'Batter' }] }, undefined, demo);
    expect(roster.players.map((p) => p.name)).toEqual(['Bevon Jacobs']);
    expect(roster.players.some((p) => p.name === 'Tom Latham')).toBe(false);
  });

  it('lets an operator upload override the scraped line-up', () => {
    const uploaded = [{ name: 'Custom Player', role: 'Batter' }];
    const roster = rosterFromTeam({ squad: [{ name: 'Finn Allen', role: 'Batter' }] }, uploaded, demo);
    expect(roster.source).toBe('uploaded');
    expect(roster.players).toEqual(uploaded);
  });

  it('uses bare player names when the source has no squad detail', () => {
    const roster = rosterFromTeam({ players: ['Finn Allen', 'Tim Seifert'] }, undefined, demo);
    expect(roster.source).toBe('players');
    expect(roster.players).toEqual([
      { name: 'Finn Allen', role: 'Player' },
      { name: 'Tim Seifert', role: 'Player' },
    ]);
  });

  it('marks the built-in eleven as demo, never as live data', () => {
    expect(rosterFromTeam(undefined, undefined, demo).source).toBe('demo');
    expect(rosterFromTeam({ squad: [] }, undefined, demo).source).toBe('demo');
    expect(rosterFromTeam({}, undefined, undefined).source).toBe('empty');
  });
});

describe('squad photo readiness', () => {
  it('counts a published photo as ready even with no saved asset', () => {
    const noLocal = () => false;
    expect(
      hasPlayerImage({ name: 'Finn Allen', role: 'Batter', imageUrl: 'https://x/finn.jpg' }, noLocal),
    ).toBe(true);
  });

  it('counts a saved asset as ready', () => {
    expect(hasPlayerImage({ name: 'Finn Allen', role: 'Batter' }, (n) => n === 'Finn Allen')).toBe(true);
  });

  it('is not ready when there is neither a photo nor an asset', () => {
    expect(hasPlayerImage({ name: 'Finn Allen', role: 'Batter' }, () => false)).toBe(false);
  });
});
