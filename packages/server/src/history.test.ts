import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { Team } from '@stumpcast/shared';
import { buildApp, type StumpCastApp } from './app';
import { loadConfig } from './config';
import { parseToss } from './engine/adapt';

describe('parseToss', () => {
  const teams: [Team, Team] = [
    { id: 'team-india', name: 'India', short: 'IND', color: '#19D3C5' },
    { id: 'team-australia', name: 'Australia', short: 'AUS', color: '#FF6B57' },
  ];

  it('reads the winner and decision', () => {
    expect(parseToss('India won the toss and chose to bat', teams)).toEqual({
      winnerTeamId: 'team-india',
      decision: 'bat',
    });
    expect(parseToss('Australia won the toss and elected to field', teams)).toEqual({
      winnerTeamId: 'team-australia',
      decision: 'bowl',
    });
  });

  it('returns nothing for unknown teams or odd text', () => {
    expect(parseToss('Nepal won the toss and chose to bat', teams)).toBeUndefined();
    expect(parseToss('Toss delayed by rain', teams)).toBeUndefined();
    expect(parseToss(undefined, teams)).toBeUndefined();
  });
});

describe('GET /api/match/:id/history', () => {
  let app: StumpCastApp | null = null;
  let dir = '';
  afterEach(async () => {
    await app?.stop();
    app = null;
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  });

  it('rebuilds per-over runs and fall of wickets from a scored match', async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-history-'));
    app = await buildApp(loadConfig({}, { dataDir: dir, port: 0, overlayDir: '', adminDir: '' }));
    const port = await app.start();
    const base = `http://127.0.0.1:${port}`;
    const post = async (p: string, body: unknown) => {
      const r = await fetch(base + p, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      return r.json() as Promise<{ id: string }>;
    };

    const names = (p: string) => Array.from({ length: 11 }, (_, i) => `${p} Player ${i + 1}`);
    const m = await post('/api/manual/matches', {
      format: 'T20',
      teams: [
        { name: 'Alpha', players: names('Alpha') },
        { name: 'Bravo', players: names('Bravo') },
      ],
    });
    const c = (type: string, body: unknown) => post(`/api/manual/${m.id}/${type}`, body);
    await c('set-batter', { slot: 'striker', playerId: 'alpha-player-1' });
    await c('set-batter', { slot: 'nonStriker', playerId: 'alpha-player-2' });
    await c('set-bowler', { playerId: 'bravo-player-11' });

    // Over 1: 4 + five singles-free dots = 4 runs. Wicket on the last ball of over 1? keep simple.
    await c('ball', { runs: 4 });
    for (let i = 0; i < 5; i++) await c('ball', { runs: 0 });
    await c('new-over', { bowlerId: 'bravo-player-10' });
    await c('ball', { runs: 6 });
    await c('ball', {
      runs: 0,
      wicket: { kind: 'bowled', newBatterId: 'alpha-player-3' },
    });
    for (let i = 0; i < 4; i++) await c('ball', { runs: 1 });

    const res = await fetch(`${base}/api/match/${m.id}/history`);
    expect(res.status).toBe(200);
    const h = (await res.json()) as {
      innings: {
        overs: { over: number; runs: number; wkts: number }[];
        fow: { wkts: number; runs: number; out?: string }[];
        cumulative: number[];
      }[];
    };
    const inn = h.innings[0]!;
    expect(inn.overs.map((o) => o.runs)).toEqual([4, 10 + 0]);
    expect(inn.overs.map((o) => o.wkts)).toEqual([0, 1]);
    expect(inn.cumulative).toEqual([4, 14]);
    expect(inn.fow).toEqual([{ wkts: 1, runs: 10, overs: 1, balls: 2, out: 'Alpha Player 2' }]);
  });

  it('is a 404 for an unknown match', async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-history-'));
    app = await buildApp(loadConfig({}, { dataDir: dir, port: 0, overlayDir: '', adminDir: '' }));
    const port = await app.start();
    const res = await fetch(`http://127.0.0.1:${port}/api/match/nope/history`);
    expect(res.status).toBe(404);
  });
});
