import type { BattingFigure, BowlingFigure, MatchState } from '@stumpcast/shared';

/** The feed sends this when it has no real name for the slot (adapt.ts placeholder). */
const PLACEHOLDER = '—';
const TOP_N = 3;

interface InningsCard {
  batting: Map<string, BattingFigure>;
  bowling: Map<string, BowlingFigure>;
}

const isReal = (name: string): boolean => name.length > 0 && name !== PLACEHOLDER;

/**
 * Builds a scorecard from the snapshots. The feed only ever publishes the pair at the crease and
 * the bowler currently running in, so a "top batters" list read straight off the state shows the
 * last pair of a finished innings instead of the innings' best innings.
 *
 * A batter's published figures only grow while they are at the crease, so the latest snapshot for
 * that batter is their scorecard entry; when they go out the entry stays behind. The same holds for
 * a bowler across their spells, keyed per innings so a second innings starts from scratch.
 */
export class PlayerTracker {
  private readonly cards = new Map<string, InningsCard>();

  private card(s: MatchState): InningsCard | undefined {
    if (s.currentInnings === 0) return undefined;
    const key = `${s.id}#${s.currentInnings}`;
    let c = this.cards.get(key);
    if (!c) {
      c = { batting: new Map(), bowling: new Map() };
      this.cards.set(key, c);
    }
    return c;
  }

  observe(s: MatchState): void {
    const card = this.card(s);
    if (!card) return;
    for (const b of s.batters) {
      if (!isReal(b.name)) continue;
      card.batting.set(b.playerId, {
        playerId: b.playerId,
        name: b.name,
        runs: b.runs,
        balls: b.balls,
        fours: b.fours,
        sixes: b.sixes,
        innings: s.currentInnings,
      });
    }
    const w = s.bowler;
    if (isReal(w.name)) {
      card.bowling.set(w.playerId, {
        playerId: w.playerId,
        name: w.name,
        overs: w.overs,
        balls: w.balls,
        maidens: w.maidens,
        runs: w.runs,
        wkts: w.wkts,
        innings: s.currentInnings,
      });
    }
  }

  /** Best single-innings figures per player, so a two-innings Test does not list a name twice. */
  private best<T extends { playerId: string }>(
    s: MatchState,
    of: (card: InningsCard) => Iterable<T>,
    better: (a: T, b: T) => boolean,
  ): T[] {
    const best = new Map<string, T>();
    for (const key of this.cards.keys()) {
      if (!key.startsWith(`${s.id}#`)) continue;
      for (const entry of of(this.cards.get(key)!)) {
        const held = best.get(entry.playerId);
        if (!held || better(entry, held)) best.set(entry.playerId, entry);
      }
    }
    return [...best.values()];
  }

  apply(s: MatchState): MatchState {
    // A batter who never faced is all zeros; ranking those above a real innings helps nobody.
    const batters = this.best<BattingFigure>(
      s,
      (c) => c.batting.values(),
      (a, b) => a.runs > b.runs || (a.runs === b.runs && a.balls > b.balls),
    )
      .filter((b) => b.balls > 0 || b.runs > 0)
      .sort(
        (a, b) => b.runs - a.runs || b.balls - a.balls || a.name.localeCompare(b.name),
      )
      .slice(0, TOP_N);

    const bowlers = this.best<BowlingFigure>(
      s,
      (c) => c.bowling.values(),
      (a, b) => a.wkts > b.wkts || (a.wkts === b.wkts && a.runs < b.runs),
    )
      .filter((b) => b.overs > 0 || b.balls > 0)
      .sort(
        (a, b) => b.wkts - a.wkts || a.runs - b.runs || b.overs - a.overs || a.name.localeCompare(b.name),
      )
      .slice(0, TOP_N);

    if (batters.length === 0 && bowlers.length === 0) return s;
    return {
      ...s,
      topBatters: batters.length > 0 ? batters : s.topBatters,
      topBowlers: bowlers.length > 0 ? bowlers : s.topBowlers,
    };
  }

  /** Forget one match entirely, so a deleted-then-recreated id does not inherit old figures. */
  remove(matchId: string): void {
    const prefix = `${matchId}#`;
    for (const k of [...this.cards.keys()]) if (k.startsWith(prefix)) this.cards.delete(k);
  }

  clear(): void {
    this.cards.clear();
  }

  /** Number of innings still being tracked (for leak tests). */
  get size(): number {
    return this.cards.size;
  }
}
