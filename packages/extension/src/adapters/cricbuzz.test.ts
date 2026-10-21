// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { FIXTURES_DIR, runFixture } from '../testing/harness';
import { createCricbuzzAdapter, cricbuzzConfig } from './cricbuzz';

const STATES = ['pre-match', 'live-t20', 'live-test', 'innings-break', 'result'];
const have = (state: string) =>
  fs.existsSync(path.join(FIXTURES_DIR, 'cricbuzz', `${state}.html`)) &&
  fs.existsSync(path.join(FIXTURES_DIR, 'cricbuzz', `${state}.expected.json`));

describe('cricbuzz adapter against saved fixtures', () => {
  it('bundled config is valid', () => {
    expect(cricbuzzConfig.site).toBe('cricbuzz');
  });

  for (const state of STATES) {
    // Skipped (not failed) until the developer saves the real page; see fixtures/README.md.
    it.skipIf(!have(state))(`${state}`, () => {
      const { actual, expected } = runFixture(createCricbuzzAdapter().adapter, 'cricbuzz', state);
      expect(actual).toEqual(expected);
    });
  }

  // Answer-key guards: the shapes below once passed while carrying scraped garbage.
  describe('answer keys stay plausible', () => {
    for (const state of STATES) {
      it.skipIf(!have(state))(`${state} keeps teams, rates and ball strips honest`, () => {
        const { expected } = runFixture(createCricbuzzAdapter().adapter, 'cricbuzz', state);
        const f = expected.fields;
        for (const inn of f.innings) {
          expect(inn.team).not.toMatch(/^\(?\d{1,4}[-/]\d{1,2}\)?$/);
          expect(inn.team).not.toMatch(/^(?:GMT|LOCAL|Batter)/i);
        }
        for (const t of f.teams) expect(t.name).not.toMatch(/\d+[-/]\d+/);
        if (f.crr !== undefined) {
          expect(f.crr).toBeGreaterThanOrEqual(0);
          expect(f.crr).toBeLessThanOrEqual(20);
        }
        if (f.toss !== undefined) expect(f.toss).toMatch(/won the toss|opt to|elected to/i);
      });
    }
  });

  it('correctly extracts full title, teams, and scores from real Cricbuzz pages', async () => {
    const { JSDOM } = await import('jsdom');
    const nepPath = path.join(FIXTURES_DIR, 'cricbuzz', 'nep-vs-oman.html');
    if (fs.existsSync(nepPath)) {
      const dom = new JSDOM(fs.readFileSync(nepPath, 'utf8'));
      const res = createCricbuzzAdapter().adapter({
        site: 'cricbuzz',
        url: 'https://www.cricbuzz.com/live-cricket-scores/169960/nep-vs-oman-139th-match',
        document: dom.window.document,
        taps: [],
        now: Date.now(),
      });
      expect(res.confidence).toBeGreaterThanOrEqual(0.5);
      expect(res.fields.title).toContain('Oman vs Nepal');
      expect(res.fields.teams.map((t) => t.name)).toEqual(['Oman', 'Nepal']);
      expect(res.fields.innings[0]?.team).toBe('Nepal');
    }

    const ranjiPath = path.join(FIXTURES_DIR, 'cricbuzz', 'ranji-live.html');
    if (fs.existsSync(ranjiPath)) {
      const dom = new JSDOM(fs.readFileSync(ranjiPath, 'utf8'));
      const res = createCricbuzzAdapter().adapter({
        site: 'cricbuzz',
        url: 'https://www.cricbuzz.com/live-cricket-scores/163643/jk-vs-vid-elite-group-a',
        document: dom.window.document,
        taps: [],
        now: Date.now(),
      });
      expect(res.confidence).toBeGreaterThanOrEqual(0.5);
      expect(res.fields.title).toContain('Jammu and Kashmir vs Vidarbha');
      expect(res.fields.teams.map((t) => t.name)).toEqual(['JK', 'VID']);
      expect(res.fields.batters.length).toBe(2);
      expect(res.fields.bowler).toBeDefined();
    }
  });
});

/** Trimmed copies of what cricbuzz actually served for match 170723 on 2026-10-20. */
const LIVESCORE = {
  miniscore: {
    inningsId: 2,
    batTeam: { teamId: 9, teamScore: 197, teamWkts: 6 },
    status: 'England need 106 runs in 90 balls',
    batsmanStriker: { id: 12258, name: 'Will Jacks', runs: 10, balls: 13, fours: 0, sixes: 1 },
    batsmanNonStriker: { id: 8512, name: 'Jamie Overton', runs: 0, balls: 1, fours: 0, sixes: 0 },
    bowlerStriker: { id: 14561, name: 'Haris Rauf', overs: 6, maidens: 0, runs: 32, wickets: 2 },
    bowlerNonStriker: { id: 41148, name: 'Arafat Minhas', overs: 7, maidens: 0, runs: 33, wickets: 3 },
    overs: 35,
    target: 303,
    partnerShip: { balls: 1, runs: 0 },
    currentRunRate: 5.63,
    requiredRunRate: 7.07,
    batTeamScoreObj: { teamName: 'ENG' },
    bowlTeamScoreObj: { teamName: 'PAK' },
    recentOvsStats: '1 6 1 1 W 0',
    matchScoreDetails: {
      matchFormat: 'ODI',
      inningsScoreList: [
        { inningsId: 1, batTeamName: 'PAK', score: 302, wickets: 9, overs: 50 },
        { inningsId: 2, batTeamName: 'ENG', score: 197, wickets: 6, overs: 35 },
      ],
    },
  },
};
const COMMENTARY = {
  matchHeader: {
    matchDescription: '2nd Match',
    matchFormat: 'ODI',
    seriesDesc: 'Pakistan ODI Tri-Series, 2026',
    status: 'England need 106 runs in 90 balls',
    team1: { id: 3, name: 'Pakistan', shortName: 'PAK' },
    team2: { id: 9, name: 'England', shortName: 'ENG' },
    tossResults: { tossWinnerName: 'England', decision: 'Bowling' },
  },
};

describe('cricbuzz taps read the payloads the site really serves', () => {
  const read = (taps: { url: string; json: unknown }[]) =>
    createCricbuzzAdapter().adapter({
      site: 'cricbuzz',
      url: 'https://www.cricbuzz.com/live-cricket-scores/170723',
      document: new JSDOM('<html><head><title>2nd Match</title></head><body></body></html>')
        .window.document,
      taps,
      now: 1_792_508_415_000,
    });

  it('reads the whole live innings from the polled livescore response', () => {
    const u = read([
      { url: 'https://www.cricbuzz.com/api/mcenter/livescore/170723', json: LIVESCORE },
      { url: 'https://www.cricbuzz.com/api/mcenter/comm/170723', json: COMMENTARY },
    ]);
    expect(u.matchId).toBe('170723');
    expect(u.confidence).toBe(1);
    expect(u.missing).toEqual([]);
    const f = u.fields;
    expect(f.title).toBe('Pakistan vs England, 2nd Match, Pakistan ODI Tri-Series, 2026');
    expect(f.teams.map((t) => t.name)).toEqual(['Pakistan', 'England']);
    expect(f.innings).toEqual([
      { team: 'PAK', runs: 302, wkts: 9, overs: 50, balls: 0 },
      { team: 'ENG', runs: 197, wkts: 6, overs: 35, balls: 0 },
    ]);
    expect(f.batters).toEqual([
      { name: 'Will Jacks', runs: 10, balls: 13, fours: 0, sixes: 1, onStrike: true },
      { name: 'Jamie Overton', runs: 0, balls: 1, fours: 0, sixes: 0 },
    ]);
    expect(f.bowler).toEqual({ name: 'Haris Rauf', overs: 6, balls: 0, maidens: 0, runs: 32, wkts: 2 });
    expect(f.thisOver).toEqual(['1', '6', '1', '1', 'W', '0']);
    expect(f).toMatchObject({ target: 303, crr: 5.63, rrr: 7.07, format: 'ODI', partnership: { runs: 0, balls: 1 } });
    expect(f.preMatch).toBeUndefined();
    expect(f.toss).toBe('England won the toss and chose to Bowling');
  });

  it('reads the innings it can from the livescore poll alone', () => {
    const u = read([
      { url: 'https://www.cricbuzz.com/api/mcenter/livescore/170723', json: LIVESCORE },
    ]);
    expect(u.confidence).toBe(1);
    expect(u.fields.innings.map((i) => `${i.team} ${i.runs}/${i.wkts}`)).toEqual([
      'PAK 302/9',
      'ENG 197/6',
    ]);
  });
});

