import { describe, expect, it } from 'vitest';
import {
  EXTRA_LABEL,
  EXTRA_MODIFIERS,
  ballFor,
  parsePlayers,
  resolveScoringKey,
  sampleSquad,
  type ExtraKind,
} from './lib/scoring';
import { describeEvent } from './pages/Live';

describe('modifier buttons', () => {
  // The buttons once used hyphenated strings cast to ExtraKind: two of them scored nothing and
  // rendered no label. The list and the payload builder must stay in step.
  it('every modifier has a label and produces a real delivery', () => {
    for (const kind of EXTRA_MODIFIERS) {
      expect(EXTRA_LABEL[kind]).toBeTruthy();
      const payload = ballFor(kind, kind === 'bye' || kind === 'legbye' ? 1 : 2);
      expect(payload).not.toBeNull();
    }
  });

  it('covers the same kinds the keyboard map can select', () => {
    const fromKeys = ['x', 'n', 'b', 'l', 'z']
      .map((k) => resolveScoringKey(k))
      .filter((k): k is { type: 'extra'; kind: ExtraKind } => k?.type === 'extra')
      .map((k) => k.kind);
    expect([...fromKeys].sort()).toEqual([...EXTRA_MODIFIERS].sort());
  });
});

describe('ballFor', () => {
  it('plain runs are runs off the bat', () => {
    expect(ballFor('none', 4)).toEqual({ runs: 4 });
    expect(ballFor('none', 7)).toBeNull();
  });

  it('a wide carries one penalty plus any runs run', () => {
    expect(ballFor('wide', 0)).toEqual({ runs: 0, extras: { type: 'wide', runs: 1 } });
    expect(ballFor('wide', 2)).toEqual({ runs: 0, extras: { type: 'wide', runs: 3 } });
  });

  it('a no-ball keeps bat runs and adds the penalty', () => {
    expect(ballFor('noball', 4)).toEqual({ runs: 4, extras: { type: 'noball', runs: 1 } });
  });

  it('byes and leg byes need at least one run and none go to the bat', () => {
    expect(ballFor('bye', 0)).toBeNull();
    expect(ballFor('legbye', 2)).toEqual({ runs: 0, extras: { type: 'legbye', runs: 2 } });
  });

  it.each(['none', 'wide', 'noball', 'bye', 'legbye'] as ExtraKind[])(
    '%s never produces an invalid payload for 0-6',
    (kind) => {
      for (let n = 0; n <= 6; n++) {
        const p = ballFor(kind, n);
        if (p) {
          expect(p.runs).toBeGreaterThanOrEqual(0);
          expect(p.runs).toBeLessThanOrEqual(6);
        }
      }
    },
  );
});

describe('keyboard scoring', () => {
  it('maps digits, extras, wicket and undo', () => {
    expect(resolveScoringKey('4')).toEqual({ type: 'run', n: 4 });
    expect(resolveScoringKey('7')).toBeNull();
    expect(resolveScoringKey('x')).toEqual({ type: 'extra', kind: 'wide' });
    expect(resolveScoringKey('N')).toEqual({ type: 'extra', kind: 'noball' });
    expect(resolveScoringKey('z')).toEqual({ type: 'extra', kind: 'none' });
    expect(resolveScoringKey('w')).toEqual({ type: 'wicket' });
    expect(resolveScoringKey('u')).toEqual({ type: 'undo' });
    expect(resolveScoringKey('q')).toBeNull();
  });
});

describe('setup helpers', () => {
  it('builds a default squad and parses pasted lists', () => {
    expect(sampleSquad('Reds')).toHaveLength(11);
    expect(sampleSquad('Reds')[0]).toBe('Reds Player 1');
    expect(parsePlayers('A One\n\n B Two , C Three \r\n')).toEqual(['A One', 'B Two', 'C Three']);
  });

  it('parses structured JSON and CSV squad lists', () => {
    const json = JSON.stringify(['Babar Azam', 'Mohammad Rizwan', 'Shaheen Afridi']);
    expect(parsePlayers(json)).toEqual(['Babar Azam', 'Mohammad Rizwan', 'Shaheen Afridi']);

    const csv = 'Player,Role\nVirat Kohli,Batter\nJasprit Bumrah,Bowler';
    expect(parsePlayers(csv)).toEqual(['Virat Kohli', 'Jasprit Bumrah']);
  });
});

describe('describeEvent', () => {
  const row = (type: string, payload: Record<string, unknown> = {}) => ({
    id: 'x',
    matchId: 'm',
    type,
    payload,
    at: 0,
  });
  it('writes readable feed lines', () => {
    expect(describeEvent(row('WICKET', { out: 'A Batter' }))).toBe('Wicket: A Batter');
    expect(describeEvent(row('FIFTY', { name: 'A Batter' }))).toBe('Fifty: A Batter');
    expect(describeEvent(row('OVER_END', { over: 5 }))).toBe('End of over 5');
    expect(describeEvent(row('NEW_BATTER'))).toBe('New batter');
  });
});
