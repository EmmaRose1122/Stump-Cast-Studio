// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { RawUpdateSchema } from '@stumpcast/shared';
import { loadFixture, runFixture } from './testing/harness';
import { sampleAdapter } from './testing/sample-adapter';

describe('fixture harness', () => {
  it('runs an adapter over the sample fixture and matches expected output', () => {
    const { actual, expected } = runFixture(sampleAdapter, 'cricbuzz', 'live', {
      folder: '_sample',
    });
    expect(actual).toEqual(expected);
  });

  it('expected files validate against RawUpdateSchema', () => {
    const fx = loadFixture('_sample', 'live');
    expect(() => RawUpdateSchema.parse(fx.expected)).not.toThrow();
  });

  it('fails loudly when the expected file is missing', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fx-'));
    fs.mkdirSync(path.join(dir, 'cricbuzz'));
    fs.writeFileSync(path.join(dir, 'cricbuzz', 'live.html'), '<html></html>');
    expect(() => loadFixture('cricbuzz', 'live', dir)).toThrow(/Missing expected output/);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('degrades to confidence 0 when the page has no score markup', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fx-'));
    fs.mkdirSync(path.join(dir, 'crex'));
    fs.writeFileSync(path.join(dir, 'crex', 'live.html'), '<html><body><h1>x</h1></body></html>');
    fs.writeFileSync(path.join(dir, 'crex', 'live.expected.json'), '{}');
    const fx = loadFixture('crex', 'live', dir);
    const out = sampleAdapter({
      site: 'crex',
      url: fx.url,
      document: fx.document,
      taps: [],
      now: 1,
    });
    expect(out.confidence).toBe(0);
    expect(out.missing).toContain('innings');
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
