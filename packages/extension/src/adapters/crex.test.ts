// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { FIXTURES_DIR, runFixture } from '../testing/harness';
import { createCrexAdapter, crexConfig } from './crex';

const STATES = ['pre-match', 'live-t20', 'live-test', 'innings-break', 'result'];
const have = (state: string) =>
  fs.existsSync(path.join(FIXTURES_DIR, 'crex', `${state}.html`)) &&
  fs.existsSync(path.join(FIXTURES_DIR, 'crex', `${state}.expected.json`));

describe('crex adapter against saved fixtures', () => {
  it('bundled config is valid', () => {
    expect(crexConfig.site).toBe('crex');
  });

  for (const state of STATES) {
    it.skipIf(!have(state))(`${state}`, () => {
      const { actual, expected } = runFixture(createCrexAdapter().adapter, 'crex', state);
      expect(actual).toEqual(expected);
    });
  }
});

describe('crex live getSV3 response', () => {
  it('normalises a real First Class score with mapped names and pictures', () => {
    const url = 'https://crex.com/cricket-live-score/ind-a-vs-nz-a-1st-first-class-india-a-tour-of-new-zealand-2026-match-updates-13QQ';
    const dom = new JSDOM('<meta name="description" content="Track New Zealand A vs India A 1st-TEST India A tour of New Zealand 2026 match live score and updates from Bert Sutcliffe Oval with ball by ball commentary at CREX.">', { url });
    const values = {
      t_M1_name: 'New Zealand A', t_M1_short: 'NZ-A',
      t_6S_name: 'India A', t_6S_short: 'IND-A',
      p_EI_name: 'Devdutt Padikkal', p_6M2_name: 'B Sai Sudharsan',
      p_14N_name: 'Simon Keene',
    };
    for (const [key, value] of Object.entries(values)) dom.window.localStorage.setItem(key, value);
    const response = {
      A: '0', B: '0', J: '81/2(26.1', a: 'M1.6S', b: '14N', c: '19.48.1.41',
      fo: 'First Class', h: '1', i: '18/2.2.2', j: '113/10(39.3', k: '317/10(89.3',
      l: '25:0.0.0.0.wd.2.1', m: '26:4.0.0.0.0.1', n: '24:0.0.0.0.4.0',
      p: 'EI.6M2', q: '41.58', r: '7.0.3.41', s: '29.76*', t: '4.0.4.29',
      w: '3/3/41/0/0/0/0', x: 'AK.4.15.10.28.0.6', y: '14N.48.19.1', z: '4WG.42.20.1',
      rb: [
        { o: 24, b: [{ u: '0' }, { u: '0' }, { u: '0' }, { u: '0' }, { u: '4' }, { u: '0' }] },
        { o: 25, b: [{ u: '0' }, { u: '0' }, { u: '0' }, { u: '0' }, { u: 'wd' }, { u: '2' }, { u: '1' }] },
        { o: 26, b: [{ u: '4' }, { u: '0' }, { u: '0' }, { u: '0' }, { u: '0' }, { u: '1' }] },
        { o: 27, b: [{ u: '0' }] },
      ],
    };
    const update = createCrexAdapter().adapter({
      site: 'crex', url, document: dom.window.document, now: 1_700_000_000_000,
      taps: [{ url: 'https://api.goscorer.com/api/v3/getSV3?key=13QQ', json: response }],
    });

    expect(update).toMatchObject({
      source: 'crex', matchId: '13QQ', confidence: 1,
      fields: {
        title: 'New Zealand A vs India A', status: 'Live', venue: 'Bert Sutcliffe Oval',
        format: 'TEST', day: 2,
        teams: [
          { name: 'New Zealand A', short: 'NZ-A', logoUrl: 'https://cricketvectors.akamaized.net/Teams/M1.png' },
          { name: 'India A', short: 'IND-A', logoUrl: 'https://cricketvectors.akamaized.net/Teams/6S.png' },
        ],
        innings: [
          { team: 'India A', runs: 113, wkts: 10, overs: 39, balls: 3 },
          { team: 'New Zealand A', runs: 317, wkts: 10, overs: 89, balls: 3 },
          { team: 'India A', runs: 81, wkts: 2, overs: 26, balls: 1 },
        ],
        batters: [
          { name: 'Devdutt Padikkal', runs: 41, balls: 58, fours: 7, sixes: 0, imageUrl: 'https://cricketvectors.akamaized.net/players/org/EI.png' },
          { name: 'B Sai Sudharsan', runs: 29, balls: 76, fours: 4, sixes: 0, onStrike: true, imageUrl: 'https://cricketvectors.akamaized.net/players/org/6M2.png' },
        ],
        bowler: { name: 'Simon Keene', overs: 8, balls: 0, runs: 19, wkts: 1, imageUrl: 'https://cricketvectors.akamaized.net/players/org/14N.png' },
        partnership: { runs: 71, balls: 129 }, crr: 3.1,
        thisOver: ['0'],
        lastBalls: ['0', '0', 'wd', '2', '1', '4', '0', '0', '0', '0', '1', '0'],
      },
    });
  });

  it('uses the canonical match id on a live sub-page', () => {
    const url = 'https://crex.com/cricket-live-score/den-vs-png-37th-list-a-mens-cwc-challenge-league-a-2024-26-match-updates-14V2-scorecard';
    const dom = new JSDOM('<meta name="description" content="Track Denmark vs Papua New Guinea 37th-Match match live score at CREX.">', { url });
    for (const [key, value] of Object.entries({
      t_IO_name: 'Denmark', t_IO_short: 'DEN',
      t_8X_name: 'Papua New Guinea', t_8X_short: 'PNG',
      p_9J2_name: 'Musa Mahmood', p_AUZ_name: 'Hamid Shah', p_1V5_name: 'Kabua Morea',
    })) dom.window.localStorage.setItem(key, value);
    const update = createCrexAdapter().adapter({
      site: 'crex', url, document: dom.window.document, now: 1,
      taps: [{
        url: 'https://api.goscorer.com/api/v3/getSV3?key=14V2',
        json: {
          a: 'IO.8X', b: '1V5', c: '4.9.0.7', i: '5/0.4*.1', j: '9/0(2.3',
          p: '9J2.AUZ', q: '3.8', r: '0.0.1.3', s: '0.7*', t: '0.0.2.0',
          wp: 'IO,6460,15401,0',
        },
      }],
    });

    expect(update.matchId).toBe('14V2');
    expect(update.fields.teams?.map((team) => team.name)).toEqual(['Denmark', 'Papua New Guinea']);
    expect(update.fields.innings).toEqual([{ team: 'Denmark', runs: 9, wkts: 0, overs: 2, balls: 3 }]);
    expect(update.fields.batters?.map((batter) => batter.name)).toEqual(['Musa Mahmood', 'Hamid Shah']);
    expect(update.fields.winProb).toEqual({ teamA: 0.646, teamB: 0.354 });
  });

  it('does not apply a tapped response from another match', () => {
    const url = 'https://crex.com/cricket-live-score/example-match-13QQ';
    const dom = new JSDOM('', { url });
    const update = createCrexAdapter().adapter({
      site: 'crex', url, document: dom.window.document, now: 1,
      taps: [{ url: 'https://api.goscorer.com/api/v3/getSV3?key=other', json: { i: '0/0.1.1' } }],
    });
    expect(update.confidence).toBe(0);
    expect(update.fields.innings).toEqual([]);
  });
});
