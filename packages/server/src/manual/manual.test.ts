import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { MatchStateSchema, type ManualCommand, type ManualSetup } from '@stumpcast/shared';
import { buildApp, type StumpCastApp } from '../app';
import { loadConfig } from '../config';
import { migrate } from '../db';
import { MatchEngine } from '../engine/MatchEngine';
import { ManualError, ManualMatch } from './ManualMatch';
import { ManualProvider } from './ManualProvider';

const names = (prefix: string, n = 11) =>
  Array.from({ length: n }, (_, i) => `${prefix} Player ${i + 1}`);
const id = (prefix: string, n: number) => `${prefix.toLowerCase()}-player-${n}`;

const setup = (over: Partial<ManualSetup> = {}): ManualSetup => ({
  format: 'T20',
  teams: [
    { name: 'Alpha', short: 'ALP', players: names('Alpha') },
    { name: 'Bravo', short: 'BRV', players: names('Bravo') },
  ],
  ...over,
});

const ball = (
  runs = 0,
  extra: Partial<Extract<ManualCommand, { type: 'ball' }>> = {},
): ManualCommand => ({ type: 'ball', runs, ...extra }) as ManualCommand;

/** A match with openers and the first bowler set, ready to score. */
const ready = (over: Partial<ManualSetup> = {}) => {
  const m = new ManualMatch('m1', setup(over));
  m.apply({ type: 'set-batter', slot: 'striker', playerId: id('alpha', 1) });
  m.apply({ type: 'set-batter', slot: 'nonStriker', playerId: id('alpha', 2) });
  m.apply({ type: 'set-bowler', playerId: id('bravo', 11) });
  return m;
};

const raw = (m: ManualMatch) => m.toRawUpdate(1_700_000_000_000);

/** Play legal single-run-free overs to reach a given number of balls. */
const bowlDots = (m: ManualMatch, balls: number, bowlers = [id('bravo', 10), id('bravo', 11)]) => {
  let b = 0;
  for (let i = 0; i < balls; i++) {
    if (m.awaiting.includes('bowler')) {
      m.apply({ type: 'new-over', bowlerId: bowlers[b++ % bowlers.length]! });
    }
    m.apply(ball(0));
  }
};

describe('setup and gating', () => {
  it('rejects scoring before openers and bowler are chosen', () => {
    const m = new ManualMatch('m', setup());
    expect(m.awaiting).toEqual(['striker', 'nonStriker', 'bowler']);
    expect(() => m.apply(ball(1))).toThrow(ManualError);
  });

  it('the toss decides who bats first', () => {
    const m = new ManualMatch('m', setup());
    m.apply({ type: 'set-toss', winnerTeamId: 'team-bravo', decision: 'bat' });
    expect(m.describe().battingTeamId).toBe('team-bravo');
    m.apply({ type: 'set-toss', winnerTeamId: 'team-bravo', decision: 'bowl' });
    expect(m.describe().battingTeamId).toBe('team-alpha');
  });

  it('refuses a toss after play has started', () => {
    const m = ready();
    m.apply(ball(1));
    expect(() =>
      m.apply({ type: 'set-toss', winnerTeamId: 'team-alpha', decision: 'bat' }),
    ).toThrow(/before the first ball/);
  });

  it('validates players belong to the right team', () => {
    const m = new ManualMatch('m', setup());
    expect(() =>
      m.apply({ type: 'set-batter', slot: 'striker', playerId: id('bravo', 1) }),
    ).toThrow(/batting team/);
    expect(() => m.apply({ type: 'set-bowler', playerId: id('alpha', 1) })).toThrow(/fielding/);
  });
});

describe('runs, strike and overs', () => {
  it.each([
    [0, false],
    [1, true],
    [2, false],
    [3, true],
    [4, false],
    [6, false],
  ])('%i runs off the bat: strike changes = %s', (runs, swaps) => {
    const m = ready();
    m.apply(ball(runs));
    expect(m.describe().striker).toBe(swaps ? id('alpha', 2) : id('alpha', 1));
    expect(m.current.runs).toBe(runs);
  });

  it('credits the batter, counts four/six and the partnership', () => {
    const m = ready();
    m.apply(ball(4));
    m.apply(ball(6));
    const s = m.current.batters.get(id('alpha', 1))!;
    expect(s).toMatchObject({ runs: 10, balls: 2, fours: 1, sixes: 1 });
    expect(m.current.partnership).toEqual({ runs: 10, balls: 2 });
  });

  it('completes an over after six legal balls: strike swaps and a new bowler is required', () => {
    const m = ready();
    bowlDots(m, 6);
    expect(m.overs).toEqual({ overs: 1, balls: 0 });
    expect(m.awaiting).toEqual(['bowler']);
    expect(m.describe().striker).toBe(id('alpha', 2)); // end change
    expect(() => m.apply({ type: 'new-over', bowlerId: id('bravo', 11) })).toThrow(/two overs/);
    m.apply({ type: 'new-over', bowlerId: id('bravo', 10) });
    expect(m.awaiting).toEqual([]);
  });

  it('counts a maiden only for a six-dot over', () => {
    const m = ready();
    bowlDots(m, 6);
    expect(m.current.bowlers.get(id('bravo', 11))!.maidens).toBe(1);
    m.apply({ type: 'new-over', bowlerId: id('bravo', 10) });
    m.apply(ball(1));
    bowlDots(m, 5);
    expect(m.current.bowlers.get(id('bravo', 10))!.maidens).toBe(0);
  });

  it('shows the over just finished until the next one starts (like a live feed)', () => {
    const m = ready();
    m.apply(ball(1));
    bowlDots(m, 5);
    expect(raw(m).fields.thisOver).toEqual(['1', '.', '.', '.', '.', '.']);
  });
});

describe('extras and free hits', () => {
  it('a wide is not a legal ball and the batter does not face it', () => {
    const m = ready();
    m.apply(ball(0, { extras: { type: 'wide', runs: 1 } }));
    expect(m.current.runs).toBe(1);
    expect(m.overs).toEqual({ overs: 0, balls: 0 });
    expect(m.current.batters.get(id('alpha', 1))!.balls).toBe(0);
    expect(m.current.bowlers.get(id('bravo', 11))!.runs).toBe(1);
    expect(m.describe().striker).toBe(id('alpha', 1)); // 1 wide = no run taken
  });

  it('a wide where the batters ran one swaps strike', () => {
    const m = ready();
    m.apply(ball(0, { extras: { type: 'wide', runs: 2 } }));
    expect(m.describe().striker).toBe(id('alpha', 2));
  });

  it('a no-ball adds the penalty, keeps the ball count and gives a free hit', () => {
    const m = ready();
    m.apply(ball(4, { extras: { type: 'noball', runs: 1 } }));
    expect(m.current.runs).toBe(5);
    expect(m.overs.balls).toBe(0);
    expect(m.describe().freeHit).toBe(true);
    expect(m.current.batters.get(id('alpha', 1))!.runs).toBe(4);
  });

  it('only a run out is possible on a free hit, and the flag clears after a legal ball', () => {
    const m = ready();
    m.apply(ball(0, { extras: { type: 'noball', runs: 1 } }));
    expect(() =>
      m.apply(ball(0, { wicket: { kind: 'bowled', newBatterId: id('alpha', 3) } })),
    ).toThrow(/free hit/);
    m.apply(ball(1));
    expect(m.describe().freeHit).toBe(false);
  });

  it('byes and leg byes go to the extras, not the batter, and rotate by runs run', () => {
    const m = ready();
    m.apply(ball(0, { extras: { type: 'bye', runs: 1 } }));
    expect(m.current.runs).toBe(1);
    expect(m.current.batters.get(id('alpha', 1))!.runs).toBe(0);
    expect(m.current.batters.get(id('alpha', 1))!.balls).toBe(1);
    expect(m.describe().striker).toBe(id('alpha', 2));
    expect(m.current.bowlers.get(id('bravo', 11))!.runs).toBe(0);
    expect(() => m.apply(ball(2, { extras: { type: 'legbye', runs: 1 } }))).toThrow();
  });
});

describe('wickets', () => {
  it('records a bowled dismissal, resets the partnership and brings in the new batter', () => {
    const m = ready();
    m.apply(ball(2));
    m.apply(ball(0, { wicket: { kind: 'bowled', newBatterId: id('alpha', 3) } }));
    expect(m.current.wkts).toBe(1);
    expect(m.describe().striker).toBe(id('alpha', 3));
    expect(m.current.partnership).toEqual({ runs: 0, balls: 0 });
    expect(m.current.bowlers.get(id('bravo', 11))!.wkts).toBe(1);
    expect(m.current.fow).toEqual([{ runs: 2, wkts: 1, playerId: id('alpha', 1) }]);
  });

  it('a run out is not credited to the bowler and may dismiss the non-striker', () => {
    const m = ready();
    m.apply(
      ball(0, {
        wicket: { kind: 'runout', playerOutId: id('alpha', 2), newBatterId: id('alpha', 3) },
      }),
    );
    expect(m.current.bowlers.get(id('bravo', 11))!.wkts).toBe(0);
    expect(m.describe().nonStriker).toBe(id('alpha', 3));
    expect(m.describe().striker).toBe(id('alpha', 1));
  });

  it('leaves the match untouched when a command is rejected', () => {
    const m = ready();
    m.apply(ball(1));
    const before = JSON.stringify(raw(m));
    expect(() => m.apply(ball(0, { wicket: { kind: 'bowled' } }))).toThrow(/incoming batter/);
    expect(() =>
      m.apply(ball(0, { wicket: { kind: 'bowled', newBatterId: id('bravo', 1) } })),
    ).toThrow(/batting team/);
    expect(() =>
      m.apply(ball(0, { wicket: { kind: 'bowled', newBatterId: id('alpha', 2) } })),
    ).toThrow(/already batted/);
    expect(JSON.stringify(raw(m))).toBe(before);
  });
});

describe('innings and results', () => {
  const allOut = (m: ManualMatch) => {
    for (let w = 1; w <= 10; w++) {
      if (m.awaiting.includes('bowler')) {
        m.apply({
          type: 'new-over',
          bowlerId:
            m.describe().lastOverBowler === id('bravo', 10) ? id('bravo', 11) : id('bravo', 10),
        });
      }
      const next = w < 10 ? { newBatterId: id('alpha', w + 2) } : {};
      m.apply(ball(0, { wicket: { kind: 'bowled', ...next } }));
    }
  };

  it('ends the innings when ten wickets fall and opens the second', () => {
    const m = ready();
    m.apply(ball(4));
    allOut(m);
    expect(m.innings).toHaveLength(2);
    expect(m.innings[0]!.complete).toBe(true);
    expect(m.target).toBe(5);
    expect(m.describe().battingTeamId).toBe('team-bravo');
    expect(m.awaiting).toEqual(['striker', 'nonStriker', 'bowler']);
    expect(raw(m).fields.status).toBe('Innings Break');
  });

  it('ends a limited-overs innings when the overs run out', () => {
    const m = ready({ overs: 1 });
    bowlDots(m, 6);
    expect(m.innings).toHaveLength(2);
    expect(m.target).toBe(1);
  });

  const secondInnings = () => {
    const m = ready({ overs: 2 });
    m.apply(ball(6));
    m.apply(ball(4));
    bowlDots(m, 10); // 2 overs total
    expect(m.target).toBe(11);
    m.apply({ type: 'set-batter', slot: 'striker', playerId: id('bravo', 1) });
    m.apply({ type: 'set-batter', slot: 'nonStriker', playerId: id('bravo', 2) });
    m.apply({ type: 'set-bowler', playerId: id('alpha', 11) });
    return m;
  };

  it('chasing side wins as soon as the target is reached', () => {
    const m = secondInnings();
    m.apply(ball(6));
    m.apply(ball(4));
    expect(m.result).toBeNull();
    m.apply(ball(1));
    expect(m.result).toBe('Bravo won by 10 wickets');
  });

  it('the defending side wins by runs when the chase falls short', () => {
    const m = secondInnings();
    m.apply(ball(1));
    bowlDots(m, 5);
    m.apply({ type: 'new-over', bowlerId: id('alpha', 10) });
    bowlDots(m, 6, [id('alpha', 11), id('alpha', 10)]);
    expect(m.result).toBe('Alpha won by 9 runs');
    expect(raw(m).fields.status).toBe('Alpha won by 9 runs');
  });

  it('a chase that ends one short is a tie', () => {
    const m = secondInnings();
    m.apply(ball(6));
    m.apply(ball(4));
    bowlDots(m, 4);
    m.apply({ type: 'new-over', bowlerId: id('alpha', 10) });
    bowlDots(m, 6, [id('alpha', 10), id('alpha', 11)]);
    expect(m.result).toBe('Match tied');
  });

  it('Tests: declare opens the next innings and the result is set by hand', () => {
    const m = ready({ format: 'TEST' });
    m.apply(ball(4));
    m.apply({ type: 'end-innings', declared: true });
    expect(m.innings).toHaveLength(2);
    expect(m.result).toBeNull();
    expect(m.oversLimit).toBeUndefined();
    m.apply({ type: 'set-result', text: 'Match drawn' });
    expect(m.result).toBe('Match drawn');
    expect(() => m.apply(ball(1))).toThrow(/finished/);
  });
});

describe('replay, undo and the engine', () => {
  const script: ManualCommand[] = [
    ball(1),
    ball(0, { extras: { type: 'wide', runs: 1 } }),
    ball(4),
    ball(0, { wicket: { kind: 'caught', newBatterId: id('alpha', 3) } }),
    ball(2),
    ball(0, { extras: { type: 'noball', runs: 1 } }),
    ball(6),
    ball(0),
  ];

  it('replaying the same commands reproduces exactly the same update', () => {
    const a = ready();
    const b = ready();
    script.forEach((c) => a.apply(c));
    script.forEach((c) => b.apply(c));
    expect(raw(a)).toEqual(raw(b));
    expect(raw(a).fields.innings[0]).toMatchObject({ runs: 15, wkts: 1, overs: 1, balls: 0 });
  });

  const providerWith = (file = ':memory:') => {
    const sqlite = new Database(file);
    migrate(sqlite);
    return {
      sqlite,
      p: new ManualProvider(sqlite, () => 1_700_000_000_000),
    };
  };

  it('undo removes exactly the last command and can be repeated', () => {
    const { p } = providerWith();
    const m = p.create(setup());
    const cmds: ManualCommand[] = [
      { type: 'set-batter', slot: 'striker', playerId: id('alpha', 1) },
      { type: 'set-batter', slot: 'nonStriker', playerId: id('alpha', 2) },
      { type: 'set-bowler', playerId: id('bravo', 11) },
      ...script,
    ];
    const snapshots: string[] = [];
    for (const c of cmds) {
      p.command(m.id, c);
      snapshots.push(JSON.stringify(raw(p.get(m.id)!)));
    }
    for (let i = cmds.length - 2; i >= 0; i--) {
      p.undo(m.id);
      expect(JSON.stringify(raw(p.get(m.id)!))).toBe(snapshots[i]);
    }
    p.undo(m.id);
    expect(() => p.undo(m.id)).toThrow(/Nothing to undo/);
  });

  it('a rejected command is not stored', () => {
    const { p } = providerWith();
    const m = p.create(setup());
    expect(() => p.command(m.id, ball(1))).toThrow(ManualError);
    expect(p.commandCount(m.id)).toBe(0);
  });

  it('survives a restart by replaying the stored commands', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-manual-'));
    const file = path.join(dir, 'x.db');
    try {
      const first = providerWith(file);
      const m = first.p.create(setup());
      for (const c of [
        { type: 'set-batter', slot: 'striker', playerId: id('alpha', 1) },
        { type: 'set-batter', slot: 'nonStriker', playerId: id('alpha', 2) },
        { type: 'set-bowler', playerId: id('bravo', 11) },
        ...script,
      ] as ManualCommand[]) {
        first.p.command(m.id, c);
      }
      const expected = JSON.stringify(raw(first.p.get(m.id)!));
      first.sqlite.close();

      const second = providerWith(file);
      expect(JSON.stringify(raw(second.p.get(m.id)!))).toBe(expected);
      second.sqlite.close();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('feeds the match engine with a valid, fully derived state', () => {
    const { p } = providerWith();
    const engine = new MatchEngine();
    p.onUpdate((u) => engine.process(u));
    const m = p.create(setup());
    for (const c of [
      { type: 'set-batter', slot: 'striker', playerId: id('alpha', 1) },
      { type: 'set-batter', slot: 'nonStriker', playerId: id('alpha', 2) },
      { type: 'set-bowler', playerId: id('bravo', 11) },
      ball(4),
      ball(1),
    ] as ManualCommand[]) {
      p.command(m.id, c);
    }
    const s = engine.getState(m.id)!;
    expect(MatchStateSchema.safeParse(s).success).toBe(true);
    expect(s.score).toEqual({ runs: 5, wkts: 0, overs: 0, balls: 2 });
    expect(s.batters[0].name).toBe('Alpha Player 2'); // 1 run: strike changed
    expect(s.batters[0].onStrike).toBe(true);
    expect(s.ballsLeft).toBe(118);
    expect(s.thisOver).toHaveLength(2);
  });
});

describe('HTTP API', () => {
  let app: StumpCastApp | null = null;
  let dir = '';
  afterEach(async () => {
    await app?.stop();
    app = null;
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  });

  it('creates a match, scores, rejects bad input, undoes and reaches the engine', async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-manual-http-'));
    app = await buildApp(loadConfig({}, { dataDir: dir, port: 0, overlayDir: '', adminDir: '' }));
    const port = await app.start();
    const base = `http://127.0.0.1:${port}`;
    const post = (p: string, body: unknown) =>
      fetch(base + p, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

    const created = await post('/api/manual/matches', setup());
    expect(created.status).toBe(200);
    const match = (await created.json()) as { id: string; awaiting: string[] };
    expect(match.awaiting).toEqual(['striker', 'nonStriker', 'bowler']);

    // Scoring before the openers are set is a clear 400.
    const early = await post(`/api/manual/${match.id}/ball`, { runs: 1 });
    expect(early.status).toBe(400);
    expect(((await early.json()) as { error: string }).error).toMatch(/Set the/);

    await post(`/api/manual/${match.id}/set-batter`, { slot: 'striker', playerId: id('alpha', 1) });
    await post(`/api/manual/${match.id}/set-batter`, {
      slot: 'nonStriker',
      playerId: id('alpha', 2),
    });
    await post(`/api/manual/${match.id}/set-bowler`, { playerId: id('bravo', 11) });
    const scored = await post(`/api/manual/${match.id}/ball`, { runs: 4 });
    expect(scored.status).toBe(200);
    expect(app.engine.getState(match.id)?.score.runs).toBe(4);

    expect((await post(`/api/manual/${match.id}/ball`, { runs: 9 })).status).toBe(400);

    const undone = await post(`/api/manual/${match.id}/undo`, {});
    expect(undone.status).toBe(200);
    expect(app.engine.getState(match.id)?.score.runs).toBe(0);

    expect((await post('/api/manual/nope/ball', { runs: 1 })).status).toBe(404);
    const list = (await (await fetch(`${base}/api/manual/matches`)).json()) as unknown[];
    expect(list).toHaveLength(1);
  });
});
