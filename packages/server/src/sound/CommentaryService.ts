import {
  buildEventCommentary,
  CommentaryConfigSchema,
  type CommentaryConfig,
  type CommentaryItem,
  type EngineEvent,
  type MatchState,
} from '@stumpcast/shared';

const MAX_HISTORY = 30;

export class CommentaryService {
  private config: CommentaryConfig;
  private history: CommentaryItem[] = [];

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
