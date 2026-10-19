// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
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
