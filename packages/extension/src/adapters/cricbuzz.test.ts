// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
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

