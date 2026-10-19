/** Pure helpers for the manual scoring panel (kept out of React so they are easy to test). */

export type ExtraKind = 'none' | 'wide' | 'noball' | 'bye' | 'legbye';

export interface BallPayload {
  runs: number;
  extras?: { type: 'wide' | 'noball' | 'bye' | 'legbye'; runs: number };
}

export const EXTRA_LABEL: Record<ExtraKind, string> = {
  none: 'Runs',
  wide: 'Wide',
  noball: 'No ball',
  bye: 'Bye',
  legbye: 'Leg bye',
};

/**
 * What pressing run button `n` means under the selected extra:
 *  none    -> n runs off the bat
 *  wide    -> a wide plus n runs run (n=0 is a plain wide, 1 extra run)
 *  noball  -> a no-ball (1 penalty) with n runs off the bat
 *  bye/lb  -> n extras (needs at least 1)
 */
export const ballFor = (kind: ExtraKind, n: number): BallPayload | null => {
  switch (kind) {
    case 'none':
      return n >= 0 && n <= 6 ? { runs: n } : null;
    case 'wide':
      return n >= 0 && n <= 5 ? { runs: 0, extras: { type: 'wide', runs: n + 1 } } : null;
    case 'noball':
      return n >= 0 && n <= 6 ? { runs: n, extras: { type: 'noball', runs: 1 } } : null;
    case 'bye':
    case 'legbye':
      return n >= 1 && n <= 6 ? { runs: 0, extras: { type: kind, runs: n } } : null;
  }
};

export type ScoringKey =
  | { type: 'run'; n: number }
  | { type: 'extra'; kind: ExtraKind }
  | { type: 'wicket' }
  | { type: 'undo' };

/** Keyboard map: 0-6 runs, x/n/b/l choose an extra (z clears), w = wicket, u = undo. */
export const resolveScoringKey = (key: string): ScoringKey | null => {
  if (/^[0-6]$/.test(key)) return { type: 'run', n: Number(key) };
  switch (key.toLowerCase()) {
    case 'x':
      return { type: 'extra', kind: 'wide' };
    case 'n':
      return { type: 'extra', kind: 'noball' };
    case 'b':
      return { type: 'extra', kind: 'bye' };
    case 'l':
      return { type: 'extra', kind: 'legbye' };
    case 'z':
      return { type: 'extra', kind: 'none' };
    case 'w':
      return { type: 'wicket' };
    case 'u':
      return { type: 'undo' };
    default:
      return null;
  }
};

export const WICKET_KINDS: { value: string; label: string }[] = [
  { value: 'bowled', label: 'Bowled' },
  { value: 'caught', label: 'Caught' },
  { value: 'lbw', label: 'LBW' },
  { value: 'runout', label: 'Run out' },
  { value: 'stumped', label: 'Stumped' },
  { value: 'hitwicket', label: 'Hit wicket' },
  { value: 'obstructing', label: 'Obstructing the field' },
  { value: 'retired', label: 'Retired' },
];

import { parseSquadFile } from '@stumpcast/shared';

/** Default squad names so a demo or a quick local game can start in one click. */
export const sampleSquad = (team: string, n = 11): string[] =>
  Array.from({ length: n }, (_, i) => `${team} Player ${i + 1}`);

export const parsePlayers = (text: string): string[] => {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (
    trimmed.startsWith('{') ||
    trimmed.startsWith('[') ||
    /^(name|player|role|team)/i.test(trimmed.split(/\r?\n/)[0] ?? '')
  ) {
    const res = parseSquadFile(trimmed);
    if (res.allPlayers.length > 0) {
      return res.allPlayers.map((p) => p.name);
    }
  }
  return text
    .split(/\r?\n|,/)
    .map((s) => s.trim())
    .filter(Boolean);
};

export const parseSquadUpload = (rawText: string, defaultTeamName?: string) => {
  return parseSquadFile(rawText, defaultTeamName);
};
