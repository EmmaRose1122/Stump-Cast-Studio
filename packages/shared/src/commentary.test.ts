import { describe, expect, it } from 'vitest';
import {
  buildBallCommentary,
  buildEventCommentary,
  type CommentaryLanguage,
  type EngineEvent,
  type MatchState,
} from './commentary';
import { createMatchState } from './factories';
import { fixtures } from './fixtures';

const state = fixtures.t20 as unknown as MatchState;

const ev = (type: EngineEvent['type'], payload: Record<string, unknown> = {}): EngineEvent => ({
  id: `${type}-1`,
  matchId: 'm1',
  type,
  at: '2026-01-01T00:00:00.000Z',
  payload,
});

const DEVANAGARI = /[ऀ-ॿ]/;
const NASTALIQ = /[؀-ۿ]/;

describe('buildEventCommentary', () => {
  it('speaks Hindi in Devanagari by default and keeps the player names intact', () => {
    const line = buildEventCommentary(ev('FOUR', { batter: 'Babar Azam' }), state);
    expect(line).toContain('Babar Azam');
    expect(line).toMatch(DEVANAGARI);
    expect(line).toMatch(/चौका|छक्का|बाउंड्री/);
  });

  it('writes Urdu in Nastaliq when the language is ur', () => {
    const line = buildEventCommentary(ev('SIX', { batter: 'Babar Azam' }), state, 'ur');
    expect(line).toContain('Babar Azam');
    expect(line).toMatch(NASTALIQ);
    expect(line).not.toMatch(DEVANAGARI);
  });

  it('writes English when asked', () => {
    const line = buildEventCommentary(ev('FOUR', { batter: 'Babar Azam' }), state, 'en');
    expect(line).toMatch(/FOUR|boundary/i);
    expect(line).not.toMatch(DEVANAGARI);
  });

  it('announces a wicket with the batter who fell and the bowler', () => {
    const line = buildEventCommentary(
      ev('WICKET', { out: 'Babar Azam', bowler: 'Pat Cummins' }),
      state,
    );
    expect(line).toContain('Babar Azam');
    expect(line).toContain('Pat Cummins');
    expect(line).toMatch(/आउट|विकेट/);
  });

  it('covers every event type in every language without leaving a template hole', () => {
    const types: EngineEvent['type'][] = [
      'FOUR',
      'SIX',
      'WICKET',
      'FIFTY',
      'HUNDRED',
      'OVER_END',
      'MILESTONE',
      'DRS',
      'INNINGS_END',
      'NEW_BATTER',
    ];
    for (const lang of ['hi', 'ur', 'en'] as CommentaryLanguage[]) {
      for (const type of types) {
        for (let i = 0; i < 5; i++) {
          const line = buildEventCommentary(ev(type, { over: 6, name: 'V Kohli' }), state, lang);
          expect(line.length, `${lang}/${type}`).toBeGreaterThan(4);
          expect(line, `${lang}/${type}`).not.toMatch(/\{[bson]\}/);
          expect(line, `${lang}/${type}`).not.toMatch(/undefined|NaN/);
        }
      }
    }
  });
});

describe('buildBallCommentary', () => {
  const withBall = (runs: number, extras?: { type: 'wide' | 'noball'; runs: number }) =>
    createMatchState({
      ...state,
      thisOver: [{ over: 11, ball: 1, runs, extras, batterId: 'a', bowlerId: 'b' }],
    });

  it('describes each delivery outcome', () => {
    expect(buildBallCommentary(withBall(0), 'hi')).toMatch(/डॉट|खाली|कोई रन नहीं/);
    expect(buildBallCommentary(withBall(1), 'hi')).toMatch(/एक रन/);
    expect(buildBallCommentary(withBall(4), 'hi')).toMatch(/चौका/);
    expect(buildBallCommentary(withBall(6), 'hi')).toMatch(/छक्का/);
    expect(buildBallCommentary(withBall(0, { type: 'wide', runs: 1 }), 'hi')).toMatch(/वाइड/);
    expect(buildBallCommentary(withBall(0, { type: 'noball', runs: 1 }), 'hi')).toMatch(/नो बॉल/);
  });

  it('says nothing when the feed has no delivery to describe', () => {
    expect(buildBallCommentary(createMatchState({ ...state, thisOver: [], lastBalls: [] }))).toBeNull();
  });

  it('adds chase pressure only when the rate demands it', () => {
    const tense = createMatchState({
      ...state,
      currentInnings: 2,
      target: 220,
      score: { runs: 100, wkts: 8, overs: 15, balls: 0 },
      thisOver: [{ over: 15, ball: 1, runs: 0, batterId: 'a', bowlerId: 'b' }],
    });
    for (let i = 0; i < 8; i++) {
      expect(buildBallCommentary(tense, 'hi')).toMatch(/दबाव/);
    }
  });
});
