import {
  buildBallCommentary,
  buildEventCommentary,
  CommentaryConfigSchema,
  type CommentaryConfig,
  type CommentaryItem,
  type CommentaryLanguage,
  type EngineEvent,
  type MatchState,
} from '@stumpcast/shared';

const MAX_HISTORY = 30;
/** A delivery every ~20 s is normal; this only stops bursts after a resync or a batch of balls. */
const MIN_BALL_GAP_MS = 5_000;
/** Never let the model queue up behind a burst of updates — past this, use the phrasebook. */
const MAX_IN_FLIGHT = 2;

export interface CommentaryRequest {
  state: MatchState;
  moment: string;
  lang: CommentaryLanguage;
}

export type CommentaryGenerator = (req: CommentaryRequest) => Promise<string | null>;

/** Plain-language description of the moment, for the model to narrate in the target script. */
const describeMoment = (event: EngineEvent | null, s: MatchState): string => {
  const striker = s.batters.find((b) => b.onStrike)?.name ?? 'the batter';
  const bowler = s.bowler?.name ?? 'the bowler';
  if (event) {
    const p = event.payload as Record<string, unknown>;
    switch (event.type) {
      case 'FOUR':
        return `${p.batter ?? striker} scored a four off ${bowler}`;
      case 'SIX':
        return `${p.batter ?? striker} hit a six off ${bowler}`;
      case 'WICKET':
        return `${p.out ?? striker} is out, bowled by ${bowler}, score ${s.score.runs}-${s.score.wkts}`;
      case 'FIFTY':
        return `${p.name ?? striker} reached a fifty`;
      case 'HUNDRED':
        return `${p.name ?? striker} reached a century`;
      case 'OVER_END':
        return `end of over ${p.over ?? s.score.overs}, score ${s.score.runs}-${s.score.wkts}`;
      case 'NEW_BATTER':
        return `${p.name ?? 'a new batter'} came to the crease`;
      case 'DRS':
        return 'a review was taken';
      case 'INNINGS_END':
        return `the innings ended on ${s.score.runs}-${s.score.wkts}`;
      default:
        return `${event.type} happened`;
    }
  }
  const ball = s.thisOver[s.thisOver.length - 1] ?? s.lastBalls[s.lastBalls.length - 1];
  if (!ball) return 'a delivery was bowled';
  if (ball.wicket) return `${striker} got out off ${bowler}`;
  if (ball.extras?.type === 'wide') return `wide ball from ${bowler}`;
  if (ball.extras?.type === 'noball') return `no ball from ${bowler}, ${ball.runs} run(s) off the bat`;
  if (ball.runs === 0) return `dot ball from ${bowler}`;
  return `${striker} took ${ball.runs} run(s) off ${bowler}`;
};

export class CommentaryService {
  private config: CommentaryConfig;
  private history: CommentaryItem[] = [];
  private lastBallKey = '';
  private lastBallAt = 0;
  private inFlight = 0;
  private generator: CommentaryGenerator | null = null;
  private generatorReady: () => boolean = () => true;

  constructor(
    initialConfig?: Partial<CommentaryConfig>,
    private readonly now: () => number = Date.now,
  ) {
    this.config = CommentaryConfigSchema.parse(initialConfig ?? {});
  }

  /** The model writer. Absent or failing, the local phrasebook carries the broadcast. */
  setGenerator(gen: CommentaryGenerator | null, ready: () => boolean = () => true): void {
    this.generator = gen;
    this.generatorReady = ready;
  }

  /** True only when a line would actually reach the model — a stored key is part of it. */
  get aiActive(): boolean {
    return this.generator !== null && this.config.ai && this.generatorReady();
  }

  getConfig(): CommentaryConfig {
    return { ...this.config };
  }

  updateConfig(patch: Partial<CommentaryConfig>): CommentaryConfig {
    this.config = CommentaryConfigSchema.parse({ ...this.config, ...patch });
    return this.getConfig();
  }

  getHistory(): CommentaryItem[] {
    return [...this.history];
  }

  /**
   * Called when an engine event happens. Returns a new commentary item if auto commentary is enabled.
   */
  onEvent(event: EngineEvent, state?: MatchState): CommentaryItem | null {
    if (!this.config.enabled || !this.config.autoEvents) {
      return null;
    }

    const text = buildEventCommentary(event, state, this.config.language);
    if (!text) return null;

    const item = this.item(text, event.type);
    this.addHistory(item);
    return item;
  }

  /**
   * Event line, preferring the model. Falls back to the phrasebook whenever the model is not
   * configured, is busy, times out or answers with something unusable.
   */
  async onEventAsync(event: EngineEvent, state?: MatchState): Promise<CommentaryItem | null> {
    const local = this.onEvent(event, state);
    if (!state || !this.generator || !this.config.ai || this.inFlight >= MAX_IN_FLIGHT) return local;
    this.inFlight++;
    try {
      const text = await this.generator({
        state,
        moment: describeMoment(event, state),
        lang: this.config.language,
      });
      if (!text || !local) return local;
      local.text = text;
      return local;
    } catch {
      return local;
    } finally {
      this.inFlight--;
    }
  }

  /**
   * One line per delivery. The big moments already get an event line, so this only fills the
   * gaps — and it never repeats a state or speaks faster than a person could.
   */
  onBall(state: MatchState): CommentaryItem | null {
    if (!this.config.enabled || !this.config.autoEvents) return null;
    const key = `${state.id}:${state.currentInnings}:${state.score.overs}.${state.score.balls}:${state.score.runs}:${state.score.wkts}`;
    if (key === this.lastBallKey) return null;
    const at = this.now();
    if (at - this.lastBallAt < MIN_BALL_GAP_MS) return null;
    const text = buildBallCommentary(state, this.config.language);
    if (!text) return null;
    this.lastBallKey = key;
    this.lastBallAt = at;
    const item = this.item(text, 'BALL');
    this.addHistory(item);
    return item;
  }

  /** Ball line, with the same model-first, phrasebook-always behaviour as events. */
  async onBallAsync(state: MatchState): Promise<CommentaryItem | null> {
    const local = this.onBall(state);
    if (!local || !this.generator || !this.config.ai || this.inFlight >= MAX_IN_FLIGHT) return local;
    this.inFlight++;
    try {
      const text = await this.generator({
        state,
        moment: describeMoment(null, state),
        lang: this.config.language,
      });
      if (text) local.text = text;
      return local;
    } catch {
      return local;
    } finally {
      this.inFlight--;
    }
  }

  /** Speak a custom phrase or trigger a manual TTS line. */
  speak(text: string, eventType = 'CUSTOM'): CommentaryItem {
    const item = this.item(text.trim(), eventType);
    this.addHistory(item);
    return item;
  }

  private item(text: string, eventType: string): CommentaryItem {
    const at = this.now();
    return {
      id: `comm-${at}-${Math.random().toString(36).slice(2, 7)}`,
      text,
      eventType,
      timestamp: at,
      lang: this.config.language,
    };
  }

  private addHistory(item: CommentaryItem): void {
    this.history.unshift(item);
    if (this.history.length > MAX_HISTORY) {
      this.history.pop();
    }
  }
}
