import type { RawUpdate } from '@stumpcast/shared';
import raw from '../config/selectors.crex.json';
import type { Adapter, AdapterInput } from '../adapter';
import { SelectorConfigSchema, type SelectorConfig } from './config';
import { createAdapter, MIN_CONFIDENCE, type AdapterHandle, type Diagnostics } from './engine';
import { RingBuffer } from './ringbuffer';

export const crexConfig: SelectorConfig = SelectorConfigSchema.parse(raw);

type ObjectRow = Record<string, unknown>;
type Fields = RawUpdate['fields'];

const text = (row: ObjectRow, key: string): string | undefined => {
  const value = row[key];
  return (typeof value === 'string' || typeof value === 'number') && String(value).trim()
    ? String(value).trim()
    : undefined;
};

const integer = (value: string | undefined): number | undefined => {
  if (value === undefined || !/^\d+$/.test(value)) return undefined;
  return Number(value);
};

const parts = (row: ObjectRow, key: string): string[] => text(row, key)?.split('.') ?? [];

const matchIdFor = (config: SelectorConfig, url: string): string => {
  if (config.matchIdRegex) {
    const match = new RegExp(config.matchIdRegex).exec(url);
    if (match?.[1]) return match[1];
  }
  return new URL(url).pathname.replace(/^\/+|\/+$/g, '').replace(/\//g, '-') || 'unknown';
};

const storageValue = (doc: Document, key: string): string | undefined => {
  try {
    return doc.defaultView?.localStorage.getItem(key)?.trim() || undefined;
  } catch {
    return undefined;
  }
};

const imageFor = (doc: Document, kind: 'players/org' | 'Teams', id: string): string | undefined => {
  if (!/^[a-zA-Z0-9]+$/.test(id)) return undefined;
  const suffix = `/${kind}/${id}.png`;
  const shown = [...doc.images].find((img) => {
    const src = img.getAttribute('src') ?? '';
    return src.includes(suffix);
  })?.getAttribute('src');
  return shown || `https://cricketvectors.akamaized.net/${kind}/${id}.png`;
};

const playerName = (doc: Document, id: string): string | undefined => {
  const mapped = storageValue(doc, `p_${id}_name`);
  if (mapped) return mapped;
  const label = [...doc.images]
    .find((img) => (img.getAttribute('src') ?? '').includes(`/players/org/${id}.png`))
    ?.getAttribute('alt')
    ?.replace(/\s+(?:logo|photo|picture|image)\s*$/i, '')
    .trim();
  return label || undefined;
};

const teamNamesFromMetadata = (doc: Document): string[] => {
  const description = doc.querySelector('meta[name="description"]')?.getAttribute('content') ?? '';
  const match = /^Track\s+(.+?)\s+vs\s+(.+?)\s+(?:\d|match\s)/i.exec(description);
  return match ? [match[1]!.trim(), match[2]!.trim()] : [];
};

const parseScore = (value: string | undefined): Fields['innings'][number] | undefined => {
  const match = /^(\d+)\/(\d{1,2})\((\d{1,3})(?:\.(\d))?/.exec(value ?? '');
  if (!match) return undefined;
  const wkts = Number(match[2]);
  const balls = Number(match[4] ?? 0);
  if (wkts > 10 || balls > 5) return undefined;
  return { team: '', runs: Number(match[1]), wkts, overs: Number(match[3]), balls };
};

const oversFromBalls = (total: number, ballsPerOver: number): { overs: number; balls: number } => ({
  overs: Math.floor(total / ballsPerOver),
  balls: total % ballsPerOver,
});

const recentBalls = (row: ObjectRow): { thisOver: string[]; lastBalls: string[] } => {
  const overs = Array.isArray(row.rb) ? row.rb.filter((x): x is ObjectRow => typeof x === 'object' && x !== null) : [];
  const legalOvers = overs.flatMap((over) =>
    Array.isArray(over.b)
      ? over.b.flatMap((ball) => {
          if (typeof ball !== 'object' || ball === null) return [];
          const token = text(ball as ObjectRow, 'u');
          return token ? [token] : [];
        })
      : [],
  );
  const current = overs.at(-1);
  const currentBalls = current && Array.isArray(current.b)
    ? current.b.flatMap((ball) => {
        if (typeof ball !== 'object' || ball === null) return [];
        const token = text(ball as ObjectRow, 'u');
        return token ? [token] : [];
      })
    : [];
  const compactCurrent = text(row, 'A')?.split('.').filter(Boolean) ?? [];
  const thisOver = currentBalls.length > 0 ? currentBalls : compactCurrent;
  return { thisOver, lastBalls: legalOvers.length > 0 ? legalOvers.slice(-12) : thisOver.slice(-12) };
};

const liveUpdate = (config: SelectorConfig, input: AdapterInput, row: ObjectRow): RawUpdate => {
  const matchId = matchIdFor(config, input.url);
  const state = text(row, 'i')?.split(/[(/.]+/) ?? [];
  const stateCode = integer(state[0]);
  const inningsIndex = integer(state[1]);
  if (stateCode === undefined || inningsIndex === undefined) throw new Error('Crex match state is missing');

  const formatCode = stateCode % 4;
  const format = formatCode === 0 ? 'T20' : formatCode === 1 ? 'ODI' : formatCode === 2 ? 'TEST' : 'OTHER';
  const day = format === 'TEST' ? (stateCode >= 12 ? Math.floor(stateCode / 12) + 1 : 1) : undefined;
  const matchState = stateCode >= 12 ? Math.floor((stateCode % 12) / 4) : Math.floor(stateCode / 4);
  const teamIds = parts(row, 'a').filter(Boolean);
  if (teamIds.length < 2) throw new Error('Crex team ids are missing');
  const metadataTeams = teamNamesFromMetadata(input.document);
  const teams = teamIds.slice(0, 2).map((id, index): Fields['teams'][number] => {
    const name = storageValue(input.document, `t_${id}_name`) ?? metadataTeams[index];
    if (!name) throw new Error(`Crex team name is missing for ${id}`);
    return {
      name,
      short: storageValue(input.document, `t_${id}_short`),
      logoUrl: imageFor(input.document, 'Teams', id),
    };
  });

  const firstBattingIndex = state[2] === '2' || state[2] === '3' ? 1 : 0;
  const firstTeam = teams[firstBattingIndex]!.name;
  const secondTeam = teams[1 - firstBattingIndex]!.name;
  const scoreKeys = inningsIndex === 0 ? ['j'] : inningsIndex === 1 ? ['j', 'k'] : ['j', 'k', 'J', 'K'];
  const innings: Fields['innings'] = [];
  const inningsByKey = new Map<string, Fields['innings'][number]>();
  for (const [index, key] of scoreKeys.entries()) {
    const score = parseScore(text(row, key));
    if (!score) continue;
    if (index < 2) score.team = index === 0 ? firstTeam : secondTeam;
    innings.push(score);
    inningsByKey.set(key, score);
  }

  let currentBattingTeam = inningsIndex % 2 === 0 ? firstTeam : secondTeam;
  if (inningsIndex >= 2) {
    const declaredState = integer(state[3]);
    if (format === 'TEST' && inningsIndex === 2) {
      currentBattingTeam = declaredState === 3 ? secondTeam : firstTeam;
    } else if (format === 'TEST' && inningsIndex === 3) {
      currentBattingTeam = declaredState === 4 ? firstTeam : secondTeam;
    }
    const currentKey = inningsIndex % 2 === 0 ? 'J' : 'K';
    const current = inningsByKey.get(currentKey);
    if (current) current.team = currentBattingTeam;
    const previousThird = inningsByKey.get('J');
    if (previousThird && previousThird !== current) {
      previousThird.team = currentBattingTeam === firstTeam ? secondTeam : firstTeam;
    }
  }
  for (const score of innings) {
    if (!score.team) score.team = currentBattingTeam;
  }

  const ballsPerOver = text(row, 'hb') === '1' ? 5 : 6;
  const batterIds = text(row, 'p')?.replaceAll('*', '').split('.') ?? [];
  const rawBatterStats = [text(row, 'q'), text(row, 's')];
  const batterStats = rawBatterStats.map((value) => value?.replaceAll('*', '').split('.') ?? []);
  const boundaries = [parts(row, 'r'), parts(row, 't')];
  const batters = batterIds.slice(0, 2).flatMap((id, index): Fields['batters'] => {
    const name = playerName(input.document, id);
    const runs = integer(batterStats[index]?.[0]);
    const balls = integer(batterStats[index]?.[1]);
    if (!name || runs === undefined || balls === undefined) return [];
    return [{
      name,
      runs,
      balls,
      fours: integer(boundaries[index]?.[0]),
      sixes: integer(boundaries[index]?.[1]),
      ...(rawBatterStats[index]?.endsWith('*') ? { onStrike: true } : {}),
      imageUrl: imageFor(input.document, 'players/org', id),
    }];
  });

  let bowler: Fields['bowler'];
  const bowlerId = text(row, 'b');
  const bowlerName = bowlerId ? playerName(input.document, bowlerId) : undefined;
  const bowling = parts(row, 'c');
  const bowlerRuns = integer(bowling[0]);
  const bowlerBalls = integer(bowling[1]);
  const bowlerWkts = integer(bowling[2]);
  if (bowlerId && bowlerName && bowlerRuns !== undefined && bowlerBalls !== undefined && bowlerWkts !== undefined && bowlerWkts <= 10) {
    bowler = {
      name: bowlerName,
      ...oversFromBalls(bowlerBalls, ballsPerOver),
      maidens: 0,
      runs: bowlerRuns,
      wkts: bowlerWkts,
      imageUrl: imageFor(input.document, 'players/org', bowlerId),
    };
  }

  const current = innings.at(-1);
  let partnership: Fields['partnership'];
  const lastWicket = parts(row, 'x');
  const wicketRuns = integer(lastWicket[3]);
  const wicketBalls = integer(lastWicket[4]);
  if (current && wicketRuns !== undefined && wicketBalls !== undefined) {
    const totalBalls = current.overs * ballsPerOver + current.balls;
    partnership = {
      runs: Math.max(0, current.runs - wicketRuns),
      balls: Math.max(0, totalBalls - wicketBalls),
    };
  }

  let target: number | undefined;
  if (inningsIndex === 1 && innings[0]) {
    const configuredTarget = integer(parts(row, 'T')[1]);
    target = configuredTarget ?? innings[0].runs + 1;
  }
  const currentBalls = current ? current.overs * ballsPerOver + current.balls : 0;
  const crr = current && currentBalls > 0 ? Number((current.runs * ballsPerOver / currentBalls).toFixed(2)) : undefined;
  const totalBalls = integer(parts(row, 'T')[0]) ?? (format === 'T20' ? 120 : format === 'ODI' ? 300 : undefined);
  const rrr = target && current && totalBalls && totalBalls > currentBalls
    ? Number(((target - current.runs) * ballsPerOver / (totalBalls - currentBalls)).toFixed(2))
    : undefined;

  const breakCode = text(row, 'w')?.split('/')[1];
  const status = matchState === 0 ? 'Match yet to start' : matchState === 2 ? 'Match completed'
    : breakCode === '0' ? 'Lunch Break' : breakCode === '1' ? 'Tea Break' : breakCode === '2' ? 'Stumps'
      : text(row, 'B') === 'i' ? 'Innings Break' : 'Live';
  const description = input.document.querySelector('meta[name="description"]')?.getAttribute('content') ?? '';
  const venue = / from (.+?) with ball by ball commentary/i.exec(description)?.[1]?.trim();
  const balls = recentBalls(row);
  const missing = current ? [] : ['score', 'overs'];
  return {
    source: 'crex',
    matchId,
    url: input.url,
    capturedAt: input.now,
    confidence: current ? 1 : 0,
    fields: {
      title: `${teams[0]!.name} vs ${teams[1]!.name}`,
      status,
      venue,
      teams,
      innings,
      batters,
      bowler,
      ...balls,
      partnership,
      target,
      crr,
      rrr,
      day,
      format,
      oversLimit: totalBalls ? totalBalls / ballsPerOver : undefined,
      preMatch: matchState === 0 || undefined,
    },
    missing,
  };
};

const createLiveAdapter = (config: SelectorConfig): AdapterHandle => {
  const errors = new RingBuffer<{ at: number; message: string }>(200);
  let diagnostics: Diagnostics | undefined;
  const adapter: Adapter = (input) => {
    const matchId = matchIdFor(config, input.url);
    const tap = input.taps.find((candidate) => {
      try {
        const url = new URL(candidate.url);
        return url.hostname === 'api.goscorer.com' && url.pathname === '/api/v3/getSV3' && url.searchParams.get('key') === matchId;
      } catch {
        return false;
      }
    });
    if (!tap || typeof tap.json !== 'object' || tap.json === null || Array.isArray(tap.json)) {
      return {
        source: 'crex', matchId, url: input.url, capturedAt: input.now, confidence: 0,
        fields: { teams: [], innings: [], batters: [], thisOver: [], lastBalls: [] },
        missing: ['score', 'overs'],
      };
    }
    try {
      const update = liveUpdate(config, input, tap.json as ObjectRow);
      diagnostics = {
        strategy: update.confidence > 0 ? 'json' : 'none',
        jsonConfidence: update.confidence,
        domConfidence: 0,
        missing: update.missing,
      };
      return update;
    } catch (error) {
      errors.push({ at: input.now, message: error instanceof Error ? error.message : String(error) });
      diagnostics = { strategy: 'none', jsonConfidence: 0, domConfidence: 0, missing: ['score', 'overs'] };
      return {
        source: 'crex', matchId, url: input.url, capturedAt: input.now, confidence: 0,
        fields: { teams: [], innings: [], batters: [], thisOver: [], lastBalls: [] },
        missing: ['score', 'overs'],
      };
    }
  };
  return { adapter, diagnostics: () => diagnostics, errors };
};

export const createCrexAdapter = (config: SelectorConfig = crexConfig): AdapterHandle => {
  const fallback = createAdapter(config);
  const live = createLiveAdapter(config);
  let usedLive = false;
  return {
    adapter: (input) => {
      usedLive = /\/cricket-live-score\//.test(new URL(input.url).pathname);
      if (!usedLive) return fallback.adapter(input);
      const update = live.adapter(input);
      return update.confidence >= MIN_CONFIDENCE ? update : fallback.adapter(input);
    },
    diagnostics: () => usedLive ? live.diagnostics() : fallback.diagnostics(),
    errors: fallback.errors,
  };
};
