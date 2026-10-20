import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { createCricbuzzAdapter } from './cricbuzz';

describe('modern and legacy Cricbuzz compatibility', () => {
  it('extracts correctly from both modern live cricbuzz and legacy fixture', () => {
    const root = path.resolve(import.meta.dirname, '../../../..');
    const modernHtml = fs.readFileSync(path.join(root, 'fixtures/cricbuzz/modern-live.html'), 'utf8');
    const modernDom = new JSDOM(modernHtml);
    const adapterHandle = createCricbuzzAdapter();
    const modernResult = adapterHandle.adapter({
      site: 'cricbuzz',
      url: 'https://www.cricbuzz.com/live-cricket-scores/170720/pak-vs-sl-1st-match-pakistan-odi-tri-series-2026',
      document: modernDom.window.document,
      taps: [],
      now: Date.now(),
    });

    expect(modernResult.confidence).toBe(1);
    expect(modernResult.fields.innings[0]).toEqual({
      team: 'PAK',
      runs: 213,
      wkts: 4,
      overs: 37,
      balls: 0,
    });
    expect(modernResult.fields.batters.length).toBe(2);
    expect(modernResult.fields.batters[0]?.name).toBe('Salman Agha');
    expect(modernResult.fields.batters[0]?.runs).toBe(57);
    expect(modernResult.fields.batters[0]?.balls).toBe(52);
    expect(modernResult.fields.batters[0]?.onStrike).toBe(true);
    expect(modernResult.fields.bowler?.name).toBe('Dasun Shanaka');
    expect(modernResult.fields.bowler?.overs).toBe(5);

    // And verify fixture live-t20 STILL EXACTLY MATCHES!
    const fixtureHtml = fs.readFileSync(path.join(root, 'fixtures/cricbuzz/live-t20.html'), 'utf8');
    const fixtureDom = new JSDOM(fixtureHtml);
    const fixtureResult = adapterHandle.adapter({
      site: 'cricbuzz',
      url: 'https://www.cricbuzz.com/live-cricket-scores/1001/ind-vs-pak-live-t20',
      document: fixtureDom.window.document,
      taps: [],
      now: 1700000000000,
    });
    const expectedFixture = JSON.parse(
      fs.readFileSync(path.join(root, 'fixtures/cricbuzz/live-t20.expected.json'), 'utf8')
    );
    expect(fixtureResult).toEqual(expectedFixture);
  });

  it('extracts multi-day domestic Ranji Trophy match 163643 (JK vs VID) and flags the overs it cannot see', () => {
    const root = path.resolve(import.meta.dirname, '../../../..');
    const ranjiHtml = fs.readFileSync(path.join(root, 'fixtures/cricbuzz/ranji-live.html'), 'utf8');
    const ranjiDom = new JSDOM(ranjiHtml);
    const adapterHandle = createCricbuzzAdapter();
    const result = adapterHandle.adapter({
      site: 'cricbuzz',
      url: 'https://www.cricbuzz.com/live-cricket-scores/163643/jk-vs-vid-elite-group-a-ranji-trophy-elite-2026-27',
      document: ranjiDom.window.document,
      taps: [],
      now: Date.now(),
    });

    // JK's overs appear nowhere on this page, so the reading must report that instead of
    // claiming a confident 0.0 ov.
    expect(result.confidence).toBe(0.5);
    expect(result.missing).toEqual(['overs']);
    expect(result.fields.teams.map((t) => t.name)).toEqual(['JK', 'VID']);
    expect(result.fields.innings.length).toBe(2);
    expect(result.fields.innings[0]).toEqual({
      team: 'JK',
      runs: 260,
      wkts: 10,
      overs: 0,
      balls: 0,
    });
    expect(result.fields.innings[1]).toEqual({
      team: 'VID',
      runs: 7,
      wkts: 0,
      overs: 2,
      balls: 3,
    });
    expect(result.fields.batters.length).toBe(2);
    expect(result.fields.batters[0]?.name).toBe('Aman Mokhade');
    expect(result.fields.batters[0]?.runs).toBe(1);
    expect(result.fields.batters[0]?.balls).toBe(8);
    expect(result.fields.batters[0]?.onStrike).toBe(true);
    expect(result.fields.batters[1]?.name).toBe('Ravikumar Samarth');
    expect(result.fields.batters[1]?.runs).toBe(2);
    expect(result.fields.batters[1]?.balls).toBe(7);
    expect(result.fields.bowler?.name).toBe('Umar Nazir Mir');
    expect(result.fields.bowler?.overs).toBe(1);
    expect(result.fields.bowler?.balls).toBe(3);
    expect(result.fields.bowler?.runs).toBe(3);
    expect(result.fields.bowler?.wkts).toBe(0);
  });

  it('extracts pre-match / toss match (NEP vs OMAN 169960)', () => {
    const root = path.resolve(import.meta.dirname, '../../../..');
    const content = fs.readFileSync(path.join(root, 'fixtures/cricbuzz/nep-vs-oman.html'), 'utf8');
    const dom = new JSDOM(content);
    const adapterHandle = createCricbuzzAdapter();
    const result = adapterHandle.adapter({
      site: 'cricbuzz',
      url: 'https://www.cricbuzz.com/live-cricket-scores/169960/nep-vs-oman-139th-match-icc-cricket-world-cup-league-two-2023-27',
      document: dom.window.document,
      taps: [],
      now: Date.now(),
    });

    expect(result.confidence).toBe(1);
    expect(result.missing).toEqual([]);
    expect(result.fields.teams.map((t) => t.name)).toEqual(['Oman', 'Nepal']);
    expect(result.fields.status).toBe('Nepal opt to bat');
    expect(result.fields.innings[0]).toEqual({
      team: 'Nepal',
      runs: 0,
      wkts: 0,
      overs: 0,
      balls: 0,
    });
  });
});

