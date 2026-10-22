import { slug, type ManualCommand, type ManualSetup, type RawUpdate } from '@stumpcast/shared';

export class ManualError extends Error {}

export interface ManualPlayer {
  id: string;
  name: string;
}

interface BatterStat {
  id: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  out: boolean;
  outKind?: string;
}

interface BowlerStat {
  id: string;
  legalBalls: number;
  runs: number;
  wkts: number;
  maidens: number;
  /** Runs conceded and legal balls bowled in the over in progress. */
  overRuns: number;
  overBalls: number;
}

interface Innings {
  battingTeam: 0 | 1;
  runs: number;
  wkts: number;
  legalBalls: number;
  extras: { wd: number; nb: number; b: number; lb: number };
  batters: Map<string, BatterStat>;
  bowlers: Map<string, BowlerStat>;
  overTokens: string[];
  lastOverTokens: string[];
  recent: string[];
  partnership: { runs: number; balls: number };
  fow: { runs: number; wkts: number; playerId: string }[];
  striker: string | null;
  nonStriker: string | null;
  bowler: string | null;
  lastOverBowler: string | null;
  freeHit: boolean;
  complete: boolean;
  declared: boolean;
}

export type Awaiting = 'striker' | 'nonStriker' | 'bowler';

const DISMISSES_BOWLER = new Set(['bowled', 'caught', 'lbw', 'stumped', 'hitwicket']);

const newInnings = (battingTeam: 0 | 1): Innings => ({
  battingTeam,
  runs: 0,
  wkts: 0,
  legalBalls: 0,
  extras: { wd: 0, nb: 0, b: 0, lb: 0 },
  batters: new Map(),
  bowlers: new Map(),
  overTokens: [],
  lastOverTokens: [],
  recent: [],
  partnership: { runs: 0, balls: 0 },
  fow: [],
  striker: null,
  nonStriker: null,
  bowler: null,
  lastOverBowler: null,
  freeHit: false,
  complete: false,
  declared: false,
});

/**
 * Deterministic cricket scoring state machine (B1). All state is derived by applying commands
 * in order; undo is "rebuild without the last command", so replaying a command list always
 * reproduces the same score.
 */
export class ManualMatch {
  readonly teams: [ManualPlayer[], ManualPlayer[]];
  readonly innings: Innings[] = [];
  toss: { winner: 0 | 1; decision: 'bat' | 'bowl' } | null = null;
  result: string | null = null;
  readonly oversLimit: number | undefined;
  private commandCount = 0;

  constructor(
    readonly id: string,
    readonly setup: ManualSetup,
  ) {
    const used = new Set<string>();
    const roster = (names: string[]): ManualPlayer[] =>
      names.map((name) => {
        let pid = slug(name) || 'player';
        for (let n = 2; used.has(pid); n++) pid = `${slug(name) || 'player'}-${n}`;
        used.add(pid);
        return { id: pid, name };
      });
    this.teams = [roster(setup.teams[0].players), roster(setup.teams[1].players)];
    this.oversLimit =
      setup.format === 'TEST'
        ? undefined
        : (setup.overs ?? (setup.format === 'ODI' ? 50 : setup.format === 'T20' ? 20 : undefined));
    this.innings.push(newInnings(0));
  }

  // ---- queries ---------------------------------------------------------------------------

  get current(): Innings {
    return this.innings[this.innings.length - 1]!;
  }

  get title(): string {
    return this.setup.title ?? `${this.setup.teams[0].name} v ${this.setup.teams[1].name}`;
  }

  teamIdOf(index: 0 | 1): string {
    return `team-${slug(this.setup.teams[index].name)}`;
  }

  get awaiting(): Awaiting[] {
    if (this.result || this.current.complete) return [];
    const c = this.current;
    const out: Awaiting[] = [];
    if (!c.striker) out.push('striker');
    if (!c.nonStriker) out.push('nonStriker');
    if (!c.bowler) out.push('bowler');
    return out;
  }

  get maxWickets(): number {
    return Math.min(10, this.teams[this.current.battingTeam].length - 1);
  }

  /** Legal balls of the current innings, in cricket notation. */
  get overs(): { overs: number; balls: number } {
    const b = this.current.legalBalls;
    return { overs: Math.floor(b / 6), balls: b % 6 };
  }

  /** Target for the chasing side, when applicable. */
  get target(): number | undefined {
    if (this.setup.format === 'TEST' || this.innings.length < 2) return undefined;
    return this.innings[0]!.runs + 1;
  }

  player(teamIdx: 0 | 1, id: string): ManualPlayer | undefined {
    return this.teams[teamIdx].find((p) => p.id === id);
  }

  playerName(id: string | null): string | undefined {
    if (!id) return undefined;
    for (const t of this.teams) {
      const p = t.find((x) => x.id === id);
      if (p) return p.name;
    }
    return undefined;
  }

  // ---- commands --------------------------------------------------------------------------

  apply(cmd: ManualCommand): void {
    switch (cmd.type) {
      case 'set-toss':
        return this.setToss(cmd);
      case 'set-result':
        this.result = cmd.text;
        this.commandCount++;
        return;
      case 'set-batter':
        return this.setBatter(cmd.slot, cmd.playerId);
      case 'set-bowler':
        return this.setBowler(cmd.playerId, false);
      case 'new-over':
        return this.setBowler(cmd.bowlerId, true);
      case 'end-innings':
        return this.endInnings(cmd.declared);
      case 'ball':
        return this.ball(cmd);
    }
  }

  private guardLive(): void {
    if (this.result) throw new ManualError('The match is finished. Undo to continue scoring.');
  }

  private setToss(cmd: Extract<ManualCommand, { type: 'set-toss' }>): void {
    if (this.innings.length > 1 || this.current.legalBalls > 0) {
      throw new ManualError('The toss can only be set before the first ball.');
    }
    const winner = [0, 1].find((i) => this.teamIdOf(i as 0 | 1) === cmd.winnerTeamId) as
      0 | 1 | undefined;
    if (winner === undefined) throw new ManualError('Unknown team for the toss.');
    this.toss = { winner, decision: cmd.decision };
    const batting: 0 | 1 = cmd.decision === 'bat' ? winner : winner === 0 ? 1 : 0;
    this.innings[0] = newInnings(batting);
    this.commandCount++;
  }

  private setBatter(slot: 'striker' | 'nonStriker', playerId: string): void {
    this.guardLive();
    const c = this.current;
    if (c.complete) throw new ManualError('This innings is over.');
    if (!this.player(c.battingTeam, playerId)) {
      throw new ManualError('That player is not in the batting team.');
    }
    const other = slot === 'striker' ? c.nonStriker : c.striker;
    if (other === playerId) throw new ManualError('That batter is already at the other end.');
    if (c.batters.get(playerId)?.out) throw new ManualError('That batter is already out.');
    if (!c.batters.has(playerId)) c.batters.set(playerId, this.blankBatter(playerId));
    if (slot === 'striker') c.striker = playerId;
    else c.nonStriker = playerId;
    this.commandCount++;
  }

  private setBowler(playerId: string, startingOver: boolean): void {
    this.guardLive();
    const c = this.current;
    if (c.complete) throw new ManualError('This innings is over.');
    const fielding: 0 | 1 = c.battingTeam === 0 ? 1 : 0;
    if (!this.player(fielding, playerId)) {
      throw new ManualError('That player is not in the fielding team.');
    }
    if (startingOver && c.bowler && c.overTokens.length > 0) {
      throw new ManualError('The current over is not finished yet.');
    }
    if (c.overTokens.length === 0 && c.lastOverBowler === playerId && c.legalBalls > 0) {
      throw new ManualError('A bowler cannot bowl two overs in a row.');
    }
    c.bowler = playerId;
    if (!c.bowlers.has(playerId)) {
      c.bowlers.set(playerId, {
        id: playerId,
        legalBalls: 0,
        runs: 0,
        wkts: 0,
        maidens: 0,
        overRuns: 0,
        overBalls: 0,
      });
    }
    this.commandCount++;
  }

  private blankBatter(id: string): BatterStat {
    return { id, runs: 0, balls: 0, fours: 0, sixes: 0, out: false };
  }

  private ball(cmd: Extract<ManualCommand, { type: 'ball' }>): void {
    this.guardLive();
    const c = this.current;
    if (c.complete) throw new ManualError('This innings is over.');
    const need = this.awaiting;
    if (need.length > 0) {
      throw new ManualError(
        `Set the ${need.join(' and ').replace('nonStriker', 'non-striker')} first.`,
      );
    }
    const ex = cmd.extras;
    const isWide = ex?.type === 'wide';
    const isNoBall = ex?.type === 'noball';
    const isBye = ex?.type === 'bye' || ex?.type === 'legbye';
    if (isBye && cmd.runs > 0) {
      throw new ManualError('Byes and leg byes are extras, not runs off the bat.');
    }
    if (isWide && cmd.runs > 0)
      throw new ManualError('Runs cannot be scored off the bat on a wide.');

    const wk = cmd.wicket;
    if (wk) {
      if (c.freeHit && wk.kind !== 'runout') {
        throw new ManualError('Only a run out is possible on a free hit.');
      }
      if (isNoBall && wk.kind !== 'runout') {
        throw new ManualError('Only a run out is possible on a no-ball.');
      }
      if (isWide && !['stumped', 'runout', 'hitwicket'].includes(wk.kind)) {
        throw new ManualError('That dismissal is not possible on a wide.');
      }
    }

    const striker = c.striker!;
    const nonStriker = c.nonStriker!;
    const bowlerId = c.bowler!;
    const bowler = c.bowlers.get(bowlerId)!;
    const sBat = c.batters.get(striker)!;

    // Validate the wicket fully before changing anything (commands are all-or-nothing).
    let outId: string | undefined;
    let newBatter: string | undefined;
    if (wk) {
      outId = wk.playerOutId ?? striker;
      if (outId !== striker && outId !== nonStriker) {
        throw new ManualError('The dismissed player must be one of the batters at the crease.');
      }
      const lastWicket = c.wkts + 1 >= this.maxWickets;
      if (!lastWicket) {
        if (!wk.newBatterId) throw new ManualError('Choose the incoming batter.');
        if (!this.player(c.battingTeam, wk.newBatterId)) {
          throw new ManualError('The incoming batter is not in the batting team.');
        }
        if (c.batters.has(wk.newBatterId)) {
          throw new ManualError('That batter has already batted.');
        }
        newBatter = wk.newBatterId;
      }
    }

    const batRuns = cmd.runs;
    const extraRuns = ex?.runs ?? 0;
    const legal = !isWide && !isNoBall;

    // runs and extras
    c.runs += batRuns + extraRuns;
    if (ex) {
      const key = ({ wide: 'wd', noball: 'nb', bye: 'b', legbye: 'lb' } as const)[ex.type];
      c.extras[key] += extraRuns;
    }
    if (!isWide) {
      sBat.balls += 1;
      sBat.runs += batRuns;
      if (batRuns === 4) sBat.fours += 1;
      if (batRuns === 6) sBat.sixes += 1;
    }
    const conceded = batRuns + (isWide || isNoBall ? extraRuns : 0);
    bowler.runs += conceded;
    bowler.overRuns += conceded;
    if (legal) {
      c.legalBalls += 1;
      bowler.legalBalls += 1;
      bowler.overBalls += 1;
    }
    c.partnership.runs += batRuns + extraRuns;
    if (legal) c.partnership.balls += 1;

    // scoreboard token
    let token: string;
    if (wk && !isWide && !isNoBall) token = 'W';
    else if (isWide) token = extraRuns > 1 ? `${extraRuns}wd` : 'wd';
    else if (isNoBall) token = batRuns + extraRuns > 1 ? `${batRuns + extraRuns}nb` : 'nb';
    else if (ex?.type === 'bye') token = `${extraRuns}b`;
    else if (ex?.type === 'legbye') token = `${extraRuns}lb`;
    else token = batRuns === 0 ? '.' : String(batRuns);
    c.overTokens.push(token);
    c.recent.push(token);
    if (c.recent.length > 12) c.recent.shift();
    if (wk && (isWide || isNoBall)) {
      c.overTokens.push('W');
      c.recent.push('W');
    }

    // strike rotation by runs actually run
    const runsRun = isBye ? extraRuns : isWide ? extraRuns - 1 : batRuns;
    if (runsRun % 2 === 1) [c.striker, c.nonStriker] = [c.nonStriker, c.striker];

    // free hit
    if (isNoBall) c.freeHit = true;
    else if (legal) c.freeHit = false;

    // wicket
    if (wk && outId) {
      const outStat = c.batters.get(outId)!;
      outStat.out = true;
      outStat.outKind = wk.kind;
      c.wkts += 1;
      c.fow.push({ runs: c.runs, wkts: c.wkts, playerId: outId });
      if (DISMISSES_BOWLER.has(wk.kind)) bowler.wkts += 1;
      c.partnership = { runs: 0, balls: 0 };
      if (newBatter) {
        c.batters.set(newBatter, this.blankBatter(newBatter));
        if (c.striker === outId) c.striker = newBatter;
        else c.nonStriker = newBatter;
      } else if (c.striker === outId) c.striker = null;
      else c.nonStriker = null;
    }

    // end of over
    if (legal && bowler.overBalls >= 6) {
      if (bowler.overRuns === 0) bowler.maidens += 1;
      bowler.overRuns = 0;
      bowler.overBalls = 0;
      [c.striker, c.nonStriker] = [c.nonStriker, c.striker];
      c.lastOverBowler = bowlerId;
      c.lastOverTokens = c.overTokens;
      c.overTokens = [];
      c.bowler = null;
    }

    this.commandCount++;
    this.checkInningsEnd();
  }

  private limitReached(c: Innings): boolean {
    return this.oversLimit !== undefined && c.legalBalls >= this.oversLimit * 6;
  }

  private checkInningsEnd(): void {
    const c = this.current;
    const target = this.target;
    const chasing = target !== undefined && this.innings.length >= 2 && this.setup.format !== 'TEST';
    const targetHit = chasing && target !== undefined && c.runs >= target;
    if (c.wkts >= this.maxWickets || this.limitReached(c) || targetHit) {
      this.completeInnings(false);
    }
  }

  private endInnings(declared: boolean): void {
    this.guardLive();
    if (this.current.complete) throw new ManualError('This innings is already over.');
    this.completeInnings(declared);
    this.commandCount++;
  }

  private completeInnings(declared: boolean): void {
    const c = this.current;
    c.complete = true;
    c.declared = declared;
    const fmt = this.setup.format;
    const names = this.setup.teams.map((t) => t.name);
    const chaser = c.battingTeam;
    const setter: 0 | 1 = chaser === 0 ? 1 : 0;

    if (fmt === 'TEST') {
      // Result is set by the operator; just open the next innings (max four).
      if (this.innings.length < 4) this.innings.push(newInnings(c.battingTeam === 0 ? 1 : 0));
      return;
    }
    if (this.innings.length === 1) {
      this.innings.push(newInnings(c.battingTeam === 0 ? 1 : 0));
      return;
    }
    // Second innings finished: decide the result.
    const target = this.target;
    if (target === undefined) return;
    if (c.runs >= target) {
      const left = this.maxWickets - c.wkts;
      this.result = `${names[chaser]} won by ${left} wicket${left === 1 ? '' : 's'}`;
    } else if (c.runs === target - 1) {
      this.result = 'Match tied';
    } else {
      const by = target - 1 - c.runs;
      this.result = `${names[setter]} won by ${by} run${by === 1 ? '' : 's'}`;
    }
  }

  // ---- output ----------------------------------------------------------------------------

  /** Express the current state as a RawUpdate so the normal engine pipeline can consume it. */
  toRawUpdate(now: number): RawUpdate {
    const names = this.setup.teams.map((t) => t.name);
    const c = this.current;
    // Every innings with activity, plus the one in progress (even at 0/0).
    const live = this.innings.filter(
      (i, idx) => idx === this.innings.length - 1 || i.legalBalls > 0 || i.runs > 0 || i.complete,
    );

    const inningsOut = live.map((i) => ({
      team: names[i.battingTeam]!,
      runs: i.runs,
      wkts: i.wkts,
      overs: Math.floor(i.legalBalls / 6),
      balls: i.legalBalls % 6,
    }));

    const batterOut = (id: string | null, onStrike: boolean) => {
      if (!id) return [];
      const b = c.batters.get(id);
      const name = this.playerName(id);
      if (!b || !name) return [];
      return [{ name, runs: b.runs, balls: b.balls, fours: b.fours, sixes: b.sixes, onStrike }];
    };

    const bowlerId = c.bowler ?? c.lastOverBowler;
    const bw = bowlerId ? c.bowlers.get(bowlerId) : undefined;

    let status = 'Live';
    if (this.result) status = this.result;
    else if (
      this.innings.length === 2 &&
      this.setup.format !== 'TEST' &&
      c.legalBalls === 0 &&
      c.runs === 0
    ) {
      status = 'Innings Break';
    }

    const shownOver = c.overTokens.length > 0 ? c.overTokens : c.lastOverTokens;
    const update: RawUpdate = {
      source: 'manual',
      matchId: this.id,
      url: `http://localhost/manual/${encodeURIComponent(this.id)}`,
      capturedAt: now,
      confidence: 1,
      fields: {
        title: this.title,
        format: this.setup.format,
        oversLimit: this.oversLimit,
        status,
        venue: this.setup.venue,
        toss: this.toss
          ? `${names[this.toss.winner]} won the toss and chose to ${this.toss.decision}`
          : undefined,
        teams: this.setup.teams.map((t, i) => ({
          name: t.name,
          short: t.short,
          // The operator named this squad, so the overlay can show a real Playing XI instead of
          // the "not announced" placeholder a bare score feed has to fall back to.
          players: (this.teams[i] ?? []).map((p) => p.name),
        })),
        innings: inningsOut,
        batters: [...batterOut(c.striker, true), ...batterOut(c.nonStriker, false)],
        bowler:
          bw && bowlerId
            ? {
                name: this.playerName(bowlerId)!,
                overs: Math.floor(bw.legalBalls / 6),
                balls: bw.legalBalls % 6,
                maidens: bw.maidens,
                runs: bw.runs,
                wkts: bw.wkts,
              }
            : undefined,
        thisOver: shownOver,
        lastBalls: c.recent.slice(-6),
        partnership: c.partnership,
        target: this.target,
        resultText: this.result ?? undefined,
        day: undefined,
        session: undefined,
        crr: undefined,
        rrr: undefined,
        commentaryLast: undefined,
      },
      missing: [],
    };
    return update;
  }

  /** Detail the admin needs to build its scoring controls. */
  describe() {
    const c = this.current;
    const batting = this.teams[c.battingTeam];
    const fielding = this.teams[c.battingTeam === 0 ? 1 : 0];
    const idsAtCrease = new Set([c.striker, c.nonStriker].filter(Boolean) as string[]);
    return {
      id: this.id,
      title: this.title,
      format: this.setup.format,
      oversLimit: this.oversLimit ?? null,
      teams: this.setup.teams.map((t, i) => ({
        id: this.teamIdOf(i as 0 | 1),
        name: t.name,
        short: t.short ?? t.name.slice(0, 3).toUpperCase(),
      })),
      toss: this.toss
        ? { winnerTeamId: this.teamIdOf(this.toss.winner), decision: this.toss.decision }
        : null,
      battingTeamId: this.teamIdOf(c.battingTeam),
      awaiting: this.awaiting,
      freeHit: c.freeHit,
      result: this.result,
      inningsComplete: c.complete,
      inningsNumber: this.innings.length,
      striker: c.striker,
      nonStriker: c.nonStriker,
      bowler: c.bowler,
      lastOverBowler: c.lastOverBowler,
      overBalls: c.overTokens.length,
      runs: c.runs,
      wkts: c.wkts,
      overs: Math.floor(c.legalBalls / 6),
      balls: c.legalBalls % 6,
      crr: c.legalBalls > 0 ? c.runs / (c.legalBalls / 6) : 0,
      availableBatters: batting.filter((p) => !c.batters.get(p.id)?.out && !idsAtCrease.has(p.id)),
      yetToBat: batting.filter((p) => !c.batters.has(p.id)),
      bowlers: fielding,
      bowlerOptions: fielding.filter((p) => p.id !== c.lastOverBowler),
      commandCount: this.commandCount,
    };
  }
}
