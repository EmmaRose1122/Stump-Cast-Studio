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

  it('inspects nep-vs-oman.html and ranji-live.html', async () => {
    const { JSDOM } = await import('jsdom');
    for (const name of ['nep-vs-oman', 'ranji-live']) {
      const p = path.join(FIXTURES_DIR, 'cricbuzz', `${name}.html`);
      if (fs.existsSync(p)) {
        const html = fs.readFileSync(p, 'utf8');
        const dom = new JSDOM(html);
        const actual = createCricbuzzAdapter().adapter({
          site: 'cricbuzz',
          url: 'https://www.cricbuzz.com/live-cricket-scores/169960/nep-vs-oman-139th-match',
          document: dom.window.document,
          taps: [],
          now: Date.now(),
        });
        console.log(`[FIXTURE ${name}]`, {
          confidence: actual.confidence,
          title: actual.fields.title,
          status: actual.fields.status,
          teams: actual.fields.teams,
          innings: actual.fields.innings,
          batters: actual.fields.batters,
          bowler: actual.fields.bowler,
        });
      }
    }
  });
});

