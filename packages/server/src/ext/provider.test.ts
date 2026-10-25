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

  it('keeps both Test innings from the same side as the live innings advances', async () => {
    const p = new ExtensionProvider();
    const teams = [{ name: 'India A' }, { name: 'New Zealand A' }];
    const innings = [
      { team: 'India A', runs: 113, wkts: 10, overs: 39, balls: 3 },
      { team: 'New Zealand A', runs: 317, wkts: 10, overs: 89, balls: 3 },
      { team: 'India A', runs: 81, wkts: 2, overs: 26, balls: 1 },
    ];
    p.ingest(upd({ teams, innings }, 'test1'));
    p.ingest(upd({ teams, innings: [...innings.slice(0, 2), { ...innings[2]!, runs: 103 }] }, 'test1'));
    const snapshot = await p.snapshot('test1');
    expect(snapshot).toMatchObject({
      fields: {
        innings: [
          { team: 'India A', runs: 113 },
          { team: 'New Zealand A', runs: 317 },
          { team: 'India A', runs: 103 },
        ],
      },
    });
  });

  it('uses the newest batters and bowler even when their innings has lower figures', async () => {
    const p = new ExtensionProvider();
    const teams = [{ name: 'India A' }, { name: 'New Zealand A' }];
    p.ingest(upd({
      teams,
      innings: [{ team: 'India A', runs: 113, wkts: 10, overs: 39, balls: 3 }],
      batters: [{ name: 'Devdutt Padikkal', runs: 90, balls: 120 }],
      bowler: { name: 'Matt Henry', overs: 12, balls: 0, maidens: 2, runs: 40, wkts: 3 },
    }, 'test2'));
    p.ingest(upd({
      teams,
      innings: [{ team: 'India A', runs: 5, wkts: 0, overs: 1, balls: 2 }],
      batters: [{ name: 'Devdutt Padikkal', runs: 5, balls: 9 }],
      bowler: { name: 'Kristian Clarke', overs: 1, balls: 2, maidens: 0, runs: 4, wkts: 0 },
    }, 'test2'));

    const snapshot = await p.snapshot('test2') as RawUpdate;
    expect(snapshot.fields.batters).toEqual([{ name: 'Devdutt Padikkal', runs: 5, balls: 9 }]);
    expect(snapshot.fields.bowler).toMatchObject({ name: 'Kristian Clarke', runs: 4, wkts: 0 });
  });
});
