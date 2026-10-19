import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { RawUpdateSchema, type RawUpdate, type SourceSite } from '@stumpcast/shared';
import type { Adapter, TapResponse } from '../adapter';

/** Repo-root fixtures folder. */
export const FIXTURES_DIR = path.resolve(import.meta.dirname, '..', '..', '..', '..', 'fixtures');

/** Fixed capture time so `.expected.json` files stay stable. */
export const FIXTURE_NOW = 1_700_000_000_000;

export interface LoadedFixture {
  site: string;
  state: string;
  url: string;
  document: Document;
  taps: TapResponse[];
  expected: unknown;
}

const read = (file: string) => fs.readFileSync(file, 'utf8');

/**
 * Layout (all in fixtures/<site>/):
 *   <state>.html            saved page (required)
 *   <state>.expected.json   expected RawUpdate (required)
 *   <state>.taps.json       optional: [{ "url": "...", "file": "<state>.tap1.json" }]
 *   <state>.url.txt         optional: original page URL (first line)
 */
export const loadFixture = (site: string, state: string, root = FIXTURES_DIR): LoadedFixture => {
  const base = path.join(root, site, state);
  const htmlFile = `${base}.html`;
  const expectedFile = `${base}.expected.json`;
  if (!fs.existsSync(htmlFile)) throw new Error(`Missing fixture page: ${htmlFile}`);
  if (!fs.existsSync(expectedFile)) throw new Error(`Missing expected output: ${expectedFile}`);

  const urlFile = `${base}.url.txt`;
  const url = fs.existsSync(urlFile)
    ? read(urlFile).split(/\r?\n/)[0]!.trim()
    : `https://example.invalid/${site}/${state}`;

  const taps: TapResponse[] = [];
  const tapsFile = `${base}.taps.json`;
  if (fs.existsSync(tapsFile)) {
    const manifest = JSON.parse(read(tapsFile)) as { url: string; file: string }[];
    for (const t of manifest) {
      taps.push({ url: t.url, json: JSON.parse(read(path.join(root, site, t.file))) });
    }
  }

  const document = new JSDOM(read(htmlFile), { url }).window.document;
  return { site, state, url, document, taps, expected: JSON.parse(read(expectedFile)) };
};

/** Load a fixture, run an adapter over it and return both sides for assertion. */
export const runFixture = (
  adapter: Adapter,
  site: SourceSite,
  state: string,
  opts: { root?: string; folder?: string } = {},
): { actual: RawUpdate; expected: RawUpdate } => {
  const fx = loadFixture(opts.folder ?? site, state, opts.root ?? FIXTURES_DIR);
  const actual = RawUpdateSchema.parse(
    JSON.parse(
      JSON.stringify(
        adapter({ site, url: fx.url, document: fx.document, taps: fx.taps, now: FIXTURE_NOW }),
      ),
    ),
  );
  const expected = RawUpdateSchema.parse(fx.expected);
  return { actual, expected };
};
