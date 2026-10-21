import { describe, expect, it } from 'vitest';
import { RawUpdateSchema, type RawUpdate } from '@stumpcast/shared';
import { ExtensionProvider } from './provider';

const upd = (fields: Partial<RawUpdate['fields']>, matchId = 'm1'): RawUpdate =>
  RawUpdateSchema.parse({
    source: 'cricbuzz',
    matchId,
    url: `https://www.cricbuzz.com/live-cricket-scores/${matchId}`,
    capturedAt: 1,
    confidence: 1,
    fields: { teams: [], innings: [], batters: [], thisOver: [], lastBalls: [], ...fields },
    missing: [],
  });

describe('ExtensionProvider ingest guard', () => {
  it('drops a scrape that named nobody and reported no ball', () => {
    const p = new ExtensionProvider();
    p.ingest(upd({ innings: [{ team: 'Batting', runs: 0, wkts: 0, overs: 0, balls: 0 }] }));
    expect(p.status().matches).toEqual([]);
    expect(p.status().lastRejected).toMatchObject({
      matchId: 'm1',
      reason: 'named no team and reported no ball',
    });
  });

  it('keeps a live scrape and an honest preview that name both sides', () => {
    const p = new ExtensionProvider();
    p.ingest(
      upd(
        {
          teams: [{ name: 'Pakistan' }, { name: 'England' }],
          innings: [{ team: 'PAK', runs: 302, wkts: 9, overs: 50, balls: 0 }],
        },
        'live1',
      ),
    );
    p.ingest(
      upd(
        {
          teams: [{ name: 'India' }, { name: 'Australia' }],
          innings: [{ team: 'India', runs: 0, wkts: 0, overs: 0, balls: 0 }],
          preMatch: true,
        },
        'pre1',
      ),
    );
    expect(p.status().matches.map((m) => m.matchId)).toEqual(['live1', 'pre1']);
    expect(p.status().lastRejected).toBeNull();
  });

  it('keeps a score-only scrape even when the page never named a team', () => {
    const p = new ExtensionProvider();
    p.ingest(upd({ innings: [{ team: '', runs: 120, wkts: 3, overs: 15, balls: 2 }] }, 'scores'));
    expect(p.status().matches.map((m) => m.matchId)).toEqual(['scores']);
  });

  it('never blocks the manual scorer, which legitimately starts at 0-0', () => {
    const p = new ExtensionProvider();
    p.ingest({
      ...upd({ innings: [{ team: 'Team A', runs: 0, wkts: 0, overs: 0, balls: 0 }] }, 'man1'),
      source: 'manual',
    });
    expect(p.status().matches.map((m) => m.matchId)).toEqual(['man1']);
  });
});
