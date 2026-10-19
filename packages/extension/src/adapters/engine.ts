import type { RawUpdate } from '@stumpcast/shared';
import type { Adapter, AdapterInput, TapResponse } from '../adapter';
import type { DomRule, FieldKey, SelectorConfig } from './config';
import { readPath } from './jsonpath';
import {
  cleanPlayerName,
  parseBallTokens,
  parseDayStatus,
  parseInteger,
  parseNumber,
  parseOvers,
  parsePartnership,
  parseScore,
} from './normalise';
import { RingBuffer } from './ringbuffer';

/** Below this the content script reports `adapter-degraded` instead of a score update. */
export const MIN_CONFIDENCE = 0.5;
/** Upper bound for a limited-overs innings (ODI); Tests are exempt when a day is known. */
const MAX_LIMITED_OVERS = 50;

export type Strategy = 'json' | 'dom' | 'none';
type Raw = Partial<Record<FieldKey, string>>;
type Fields = RawUpdate['fields'];

export const isDegraded = (u: RawUpdate): boolean => u.confidence < MIN_CONFIDENCE;

const compiledUrlPatterns = (patterns: string[]): RegExp[] =>
  patterns
    .map((p) => {
      try {
        return new RegExp(p);
      } catch {
        return null;
      }
    })
    .filter((re): re is RegExp => re !== null);

export const urlMatches = (config: SelectorConfig, url: string): boolean =>
  compiledUrlPatterns(config.urlPatterns).some((re) => re.test(url));

// ---- extraction ---------------------------------------------------------------------------

const applyTransform = (value: string, t: DomRule['transform']): string => {
  switch (t) {
    case 'trim':
      return value.trim();
    case 'lower':
      return value.toLowerCase();
    case 'upper':
      return value.toUpperCase();
    case 'digits':
      return value.replace(/\D+/g, '');
    case 'number':
      return String(parseNumber(value) ?? '');
    default:
      return value;
  }
};

export const extractJson = (config: SelectorConfig, taps: TapResponse[]): Raw => {
  const out: Raw = {};
  for (const tap of config.jsonTaps) {
    const re = new RegExp(tap.urlRegex);
    for (const response of taps) {
      if (!re.test(response.url)) continue;
      for (const [field, path] of Object.entries(tap.map)) {
        if (!path) continue;
        const v = readPath(response.json, path);
        if ((typeof v === 'string' || typeof v === 'number') && String(v).trim() !== '') {
          out[field as FieldKey] ??= String(v).trim();
        }
      }
    }
  }
  return out;
};

export const extractDom = (config: SelectorConfig, doc: Document): Raw => {
  const out: Raw = {};
  for (const [field, rule] of Object.entries(config.dom) as [FieldKey, DomRule][]) {
    for (const selector of rule.selectors) {
      let el: Element | null = null;
      try {
        el = doc.querySelector(selector);
      } catch {
        continue; // invalid selector in a remote config must not break the others
      }
      if (!el) continue;
      let value = (rule.attr ? el.getAttribute(rule.attr) : el.textContent)?.trim() ?? '';
      if (rule.regex) {
        const m = new RegExp(rule.regex).exec(value);
        value = m ? (m[1] ?? m[0]) : '';
      }
      if (rule.transform) value = applyTransform(value, rule.transform);
      if (value) {
        out[field] = value;
        break;
      }
    }
  }
  return out;
};

// ---- normalisation ------------------------------------------------------------------------

interface Normalised {
  fields: Fields;
  passed: Set<FieldKey>;
}

interface Prev {
  inningsCount: number;
  runs: number;
}

const normalise = (raw: Raw, prev: Prev | undefined, site = 'cricbuzz'): Normalised => {
  const passed = new Set<FieldKey>();
  const pass = (k: FieldKey, ok: boolean) => {
    if (ok) passed.add(k);
  };
  const text = (k: FieldKey) => raw[k];
  const dayStatus = parseDayStatus(text('status'));
  const day = parseInteger(text('day')) ?? dayStatus?.day;
  const isTest = day !== undefined;
  const maxOvers = isTest ? Infinity : MAX_LIMITED_OVERS;

  const cleanTeam = (t: string | undefined): string | undefined => {
    if (!t) return undefined;
    if (/(?:p'?ship|crr|rrr|%|\b(?:AM|PM|GMT|LOCAL)\b|\d{1,2}:\d{2})/i.test(t)) return undefined;
    return t.trim();
  };

  let team1Name = cleanTeam(text('team1'));
  let team2Name = cleanTeam(text('team2'));
  const rawTitle = text('title') ?? '';
  if (site === 'cricbuzz' && !team1Name && !team2Name && rawTitle) {
    const tm = /^([A-Za-z0-9 .'-]+?)\s+(?:vs\.?|v)\s+([A-Za-z0-9 .'-]+?)(?:,|-|\(|\||$)/i.exec(rawTitle);
    if (tm) {
      team1Name = cleanTeam(tm[1]);
      team2Name = cleanTeam(tm[2]);
    }
  }

  for (const k of ['title', 'status', 'venue', 'toss', 'battingTeam'] as const) {
    pass(k, Boolean(text(k)));
  }
  pass('team1', Boolean(team1Name));
  pass('team2', Boolean(team2Name));

  // Innings totals.
  const innings: Fields['innings'] = [];
  const slots: { team?: FieldKey; score: FieldKey; overs?: FieldKey }[] = [1, 2, 3, 4].map((n) => ({
    team: `inn${n}.team` as FieldKey,
    score: `inn${n}.score` as FieldKey,
    overs: `inn${n}.overs` as FieldKey,
  }));
  const hasNumbered = slots.some((s) => text(s.score) !== undefined);
  const active = hasNumbered
    ? slots
    : [{ team: 'battingTeam' as FieldKey, score: 'score' as FieldKey, overs: 'overs' as FieldKey }];
  for (const slot of active) {
    const rawScore = text(slot.score);
    const score =
      parseScore(rawScore) ??
      (isTest || hasNumbered ? parseScore(rawScore, { allowBare: true }) : undefined);
    let overs = slot.overs ? parseOvers(text(slot.overs)) : undefined;
    if (!overs && rawScore) {
      const oversFromScore = /\(\s*(\d{1,3}(?:\.\d)?)\s*(?:ov(?:ers?)?|ovs?)?\s*\)/i.exec(rawScore);
      if (oversFromScore?.[1]) {
        overs = parseOvers(oversFromScore[1]);
      }
    }
    // Overs are checked on their own so a broken score selector does not hide a good one.
    if (overs && overs.overs <= maxOvers) {
      if (slot.overs) pass(slot.overs, true);
      pass('overs', true);
    }
    if (!score) continue;
    innings.push({
      team: (slot.team && text(slot.team)) || text('battingTeam') || text('team1') || '',
      runs: score.runs,
      wkts: score.wkts,
      overs: overs?.overs ?? 0,
      balls: overs?.balls ?? 0,
    });
    pass(slot.score, true);
    pass('score', true);
  }
  // Sanity: runs never go backwards within the same innings.
  const last = innings.at(-1);
  if (last && prev && prev.inningsCount === innings.length && last.runs < prev.runs) {
    passed.delete('score');
    passed.delete(`inn${innings.length}.score` as FieldKey);
  }

  // Pre-match / toss support: when match hasn't started yet, generate a 0/0 (0 ov) initial innings
  const rawStatus = text('status') ?? '';
  const rawToss = text('toss') ?? '';
  const isPreMatch =
    /(?:opt|toss|preview|starts|delayed|yet to start)/i.test(rawStatus) ||
    /(?:opt|toss|won the toss)/i.test(rawToss) ||
    Boolean(rawToss);

  if (innings.length === 0 && (isPreMatch || (!text('score') && !text('overs'))) && (rawTitle || team1Name)) {
    const tossWinner = rawToss
      ? team1Name && rawToss.toLowerCase().includes(team1Name.toLowerCase())
        ? team1Name
        : team2Name && rawToss.toLowerCase().includes(team2Name.toLowerCase())
          ? team2Name
          : undefined
      : undefined;
    const statusWinner = rawStatus
      ? team1Name && new RegExp(`\\b${team1Name}\\b`, 'i').test(rawStatus)
        ? team1Name
        : team2Name && new RegExp(`\\b${team2Name}\\b`, 'i').test(rawStatus)
          ? team2Name
          : undefined
      : undefined;
    const teamName =
      site === 'crex'
        ? (text('battingTeam') || '')
        : (tossWinner || statusWinner || text('battingTeam') || team1Name || 'Batting');
    innings.push({
      team: teamName,
      runs: 0,
      wkts: 0,
      overs: 0,
      balls: 0,
    });
    pass('score', true);
    pass('overs', true);
  }

  // Batters and bowler.
  const batters: Fields['batters'] = [];
  for (const n of [1, 2] as const) {
    const name = cleanPlayerName(text(`batter${n}.name` as FieldKey));
    const runs = parseInteger(text(`batter${n}.runs` as FieldKey));
    const balls = parseInteger(text(`batter${n}.balls` as FieldKey));
    pass(`batter${n}.name` as FieldKey, Boolean(name));
    pass(`batter${n}.runs` as FieldKey, runs !== undefined);
    pass(`batter${n}.balls` as FieldKey, balls !== undefined);
    if (!name || runs === undefined || balls === undefined) continue;
    const b: Fields['batters'][number] = {
      name: name.name,
      runs,
      balls,
      fours: parseInteger(text(`batter${n}.fours` as FieldKey)),
      sixes: parseInteger(text(`batter${n}.sixes` as FieldKey)),
    };
    if (name.onStrike) b.onStrike = true;
    batters.push(b);
  }

  let bowler: Fields['bowler'];
  const bowlerName = cleanPlayerName(text('bowler.name'));
  const bowlerOvers = parseOvers(text('bowler.overs'));
  const bowlerRuns = parseInteger(text('bowler.runs'));
  const bowlerWkts = parseInteger(text('bowler.wkts'));
  if (bowlerName && bowlerOvers && bowlerRuns !== undefined && bowlerWkts !== undefined) {
    if (bowlerWkts <= 10) {
      bowler = {
        name: bowlerName.name,
        overs: bowlerOvers.overs,
        balls: bowlerOvers.balls,
        maidens: parseInteger(text('bowler.maidens')) ?? 0,
        runs: bowlerRuns,
        wkts: bowlerWkts,
      };
      for (const k of ['bowler.name', 'bowler.overs', 'bowler.runs', 'bowler.wkts'] as const) {
        pass(k, true);
      }
    }
  }

  const thisOver = parseBallTokens(text('thisOver'));
  const lastBalls = parseBallTokens(text('lastBalls'));
  pass('thisOver', thisOver.length > 0);
  pass('lastBalls', lastBalls.length > 0);

  const partnership = parsePartnership(text('partnership'));
  pass('partnership', partnership !== undefined);

  const target = parseInteger(text('target'));
  const crr = parseNumber(text('crr'));
  const rrr = parseNumber(text('rrr'));
  pass('target', target !== undefined && target > 0);
  pass('crr', crr !== undefined && crr >= 0);
  pass('rrr', rrr !== undefined && rrr >= 0);
  pass('day', isTest);
  pass('session', Boolean(text('session') ?? dayStatus?.session));
  pass('resultText', Boolean(text('resultText') ?? dayStatus?.resultText));
  pass('commentaryLast', Boolean(text('commentaryLast')));

  const teams = (site === 'crex' ? [cleanTeam(text('team1')), cleanTeam(text('team2'))] : [team1Name, team2Name])
    .filter((t): t is string => Boolean(t))
    .map((name) => ({ name }));

  const fields: Fields = {
    title: text('title'),
    status: text('status'),
    venue: text('venue'),
    teams,
    innings,
    batters,
    bowler,
    thisOver,
    lastBalls,
    ...(text('toss') ? { toss: text('toss') } : {}),
    ...(partnership ? { partnership } : {}),
    ...(target !== undefined && target > 0 ? { target } : {}),
    ...(crr !== undefined && crr >= 0 ? { crr } : {}),
    ...(rrr !== undefined && rrr >= 0 ? { rrr } : {}),
    ...(day !== undefined ? { day } : {}),
    ...(text('session') || dayStatus?.session ? { session: text('session') ?? dayStatus?.session } : {}),
    ...(text('resultText') || dayStatus?.resultText ? { resultText: text('resultText') ?? dayStatus?.resultText } : {}),
    ...(text('commentaryLast') ? { commentaryLast: text('commentaryLast') } : {}),
  };
  return { fields, passed };
};

const confidenceOf = (config: SelectorConfig, passed: Set<FieldKey>): number => {
  const required = config.minConfidenceFields;
  if (required.length === 0) return 0; // an unconfigured adapter is never "confident"
  return required.filter((k) => passed.has(k)).length / required.length;
};

// ---- adapter factory ----------------------------------------------------------------------

const matchIdFor = (config: SelectorConfig, url: string): string => {
  if (config.matchIdRegex) {
    const m = new RegExp(config.matchIdRegex).exec(url);
    if (m?.[1]) return m[1];
  }
  try {
    const p = new URL(url).pathname.replace(/^\/+|\/+$/g, '').replace(/\//g, '-');
    return p || 'unknown';
  } catch {
    return 'unknown';
  }
};

export interface Diagnostics {
  strategy: Strategy;
  jsonConfidence: number;
  domConfidence: number;
  missing: string[];
}

export interface AdapterHandle {
  adapter: Adapter;
  /** Diagnostics for the most recent run. */
  diagnostics(): Diagnostics | undefined;
  /** Errors caught instead of thrown (last 200). */
  errors: RingBuffer<{ at: number; message: string }>;
}

/** Build an adapter that interprets `config`; no site-specific logic lives here. */
export const createAdapter = (config: SelectorConfig): AdapterHandle => {
  const errors = new RingBuffer<{ at: number; message: string }>(200);
  const previous = new Map<string, Prev>();
  let last: Diagnostics | undefined;

  const adapter: Adapter = (input: AdapterInput): RawUpdate => {
    const matchId = matchIdFor(config, input.url);
    const empty = (): RawUpdate => ({
      source: config.site,
      matchId,
      url: input.url,
      capturedAt: input.now,
      confidence: 0,
      fields: { teams: [], innings: [], batters: [], thisOver: [], lastBalls: [] },
      missing: [...config.minConfidenceFields],
    });

    try {
      const prev = previous.get(matchId);
      const json = normalise(extractJson(config, input.taps), prev, config.site);
      const dom = normalise(extractDom(config, input.document), prev, config.site);
      const jsonConf = confidenceOf(config, json.passed);
      const domConf = confidenceOf(config, dom.passed);

      // Prefer JSON unless the DOM is strictly better.
      const useJson = jsonConf > 0 && jsonConf >= domConf;
      const chosen = useJson ? json : dom;
      const confidence = useJson ? jsonConf : domConf;
      const strategy: Strategy = confidence === 0 ? 'none' : useJson ? 'json' : 'dom';
      const missing = config.minConfidenceFields.filter((k) => !chosen.passed.has(k));
      last = { strategy, jsonConfidence: jsonConf, domConfidence: domConf, missing };

      const inn = chosen.fields.innings.at(-1);
      if (confidence >= MIN_CONFIDENCE && inn) {
        previous.set(matchId, {
          inningsCount: chosen.fields.innings.length,
          runs: inn.runs,
        });
      }
      return {
        source: config.site,
        matchId,
        url: input.url,
        capturedAt: input.now,
        confidence,
        fields: chosen.fields,
        missing,
      };
    } catch (err) {
      errors.push({ at: input.now, message: err instanceof Error ? err.message : String(err) });
      last = { strategy: 'none', jsonConfidence: 0, domConfidence: 0, missing: [] };
      return empty();
    }
  };

  return { adapter, diagnostics: () => last, errors };
};
