import { describe, expect, it } from 'vitest';
import {
  cleanPlayerName,
  looksLikeScore,
  looksLikeToss,
  parseBallTokens,
  parseDayStatus,
  parseNumber,
  parseOvers,
  parsePartnership,
  parseScore,
} from './normalise';

describe('parseOvers', () => {
  it('splits overs and balls', () => {
    expect(parseOvers('17.3')).toEqual({ overs: 17, balls: 3 });
    expect(parseOvers('20')).toEqual({ overs: 20, balls: 0 });
    expect(parseOvers(' 6.0 ov ')).toEqual({ overs: 6, balls: 0 });
    expect(parseOvers('(17.3)')).toEqual({ overs: 17, balls: 3 });
    expect(parseOvers('(16.0 Ovs)')).toEqual({ overs: 16, balls: 0 });
    expect(parseOvers('(20)')).toEqual({ overs: 20, balls: 0 });
  });
  it('rejects impossible or garbage values', () => {
    expect(parseOvers('17.6')).toBeUndefined();
    expect(parseOvers('abc')).toBeUndefined();
    expect(parseOvers(undefined)).toBeUndefined();
  });
});

describe('parseScore', () => {
  it('parses runs-wickets in common separators', () => {
    expect(parseScore('52-1')).toEqual({ runs: 52, wkts: 1 });
    expect(parseScore('169/7')).toEqual({ runs: 169, wkts: 7 });
    expect(parseScore('GBR 312 - 10')).toEqual({ runs: 312, wkts: 10 });
  });
  it('rejects more than 10 wickets', () => {
    expect(parseScore('52-11')).toBeUndefined();
  });
  it('treats an all-out marker as 10 wickets', () => {
    expect(parseScore('169 all out')).toEqual({ runs: 169, wkts: 10 });
  });
  it('does not guess wickets from a bare number', () => {
    expect(parseScore('169')).toBeUndefined();
  });
  it('allows bare numbers when allowBare option is enabled, without inventing wickets', () => {
    expect(parseScore('260', { allowBare: true })).toEqual({ runs: 260 });
    expect(parseScore('260 (92.0)', { allowBare: true })).toEqual({ runs: 260 });
  });
});

describe('looksLikeScore', () => {
  it('recognises score-shaped text so it can never be used as a team name', () => {
    for (const s of ['145/3', '224-4', '0/0', '(145/3)', '160/6 (20.0)']) {
      expect(looksLikeScore(s)).toBe(true);
    }
    for (const s of ['India', 'South Africa', 'PAK', 'Nepal opt to bat', 'Day 2: Stumps']) {
      expect(looksLikeScore(s)).toBe(false);
    }
  });
});

describe('looksLikeToss', () => {
  it('accepts only a real toss sentence', () => {
    expect(looksLikeToss('Pakistan won the toss and elected to bowl')).toBe(true);
    expect(looksLikeToss('Nepal opt to bat')).toBe(true);
    expect(looksLikeToss('BatterRB4s6sSR')).toBe(false);
    expect(looksLikeToss('GMT')).toBe(false);
    expect(looksLikeToss(undefined)).toBe(false);
  });
});

describe('cleanPlayerName', () => {
  it('removes markers and keeps the meaning as flags', () => {
    expect(cleanPlayerName('Aiden Markram*')).toEqual({
      name: 'Aiden Markram',
      onStrike: true,
      isCaptain: false,
      isWk: false,
    });
    expect(cleanPlayerName('Babar Azam (c)')).toMatchObject({
      name: 'Babar Azam',
      isCaptain: true,
    });
    expect(cleanPlayerName('Rishabh Pant (wk)')).toMatchObject({
      name: 'Rishabh Pant',
      isWk: true,
    });
    expect(cleanPlayerName('  Jos   Buttler (c & wk) * ')).toMatchObject({
      name: 'Jos Buttler',
      isCaptain: true,
      isWk: true,
      onStrike: true,
    });
  });
  it('returns undefined for empty names', () => {
    expect(cleanPlayerName('*')).toBeUndefined();
  });
});

describe('parseDayStatus', () => {
  it('splits day, session and result text', () => {
    expect(parseDayStatus('Day 4: Stumps - India need 319 runs')).toEqual({
      day: 4,
      session: 'stumps',
      resultText: 'India need 319 runs',
    });
  });
  it('handles a bare day', () => {
    expect(parseDayStatus('Day 2')).toEqual({ day: 2 });
  });
  it('finds the day when it is not the first word', () => {
    expect(parseDayStatus('Stumps - Day 3: Australia need 319 runs')).toEqual({
      day: 3,
      session: 'stumps',
      resultText: 'Australia need 319 runs',
    });
    expect(parseDayStatus('4th Innings: Day 2, Lunch')).toMatchObject({ day: 2, session: 'lunch' });
  });
  it('ignores non-Test status text', () => {
    expect(parseDayStatus('India need 20 runs in 12 balls')).toBeUndefined();
  });
});

describe('misc', () => {
  it('parses ball tokens', () => {
    expect(parseBallTokens('1 4 W . 2, wd')).toEqual(['1', '4', 'W', '.', '2', 'wd']);
    expect(parseBallTokens(undefined)).toEqual([]);
  });
  it('parses partnership', () => {
    expect(parsePartnership('34(19)')).toEqual({ runs: 34, balls: 19 });
    expect(parsePartnership('none')).toBeUndefined();
  });
  it('parses numbers with separators and suffixes', () => {
    expect(parseNumber('1,234')).toBe(1234);
    expect(parseNumber('CRR: 8.29')).toBe(8.29);
    expect(parseNumber('n/a')).toBeUndefined();
  });
});
