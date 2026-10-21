import type { RawUpdate } from '@stumpcast/shared';
import type { Adapter, AdapterInput, TapResponse } from '../adapter';
import type { DomRule, FieldKey, SelectorConfig } from './config';
import { readPath } from './jsonpath';
import {
  cleanPlayerName,
  looksLikeScore,
  looksLikeToss,
  parseBallTokens,
  parseDayStatus,
  parseInteger,
  parseNumber,
  parseOvers,
  parsePartnership,
  parseScore,
  type Overs,
  type RunsWkts,
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

/**
 * Read one `jsonTaps` value. A plain path returns the value at that path; a `${path}` template
 * returns the composed text, but only when every placeholder resolved — half a score is worse
 * than no score, because "197/" would parse as a bare total.
 */
const readTapValue = (json: unknown, spec: string): string | undefined => {
  if (!spec.includes('${')) {
    const v = readPath(json, spec);
    return (typeof v === 'string' || typeof v === 'number') && String(v).trim() !== ''
      ? String(v).trim()
      : undefined;
  }
  let missing = false;
  const out = spec.replace(/\$\{([^{}]*)\}/g, (_match, path: string) => {
    const v = readTapValue(json, path.trim());
    if (v === undefined) {
      missing = true;
      return '';
    }
    return v;
  });
  return missing || out.trim() === '' ? undefined : out.trim();
};

export const extractJson = (config: SelectorConfig, taps: TapResponse[]): Raw => {
  const out: Raw = {};
  for (const tap of config.jsonTaps) {
    const re = new RegExp(tap.urlRegex);
    for (const response of taps) {
      if (!re.test(response.url)) continue;
      for (const [field, path] of Object.entries(tap.map)) {
        if (!path) continue;
        const v = readTapValue(response.json, path);
        if (v !== undefined) out[field as FieldKey] ??= v;
      }
    }
  }
  return out;
};

const cleanPageTitle = (raw: string): string =>
  raw
    .replace(/\s*\|\s*cricbuzz.*$/i, '')
    .replace(/\s*Live Cricket Stream.*$/i, '')
    .replace(/\s*Live Cricket Score.*$/i, '')
    .replace(/\s*-\s*(?:commentary|scorecard|live score|preview|match facts).*$/i, '')
    .replace(/^(?:live cricket score|commentary)\s*[-•:]\s*/i, '')
    .trim();

const squashed = (s: string | null | undefined): string =>
  (s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

/** A labelled strip keeps its caption in the element right before it, or as a leading child. */
const hasLabel = (el: Element, label: string): boolean => {
  const want = squashed(label);
  if (el.previousElementSibling && squashed(el.previousElementSibling.textContent).includes(want)) {
    return true;
  }
  const parent = el.parentElement;
  if (!parent) return false;
  const leading = [...parent.children]
    .slice(0, 2)
    .map((c) => squashed(c.textContent))
    .join(' ');
  return leading.includes(want);
};

export const extractDom = (config: SelectorConfig, doc: Document): Raw => {
  const out: Raw = {};
  for (const [field, rule] of Object.entries(config.dom) as [FieldKey, DomRule][]) {
    for (const selector of rule.selectors) {
      let candidates: Element[] = [];
      const label = rule.label;
      try {
        const all = Array.from(doc.querySelectorAll(selector));
        candidates = label ? all.filter((el) => hasLabel(el, label)) : all.slice(0, 1);
      } catch {
        continue; // invalid selector in a remote config must not break the others
      }
      for (const el of candidates) {
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
      if (out[field]) break;
    }
  }

  // Smart hierarchical fallback: JSON-LD SportsEvent metadata
  try {
    const ldJsonScripts = doc.querySelectorAll('script[type="application/ld+json"]');
    for (const s of ldJsonScripts) {
      if (!s.textContent) continue;
      const data = JSON.parse(s.textContent) as Record<string, unknown>;
      if (data['@type'] === 'SportsEvent' || Array.isArray(data.competitor)) {
        if (typeof data.name === 'string' && data.name.trim()) {
          const cleanedName = cleanPageTitle(data.name);
          if (cleanedName && (!out.title || (!out.title.includes('vs') && !out.title.includes('v ')))) {
            out.title = cleanedName;
          }
        }
        if (Array.isArray(data.competitor) && data.competitor.length >= 2) {
          const c0 = (data.competitor[0] as { name?: string })?.name;
          const c1 = (data.competitor[1] as { name?: string })?.name;
          if (c0 && !out.team1) out.team1 = c0.trim();
          if (c1 && !out.team2) out.team2 = c1.trim();
        }
      }
    }
  } catch {
    /* JSON-LD parse failed; ignore */
  }

  // OG / Document title fallback
  if (!out.title || (!out.title.includes('vs') && !out.title.includes('v '))) {
    const metaTitle =
      doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ??
      doc.querySelector('meta[name="twitter:title"]')?.getAttribute('content') ??
      doc.title;
    if (metaTitle) {
      const cleanMeta = cleanPageTitle(metaTitle);
      if (cleanMeta && (cleanMeta.includes(' vs') || cleanMeta.includes(' v '))) {
        out.title = cleanMeta;
      }
    }
  }

  return out;
};

// ---- normalisation ------------------------------------------------------------------------

interface Normalised {
  fields: Fields;
  passed: Set<FieldKey>;
  /** True when the only innings is the invented 0-0 of a match that has not started. */
  synthetic: boolean;
}

interface Prev {
  inningsCount: number;
  runs: number;
}

const FORMATS = ['T20', 'ODI', 'TEST', 'OTHER'] as const;

const normalise = (raw: Raw, prev: Prev | undefined, site = 'cricbuzz', url = ''): Normalised => {
  const passed = new Set<FieldKey>();
  const pass = (k: FieldKey, ok: boolean) => {
    if (ok) passed.add(k);
  };
  const text = (k: FieldKey) => raw[k];
  /**
   * A scraped picture. Absolute http(s) only, so whatever a page puts in an `src` can never reach
   * the server as anything but an image URL.
   */
  const picture = (k: FieldKey): string | undefined => {
    const v = text(k)?.trim();
    return v && /^https?:\/\/\S+$/i.test(v) ? v : undefined;
  };
  const dayStatus = parseDayStatus(text('status'));
  const day = parseInteger(text('day')) ?? dayStatus?.day;
  const isTest = day !== undefined;
  const maxOvers = isTest ? Infinity : MAX_LIMITED_OVERS;

  const cleanTeam = (t: string | undefined): string | undefined => {
    if (!t) return undefined;
    if (looksLikeScore(t)) return undefined;
    if (/(?:p'?ship|crr|rrr|%|\b(?:AM|PM|GMT|LOCAL)\b|\d{1,2}:\d{2})/i.test(t)) return undefined;
    return t.trim();
  };

  let team1Name = cleanTeam(text('team1'));
  let team2Name = cleanTeam(text('team2'));
  const rawTitle = text('title') ?? '';
  if (site === 'cricbuzz' && rawTitle) {
    const tm = /(?:^|[-•:|]\s*|\b)([A-Za-z0-9 .\x27]+?)\s+(?:vs\.?|v)\s+([A-Za-z0-9 .\x27]+?)(?:,|-|\(|\||$)/i.exec(rawTitle);
    if (tm) {
      const t1 = cleanTeam(tm[1]);
      const t2 = cleanTeam(tm[2]);
      if (!team1Name && !team2Name) {
        team1Name = t1;
        team2Name = t2;
      } else if (!team2Name) {
        team2Name = team1Name?.toLowerCase() === t1?.toLowerCase() ? t2 : t1;
      } else if (!team1Name) {
        team1Name = team2Name?.toLowerCase() === t2?.toLowerCase() ? t1 : t2;
      } else if (team1Name === team2Name) {
        team1Name = t1;
        team2Name = t2;
      }
    }
  }

  // URL slug fallback for teams: e.g. /172680/afg-vs-zim-2nd-match
  if ((!team1Name || !team2Name) && url) {
    const urlMatch = /\/(?:live-cricket-scores|cricket-scores|cricket-commentary)\/\d+\/([a-z0-9]+)-vs-([a-z0-9]+)/i.exec(url);
    if (urlMatch) {
      if (!team1Name && urlMatch[1]) team1Name = urlMatch[1].toUpperCase();
      if (!team2Name && urlMatch[2]) team2Name = urlMatch[2].toUpperCase();
    }
  }

  // Header/table cells can land in the toss slot ("BatterRB4s6sSR", "GMT"), so only a real
  // toss sentence is kept.
  const tossText = looksLikeToss(text('toss')) ? text('toss') : undefined;

  for (const k of ['title', 'status', 'venue', 'battingTeam'] as const) {
    pass(k, Boolean(text(k)));
  }
  pass('toss', Boolean(tossText));
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
  const teamNameOf = (slot: (typeof active)[number]): string => {
    const candidates = [slot.team && text(slot.team), text('battingTeam'), text('team1')].filter(
      (c): c is string => Boolean(c),
    );
    return candidates.find((c) => !looksLikeScore(c) && !looksLikeToss(c)) ?? '';
  };

  interface Row {
    team: string;
    score: RunsWkts;
    overs: Overs | undefined;
    slot: (typeof active)[number];
  }
  const rows: Row[] = [];
  for (const slot of active) {
    const rawScore = text(slot.score);
    const score =
      parseScore(rawScore) ??
      (isTest || hasNumbered ? parseScore(rawScore, { allowBare: true }) : undefined);
    if (!score) continue;
    let overs = slot.overs ? parseOvers(text(slot.overs)) : undefined;
    if (!overs && rawScore) {
      const oversFromScore = /\(\s*(\d{1,3}(?:\.\d)?)\s*(?:ov(?:ers?)?|ovs?)?\s*\)/i.exec(rawScore);
      if (oversFromScore?.[1]) {
        overs = parseOvers(oversFromScore[1]);
      }
    }
    rows.push({ team: teamNameOf(slot), score, overs, slot });
  }

  let oversUnresolved = false;
  rows.forEach((row, i) => {
    // A bare total only means "all out" when the innings has already closed; the live innings
    // always shows wickets, so an unknown wicket count there is a broken selector, not a fact.
    const wkts =
      row.score.wkts ?? (i < rows.length - 1 ? 10 : undefined);
    if (wkts === undefined) {
      oversUnresolved = true;
      return;
    }
    // Overs are checked on their own so a broken score selector does not hide a good one.
    const oversOk = row.overs && row.overs.overs <= maxOvers ? row.overs : undefined;
    if (!oversOk) oversUnresolved = true;
    innings.push({
      team: row.team,
      runs: row.score.runs,
      wkts,
      overs: row.overs?.overs ?? 0,
      balls: row.overs?.balls ?? 0,
    });
    pass(row.slot.score, true);
    pass('score', true);
    if (oversOk) {
      if (row.slot.overs) pass(row.slot.overs, true);
      pass('overs', true);
    }
  });
  // An innings rendered with 0.0 overs is a lie on air, so the whole reading loses that credit.
  if (innings.length > 0 && oversUnresolved) passed.delete('overs');
  // Sanity: runs never go backwards within the same innings.
  const last = innings.at(-1);
  if (last && prev && prev.inningsCount === innings.length && last.runs < prev.runs) {
    passed.delete('score');
    passed.delete(`inn${innings.length}.score` as FieldKey);
  }

  // Pre-match / toss support: when match hasn't started yet, generate a 0/0 (0 ov) initial innings
  const rawStatus = text('status') ?? '';
  // Only the page's own words may claim a match has not started. A blank read looks identical to
  // a preview once every selector misses, and inventing a confident 0-0 match is how placeholder
  // rows ("Batting vs Team B") reached the studio.
  const isPreMatch =
    /(?:opt|toss|preview|starts|delayed|yet to start)/i.test(rawStatus) || Boolean(tossText);
  let synthetic = false;

  if (innings.length === 0 && isPreMatch && (rawTitle || team1Name)) {
    const tossWinner = tossText
      ? team1Name && tossText.toLowerCase().includes(team1Name.toLowerCase())
        ? team1Name
        : team2Name && tossText.toLowerCase().includes(team2Name.toLowerCase())
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
    const rawBattingTeam = text('battingTeam');
    const battingTeamName =
      rawBattingTeam && !looksLikeScore(rawBattingTeam) ? rawBattingTeam : undefined;
    const teamName =
      site === 'crex'
        ? (battingTeamName ?? '')
        : (tossWinner || statusWinner || battingTeamName || team1Name || 'Batting');
    innings.push({
      team: teamName,
      runs: 0,
      wkts: 0,
      overs: 0,
      balls: 0,
    });
    pass('score', true);
    pass('overs', true);
    synthetic = true;
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
    const photo = picture(`batter${n}.photo` as FieldKey);
    if (photo) b.imageUrl = photo;
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
      const photo = picture('bowler.photo');
      if (photo) bowler.imageUrl = photo;
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

  // Zip before dropping: filtering the names first would pair a crest with the wrong team.
  const teamNames =
    site === 'crex' ? [cleanTeam(text('team1')), cleanTeam(text('team2'))] : [team1Name, team2Name];
  const teamLogos = [picture('team1.logo'), picture('team2.logo')];
  const teams = teamNames
    .map((name, i): { name: string; logoUrl?: string } | null =>
      name ? { name, ...(teamLogos[i] ? { logoUrl: teamLogos[i] } : {}) } : null,
    )
    .filter((t): t is { name: string; logoUrl?: string } => t !== null);

  // A source that states the format is better than guessing from the page title, and the format
  // is what fixes the overs limit for every chase calculation downstream.
  const scrapedFormat = FORMATS.find((x) => x === text('format')?.trim().toUpperCase());
  pass('format', scrapedFormat !== undefined);

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
    ...(tossText ? { toss: tossText } : {}),
    ...(partnership ? { partnership } : {}),
    ...(target !== undefined && target > 0 ? { target } : {}),
    ...(crr !== undefined && crr >= 0 ? { crr } : {}),
    ...(rrr !== undefined && rrr >= 0 ? { rrr } : {}),
    ...(day !== undefined ? { day } : {}),
    ...(text('session') || dayStatus?.session ? { session: text('session') ?? dayStatus?.session } : {}),
    ...(text('resultText') || dayStatus?.resultText ? { resultText: text('resultText') ?? dayStatus?.resultText } : {}),
    ...(text('commentaryLast') ? { commentaryLast: text('commentaryLast') } : {}),
    ...(scrapedFormat ? { format: scrapedFormat } : {}),
    ...(synthetic ? { preMatch: true } : {}),
  };
  return { fields, passed, synthetic };
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
      const rawJson = extractJson(config, input.taps);
      const domRaw = extractDom(config, input.document);
      const json = normalise(rawJson, prev, config.site);
      const dom = normalise(domRaw, prev, config.site, input.url);
      const jsonConf = Object.keys(rawJson).length > 0 ? confidenceOf(config, json.passed) : 0;
      const domConf = confidenceOf(config, dom.passed);

      // A real innings outranks an invented pre-match 0-0. Within the same class the higher
      // confidence wins, and a tie still goes to JSON, whose shapes rot less often than the DOM's.
      const useJson =
        jsonConf > 0 &&
        (jsonConf > domConf ||
          (jsonConf === domConf && !(json.synthetic && !dom.synthetic)));
      const chosen = useJson ? json : dom;
      const confidence = useJson ? jsonConf : domConf;
      const strategy: Strategy = confidence === 0 ? 'none' : useJson ? 'json' : 'dom';
      const missing = config.minConfidenceFields.filter((k) => !chosen.passed.has(k));
      last = { strategy, jsonConfidence: jsonConf, domConfidence: domConf, missing };

      // The two sources see different halves of the page: the response the site polls carries the
      // numbers, the markup carries what that response never sent (the venue, the team names on a
      // preview). Keep everything the winning source read and fill only its gaps from the other,
      // then re-normalise so the extras go through the same sanity checks.
      const merged = normalise(
        { ...(useJson ? domRaw : rawJson), ...(useJson ? rawJson : domRaw) },
        prev,
        config.site,
        input.url,
      );
      const fields = merged.fields;

      const inn = fields.innings.at(-1);
      if (confidence >= MIN_CONFIDENCE && inn) {
        previous.set(matchId, {
          inningsCount: fields.innings.length,
          runs: inn.runs,
        });
      }
      return {
        source: config.site,
        matchId,
        url: input.url,
        capturedAt: input.now,
        confidence,
        fields,
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
