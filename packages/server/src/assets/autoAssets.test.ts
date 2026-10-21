import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RawUpdateSchema, type MatchState, type RawUpdate } from '@stumpcast/shared';
import { openDatabase } from '../db';
import { AssetService } from './AssetService';
import { AutoAssets } from './AutoAssets';

// Windows keeps files open that sharp has read by path; the tests read buffers instead.
sharp.cache(false);

/** A real image: `trim()` rejects a solid 1×1, and the service trims every crest. */
const PNG = await sharp({
  create: { width: 300, height: 300, channels: 3, background: { r: 200, g: 40, b: 40 } },
})
  .png()
  .toBuffer();

const CREX = 'https://cricketvectors.akamaized.net/Teams/Y.png';

const rawWith = (fields: Partial<RawUpdate['fields']>): RawUpdate =>
  RawUpdateSchema.parse({
    source: 'crex',
    matchId: 'm1',
    url: 'https://crex.com/x',
    capturedAt: 1,
    confidence: 1,
    fields,
    missing: [],
  });

const batter = (name: string, playerId = `p-${name.toLowerCase().replace(/\W+/g, '-')}`)
  : MatchState['batters'][number] =>
  ({ playerId, name, runs: 0, balls: 0, fours: 0, sixes: 0, onStrike: false }) as MatchState['batters'][number];

/** Only the pieces AutoAssets reads; the rest of the state is irrelevant to it. */
const stateWith = (
  teams: Array<Partial<MatchState['teams'][number]>>,
  batters: MatchState['batters'][number][] = [],
): MatchState =>
  ({
    teams,
    batters: [batters[0] ?? batter('—'), batters[1] ?? batter('—')],
    bowler: undefined,
  }) as unknown as MatchState;

describe('AutoAssets', () => {
  let dir: string;
  let close: () => void;
  let db: ReturnType<typeof openDatabase>['db'];
  let asked: string[];

  const makeAssets = () => {
    asked = [];
    return new AssetService(db, dir, async (url) => {
      asked.push(url);
      return { buffer: PNG, contentType: 'image/png' };
    });
  };

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stumpcast-auto-'));
    const opened = openDatabase(dir);
    db = opened.db;
    // Windows refuses to delete a directory while the sqlite handle is open.
    close = () => opened.sqlite.close();
  });
  afterEach(() => {
    close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('stores the crest a new team was first seen with, under the id the overlay asks for', async () => {
    const assets = makeAssets();
    const added: string[] = [];
    const auto = new AutoAssets(assets, { enabled: () => true, onAdded: (_k, id) => added.push(id) });

    auto.consider(
      rawWith({ teams: [{ name: 'Afghanistan', logoUrl: CREX }] }),
      stateWith([{ name: 'Afghanistan', short: 'AFG' }]),
    );
    await auto.idle();

    expect(asked).toEqual([CREX]);
    expect(added).toEqual(['team-afg']);
    expect(assets.has('team-afg')).toBe(true);
    expect(auto.added).toBe(1);
  });

  it('never asks twice for the same team, and leaves an existing crest alone', async () => {
    const assets = makeAssets();
    const auto = new AutoAssets(assets, { enabled: () => true });

    const raw = rawWith({ teams: [{ name: 'Afghanistan', logoUrl: CREX }] });
    const state = stateWith([{ name: 'Afghanistan', short: 'AFG' }]);
    auto.consider(raw, state);
    await auto.idle();
    auto.consider(raw, state);
    await auto.idle();
    expect(asked).toHaveLength(1);

    // A second studio run must not re-download what the library already holds.
    const again = new AutoAssets(assets, { enabled: () => true });
    again.consider(raw, state);
    await again.idle();
    expect(asked).toHaveLength(1);
  });

  it('ignores a picture from a host the score sites do not use', async () => {
    const assets = makeAssets();
    const auto = new AutoAssets(assets, { enabled: () => true });
    auto.consider(
      rawWith({ teams: [{ name: 'Nowhere', logoUrl: 'https://evil.internal/crest.png' }] }),
      stateWith([{ name: 'Nowhere', short: 'NOW' }]),
    );
    await auto.idle();
    expect(asked).toEqual([]);
    expect(assets.has('team-now')).toBe(false);
  });

  it('takes a batter photo from the same page, keyed by the player name', async () => {
    const assets = makeAssets();
    const auto = new AutoAssets(assets, { enabled: () => true });
    const url = 'https://cricketvectors.akamaized.net/cFancode/4249696.png';
    auto.consider(
      rawWith({ batters: [{ name: 'Rahman Uddin', runs: 40, balls: 30, imageUrl: url }] }),
      stateWith([], [{ playerId: 'p-1', name: 'Rahman Uddin' } as MatchState['batters'][number]]),
    );
    await auto.idle();
    expect(asked).toEqual([url]);
    expect(assets.has('rahman-uddin')).toBe(true);
  });

  it('does nothing when the operator switched auto-fetch off', async () => {
    const assets = makeAssets();
    const auto = new AutoAssets(assets, { enabled: () => false });
    auto.consider(
      rawWith({ teams: [{ name: 'Afghanistan', logoUrl: CREX }] }),
      stateWith([{ name: 'Afghanistan', short: 'AFG' }]),
    );
    await auto.idle();
    expect(asked).toEqual([]);
  });

  it('a failed download is reported once and never breaks the score path', async () => {
    const failing = new AssetService(db, dir, async () => {
      throw new Error('404 from the CDN');
    });
    const errors: string[] = [];
    const auto = new AutoAssets(failing, { enabled: () => true, onError: (id) => errors.push(id) });
    auto.consider(
      rawWith({ teams: [{ name: 'Afghanistan', logoUrl: CREX }] }),
      stateWith([{ name: 'Afghanistan', short: 'AFG' }]),
    );
    await expect(auto.idle()).resolves.toBeUndefined();
    expect(errors).toEqual(['team-afg']);
  });
});
