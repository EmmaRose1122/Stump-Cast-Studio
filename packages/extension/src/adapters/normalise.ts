/** Pure text normalisers shared by every adapter. All return undefined on unparseable input. */

export interface Overs {
  overs: number;
  balls: number;
}

/** "17.3", "(17.3)", "(16.0 Ovs)", "20", "(20)" -> { overs: 17, balls: 3 }. Rejects balls > 5. */
export const parseOvers = (input: string | number | undefined): Overs | undefined => {
  if (input === undefined) return undefined;
  const m = /^\s*\(?\s*(\d{1,3})(?:\.(\d))?\s*(?:ov(?:ers?)?|ovs?)?\s*\)?\s*$/i.exec(String(input));
  if (!m) return undefined;
  const balls = m[2] === undefined ? 0 : Number(m[2]);
  if (balls > 5) return undefined;
  return { overs: Number(m[1]), balls };
};

export interface RunsWkts {
  runs: number;
  /** Undefined when the page showed a bare total, so the caller must decide what it meant. */
  wkts?: number;
}

/** "145/3", "(145/3)", "145/3 (16.0)" — a score, never a team name. */
export const looksLikeScore = (input: string | undefined): boolean =>
  input !== undefined &&
  /^\(?\d{1,4}\s*[-/]\s*\d{1,2}\)?\s*(\(\s*\d{1,3}(?:\.\d)?\s*\))?$/.test(input.trim());

/** "BatterRB4s6sSR", "GMT", "0 0 1" — never a toss sentence. */
export const looksLikeToss = (input: string | undefined): boolean =>
  input !== undefined &&
  /(?:won the toss|opt(?:s|ed)? to (?:bat|bowl|field)|elected to (?:bat|bowl|field))/i.test(input);

export interface ParseScoreOptions {
  /** If true, allow a bare number like "260" (runs with wickets unknown). */
  allowBare?: boolean;
}

/**
 * "52-1", "52/1", "52 - 1", "52/1(8.5)" -> runs/wkts. Bare "52" (with allowBare: true) -> runs only,
 * wkts undefined. All out -> wkts: 10.
 */
export const parseScore = (
  input: string | undefined,
  options?: ParseScoreOptions,
): RunsWkts | undefined => {
  if (input === undefined) return undefined;
  const m = /(\d{1,4})\s*[-/]\s*(\d{1,2})/.exec(input);
  if (m) {
    const wkts = Number(m[2]);
    return wkts > 10 ? undefined : { runs: Number(m[1]), wkts };
  }
  const allOut = /^\s*(\d{1,4})\s*(?:all out|ao|a\/o)\s*$/i.exec(input);
  if (allOut) return { runs: Number(allOut[1]), wkts: 10 };
  if (options?.allowBare) {
    const bare = /^(?:[A-Za-z]+\s+)?(\d{1,4})(?:\s*\(.*?\))?$/.exec(input.trim());
    if (bare) return { runs: Number(bare[1]) };
  }
  return undefined;
};

export interface CleanName {
  name: string;
  onStrike: boolean;
  isCaptain: boolean;
  isWk: boolean;
}

/** Strip "*", "(c)", "(wk)", "(c & wk)", "†" markers but keep what they meant as flags. */
export const cleanPlayerName = (input: string | undefined): CleanName | undefined => {
  if (input === undefined) return undefined;
  let s = input.replace(/\s+/g, ' ').trim();
  const onStrike = /\*/.test(s);
  const isCaptain = /\((?:c|capt(?:ain)?)(?:\s*&\s*wk)?\)/i.test(s);
  const isWk = /\((?:wk|c\s*&\s*wk)\)|†/i.test(s);
  s = s
    .replace(/\*/g, '')
    .replace(/\((?:c|capt(?:ain)?|wk|c\s*&\s*wk)\)/gi, '')
    .replace(/†/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return s ? { name: s, onStrike, isCaptain, isWk } : undefined;
};

export interface DayStatus {
  day?: number;
  /** The session/phase word as written, lower-cased: "stumps", "lunch", "tea", "day 4"... */
  session?: string;
  /** The remainder after the day/session prefix, e.g. "India need 319 runs". */
  resultText?: string;
}

/** "Day 4: Stumps - India need 319 runs" or "Stumps - Day 3: Lunch" -> { day, session, resultText } */
const SESSION_WORD = /(?:stumps?|lunch|tea|drinks|break|session|innings|over)\b/i;

export const parseDayStatus = (input: string | undefined): DayStatus | undefined => {
  if (!input) return undefined;
  // Sites put the day first ("Day 3: Stumps") and last ("Stumps - Day 3"); anchoring the match
  // made real Test pages lose their day, and with it the exemption from the overs limit.
  const m = /\bday\s*(\d{1,2})\b/i.exec(input);
  if (!m) return undefined;
  const out: DayStatus = { day: Number(m[1]) };
  const split = (text: string) =>
    text
      .split(/[-–:,]/)
      .map((s) => s.trim())
      .filter(Boolean);
  const before = split(input.slice(0, m.index));
  const after = split(input.slice(m.index + m[0].length));
  const session =
    after.find((s) => SESSION_WORD.test(s)) ??
    before.find((s) => SESSION_WORD.test(s)) ??
    after[0] ??
    before[0];
  if (session) out.session = session.toLowerCase();
  const rest = [...before, ...after].filter((s) => s !== session);
  if (rest.length) out.resultText = rest.join(' - ').trim();
  return out;
};

/** "1 4 W . 2 wd" -> ["1","4","W",".","2","wd"]. Splits on whitespace, commas and pipes. */
export const parseBallTokens = (input: string | undefined): string[] =>
  input
    ? input
        .split(/[\s,|]+/)
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

/** "34(19)" or "34 runs (19 balls)" -> { runs: 34, balls: 19 }. */
export const parsePartnership = (
  input: string | undefined,
): { runs: number; balls: number } | undefined => {
  if (!input) return undefined;
  const m = /(\d+)\D+(\d+)/.exec(input);
  return m ? { runs: Number(m[1]), balls: Number(m[2]) } : undefined;
};

/** Parse a number from text, tolerating thousands separators and rate suffixes. */
export const parseNumber = (input: string | number | undefined): number | undefined => {
  if (input === undefined) return undefined;
  if (typeof input === 'number') return Number.isFinite(input) ? input : undefined;
  const m = /-?\d+(?:\.\d+)?/.exec(input.replace(/,/g, ''));
  if (!m) return undefined;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : undefined;
};

export const parseInteger = (input: string | number | undefined): number | undefined => {
  const n = parseNumber(input);
  return n === undefined ? undefined : Math.trunc(n);
};
