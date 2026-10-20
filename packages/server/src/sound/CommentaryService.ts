import {
  buildBallCommentary,
  buildEventCommentary,
  CommentaryConfigSchema,
  type CommentaryConfig,
  type CommentaryItem,
  type EngineEvent,
  type MatchState,
} from '@stumpcast/shared';

const MAX_HISTORY = 30;
/** A delivery every ~20 s is normal; this only stops bursts after a resync or a batch of balls. */
const MIN_BALL_GAP_MS = 5_000;

export class CommentaryService {
  private config: CommentaryConfig;
  private history: CommentaryItem[] = [];
  private lastBallKey = '';
  private lastBallAt = 0;

  constructor(
    initialConfig?: Partial<CommentaryConfig>,
    private readonly now: () => number = Date.now,
  ) {
    this.config = CommentaryConfigSchema.parse(initialConfig ?? {});
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

    const text = buildEventCommentary(event, state);
    if (!text) return null;

    const item: CommentaryItem = {
      id: `comm-${this.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text,
      eventType: event.type,
      timestamp: this.now(),
    };

    this.addHistory(item);
    return item;
  }

  /**
   * Speak a custom phrase or trigger manual TTS line.
   */
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
    const text = buildBallCommentary(state);
    if (!text) return null;
    this.lastBallKey = key;
    this.lastBallAt = at;
    const item: CommentaryItem = {
      id: `comm-${at}-${Math.random().toString(36).slice(2, 7)}`,
      text,
      eventType: 'BALL',
      timestamp: at,
    };
    this.addHistory(item);
    return item;
  }

  speak(text: string, eventType = 'CUSTOM'): CommentaryItem {
    const item: CommentaryItem = {
      id: `comm-${this.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text: text.trim(),
      eventType,
      timestamp: this.now(),
    };

    this.addHistory(item);
    return item;
  }

  private addHistory(item: CommentaryItem): void {
    this.history.unshift(item);
    if (this.history.length > MAX_HISTORY) {
      this.history.pop();
    }
  }
}
