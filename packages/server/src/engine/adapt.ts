import {
  createBall,
  resolveTeam,
  slug,
  type BallEvent,
  type MatchFormat,
  type MatchState,
  type MatchStatus,
  type RawUpdate,
  type Team,
} from '@stumpcast/shared';

const PALETTE = ['#19D3C5', '#FF6B57'] as const;
const PLACEHOLDER = '—';

/**
 * A scraped name becomes a canonical team. Unknown sides keep a name-derived id but get no crest
 * code, because a near-miss code can point at a real flag of a different country.
 */
const teamFor = (name: string, index: number, scrapedShort?: string): Team => {
  const known = resolveTeam(scrapedShort) ?? resolveTeam(name);
  if (known) {
    return {
      id: `team-${known.code}`,
      name: known.name,
      short: known.code.toUpperCase(),
      color: known.colors[0],
      logoAssetId: `team-${known.code}`,
    };
  }
  return {
    id: `team-${slug(name) || `unknown-${index}`}`,
    name,
    short:
      name
        .replace(/[^A-Za-z]/g, '')
        .slice(0, 3)
        .toUpperCase() || `T${index + 1}`,
    color: PALETTE[index % 2]!,
  };
};

export const inferFormat = (raw: RawUpdate): MatchFormat => {
  const f = raw.fields;
  if (f.format) return f.format;
  if (f.day !== undefined || /day\s*\d/i.test(f.status ?? '')) return 'TEST';
  const text = `${f.title ?? ''} ${f.status ?? ''}`;
  if (/\btest\b/i.test(text)) return 'TEST';
  if (/\bodi\b/i.test(text)) return 'ODI';
  if (/\bt20|twenty20\b/i.test(text)) return 'T20';
  return 'OTHER';
};

export const inferStatus = (raw: RawUpdate, hasInnings: boolean): MatchStatus => {
  const text = `${raw.fields.status ?? ''} ${raw.fields.resultText ?? ''}`;
  if (/\b(won by|won the|beat|tied|drawn|draw|no result|abandoned|result)\b/i.test(text)) {
    return 'result';
  }
  if (/innings break/i.test(text)) return 'innings_break';
  if (/\b(lunch|tea|drinks|stumps|break|rain|bad light)\b/i.test(text)) return 'break';
  if (/\b(toss|preview|starts|upcoming|yet to begin|scheduled)\b/i.test(text) && !hasInnings) {
    return 'pre';
  }
  return hasInnings ? 'live' : 'pre';
};

const sessionOf = (s: string | undefined): MatchState['session'] => {
  if (!s) return undefined;
  if (/lunch|morning/i.test(s)) return 'morning';
  if (/tea|afternoon/i.test(s)) return 'afternoon';
  if (/stumps|evening|close/i.test(s)) return 'evening';
  return undefined;
};

/** "India won the toss and chose to bat" -> { winnerTeamId, decision }. */
export const parseToss = (
  text: string | undefined,
  teams: [Team, Team],
): MatchState['toss'] | undefined => {
  if (!text) return undefined;
  const m = /^(.+?)\s+won the toss and (?:chose|elected|opted) to (bat|bowl|field)/i.exec(
    text.trim(),
  );
  if (!m) return undefined;
  const name = m[1]!.trim().toLowerCase();
  const team = teams.find((t) => t.name.toLowerCase() === name);
  if (!team) return undefined;
  return { winnerTeamId: team.id, decision: m[2]!.toLowerCase() === 'bat' ? 'bat' : 'bowl' };
};

/** Convert result-token strings ("1", "4", "W", ".", "wd") into BallEvents. */
export const tokensToBalls = (
  tokens: string[],
  over: number,
  batterId: string,
  bowlerId: string,
): BallEvent[] =>
  tokens.map((tok, i) => {
    const t = tok.toLowerCase();
    const base = { over, ball: i + 1, batterId, bowlerId };
    if (t === 'w' || t === 'wkt') {
      return createBall({
        ...base,
        runs: 0,
        wicket: { kind: 'other', playerOutId: batterId },
      });
    }
    const extra = /^(\d*)(wd|nb|b|lb)$/.exec(t);
    if (extra) {
      const type = ({ wd: 'wide', nb: 'noball', b: 'bye', lb: 'legbye' } as const)[
        extra[2] as 'wd' | 'nb' | 'b' | 'lb'
      ];
      const total = Number(extra[1] || 1);
      // A no-ball's total is bat runs + the one penalty run, and only the bat part counts as a
      // boundary; wides/byes never are.
      const batRuns = type === 'noball' ? Math.max(0, total - 1) : 0;
      return createBall({
        ...base,
        runs: batRuns,
        extras: { type, runs: type === 'noball' ? total - batRuns : total },
      });
    }
    const n = t === '.' ? 0 : Number(t);
    return createBall({ ...base, runs: Number.isInteger(n) && n >= 0 && n <= 7 ? n : 0 });
  });

/**
 * Provider-agnostic entry: turn a RawUpdate into a base MatchState (no derived stats).
 * Missing data gets neutral placeholders rather than invented values.
 */
export const rawToBaseState = (raw: RawUpdate, updatedAt: string): MatchState => {
  const f = raw.fields;
  const names = [f.teams[0]?.name, f.teams[1]?.name];
  for (const inn of f.innings) {
    if (inn.team && !names.includes(inn.team)) {
      const i = names.findIndex((n) => !n);
      if (i >= 0) names[i] = inn.team;
    }
  }
  if ((!names[0] || !names[1]) && f.title) {
    const titleMatch = /(?:^|[-•:|]\s*|\b)([A-Za-z0-9 .\x27]+?)\s+(?:vs\.?|v)\s+([A-Za-z0-9 .\x27]+?)(?:,|-|\(|\||\b\d|$)/i.exec(f.title);
    if (titleMatch) {
      if (!names[0] && titleMatch[1]) names[0] = titleMatch[1].trim();
      if (!names[1] && titleMatch[2]) names[1] = titleMatch[2].trim();
    }
  }
  const teams: [Team, Team] = [
    teamFor(names[0] ?? 'Team A', 0, f.teams[0]?.short),
    teamFor(names[1] ?? 'Team B', 1, f.teams[1]?.short),
  ];

  const innings = f.innings.map((inn, i) => {
    const t = teams.find((x) => x.name === inn.team) ?? teams[Math.min(i % 2, 1)]!;
    return {
      number: i + 1,
      battingTeamId: t.id,
      score: { runs: inn.runs, wkts: inn.wkts, overs: inn.overs, balls: inn.balls },
      declared: false,
      allOut: inn.wkts === 10,
    };
  });
  const current = innings.at(-1);
  const score = current?.score ?? { runs: 0, wkts: 0, overs: 0, balls: 0 };

  const batter = (i: number) => {
    const b = f.batters[i];
    return b
      ? {
          playerId: slug(b.name),
          name: b.name,
          runs: b.runs,
          balls: b.balls,
          fours: b.fours ?? 0,
          sixes: b.sixes ?? 0,
          onStrike: b.onStrike ?? false,
        }
      : {
          playerId: `unknown-batter-${i + 1}`,
          name: PLACEHOLDER,
          runs: 0,
          balls: 0,
          fours: 0,
          sixes: 0,
          onStrike: false,
        };
  };
  const batters: MatchState['batters'] = [batter(0), batter(1)];
  const strikerId = (batters.find((b) => b.onStrike) ?? batters[0]).playerId;

  const bw = f.bowler;
  const bowler: MatchState['bowler'] = bw
    ? {
        playerId: slug(bw.name),
        name: bw.name,
        overs: bw.overs,
        balls: bw.balls,
        maidens: bw.maidens,
        runs: bw.runs,
        wkts: bw.wkts,
      }
    : {
        playerId: 'unknown-bowler',
        name: PLACEHOLDER,
        overs: 0,
        balls: 0,
        maidens: 0,
        runs: 0,
        wkts: 0,
      };

  const thisOver = tokensToBalls(f.thisOver, score.overs, strikerId, bowler.playerId);
  const lastBalls = tokensToBalls(f.lastBalls, score.overs, strikerId, bowler.playerId).slice(-6);

  const format = inferFormat(raw);
  return {
    id: raw.matchId,
    title: f.title ?? `${teams[0].name} v ${teams[1].name}`,
    format,
    oversLimit: f.oversLimit,
    status: inferStatus(raw, innings.length > 0),
    venue: f.venue,
    toss: parseToss(f.toss, teams),
    teams,
    innings,
    currentInnings: innings.length,
    battingTeamId: current?.battingTeamId ?? teams[0].id,
    score,
    target: f.target,
    batters,
    bowler,
    lastBalls,
    thisOver,
    partnership: f.partnership ?? { runs: 0, balls: 0 },
    crr: f.crr ?? 0,
    rrr: f.rrr,
    day: f.day,
    session: sessionOf(f.session),
    result: f.resultText && inferStatus(raw, true) === 'result' ? f.resultText : undefined,
    updatedAt,
  };
};
