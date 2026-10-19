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
});
