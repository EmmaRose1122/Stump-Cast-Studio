import {
  AdvancedCommentaryEngine,
  AdvancedCommentaryConfigSchema,
  type AdvancedCommentaryConfig,
  type CommentatorPersona,
  type CommentaryPair,
  type GeneratedCommentary,
  COMMENTATOR_PERSONAS,
  COMMENTARY_PAIRS,
} from '@stumpcast/shared';
import type { EngineEvent, MatchState } from '@stumpcast/shared';
import { CommentaryTts, type TtsOptions, type TtsEngine } from './tts';

const MAX_HISTORY = 50;
const MIN_BALL_GAP_MS = 5_000;
const MAX_IN_FLIGHT = 2;

export interface AdvancedCommentaryRequest {
  state: unknown;
  moment: string;
  lang: 'hi' | 'ur' | 'en';
  persona: CommentatorPersona;
  mode?: 'live' | 'analysis';
}

export type AdvancedCommentaryGenerator = (req: AdvancedCommentaryRequest) => Promise<string | null>;

export class AdvancedCommentaryService {
  private engine: AdvancedCommentaryEngine;
  private tts: CommentaryTts;
  private history: GeneratedCommentary[] = [];
  private lastBallKey = '';
  private lastBallAt = 0;
  private inFlight = 0;
  private generator: AdvancedCommentaryGenerator | null = null;
  private generatorReady: () => boolean = () => true;

  constructor(
    initialConfig?: Partial<AdvancedCommentaryConfig>,
    private readonly now: () => number = Date.now,
    ttsOptions?: TtsOptions
  ) {
    this.engine = new AdvancedCommentaryEngine(initialConfig, () => null, now);
    this.tts = new CommentaryTts(ttsOptions ?? { getApiKey: () => null, cacheDir: '.' });
  }

  setTts(tts: CommentaryTts): void {
    this.tts = tts;
  }

  setGenerator(gen: AdvancedCommentaryGenerator | null, ready: () => boolean = () => true): void {
    this.generator = gen;
    this.generatorReady = ready;
    this.engine.setGenerator(
      (req) => gen?.({ ...req, persona: COMMENTATOR_PERSONAS[0]! }) ?? Promise.resolve(null),
      ready
    );
  }

  get aiActive(): boolean {
    return this.generator !== null && this.engine.getConfig().ai && this.generatorReady();
  }

  getConfig(): AdvancedCommentaryConfig {
    return this.engine.getConfig();
  }

  updateConfig(patch: Partial<AdvancedCommentaryConfig>): AdvancedCommentaryConfig {
    return this.engine.updateConfig(patch);
  }

  getHistory(): GeneratedCommentary[] {
    return [...this.history];
  }

  /** True when the AI analyst has been silent for at least the configured gap. */
  analysisDue(at = this.now()): boolean {
    const config = this.engine.getConfig();
    if (!config.enabled || !config.continuousMode || !config.tacticalAnalysis) return false;
    const last = this.history[0]?.timestamp ?? 0;
    return at - last >= config.minGapMs;
  }

  getPersonas(): CommentatorPersona[] {
    return this.engine.getPersonas();
  }

  getPairs(): CommentaryPair[] {
    return this.engine.getPairs();
  }

  getUrduVoices(): { male: string[]; female: string[] } {
    return this.engine.getUrduVoices();
  }

  getPersonaById(id: string): CommentatorPersona | undefined {
    return this.engine.getPersonaById(id);
  }

  getPairById(id: string): CommentaryPair | undefined {
    return this.engine.getPairById(id);
  }

  async getEngine(lang: 'hi' | 'ur' | 'en' = 'hi'): Promise<TtsEngine> {
    return this.tts.engine(lang);
  }

  lastError(): string | null {
    return this.tts.lastError();
  }

  register(id: string, text: string, lang: 'hi' | 'ur' | 'en' = 'hi'): void {
    this.tts.register(id, text, lang);
  }

  async wav(id: string): Promise<Buffer | null> {
    return this.tts.wav(id);
  }

  async speakNow(text: string, lang: 'hi' | 'ur' | 'en' = 'hi', persona?: CommentatorPersona): Promise<Buffer | null> {
    const voice = persona?.voiceName ?? 'Kore';
    const originalVoice = this.tts['chosenVoice'];
    return this.tts.speakNow(text, lang);
  }

  onEvent(event: EngineEvent, state?: MatchState): GeneratedCommentary | null {
    const item = this.engine.onEvent(event, state);
    if (item) {
      this.addHistory(item);
      this.register(item.id, item.text, item.lang);
    }
    return item;
  }

  async onEventAsync(event: EngineEvent, state?: MatchState): Promise<GeneratedCommentary | null> {
    const local = this.onEvent(event, state);
    if (!local || !state || !this.generator || !this.engine.getConfig().ai || this.inFlight >= MAX_IN_FLIGHT) {
      return local;
    }
    this.inFlight++;
    try {
      const text = await this.generator({
        state,
        moment: this.describeMoment(event, state),
        lang: this.engine.getConfig().language,
        persona: local.speaker,
      });
      if (text && local) {
        local.text = text;
      }
      return local;
    } catch {
      return local;
    } finally {
      this.inFlight--;
    }
  }

  onBall(state?: MatchState): GeneratedCommentary | null {
    if (!state) return null;
    const key = `${state.id}:${state.currentInnings}:${state.score.overs}.${state.score.balls}:${state.score.runs}:${state.score.wkts}`;
    if (key === this.lastBallKey) return null;
    const at = this.now();
    if (at - this.lastBallAt < MIN_BALL_GAP_MS) return null;

    const item = this.engine.onBall(state);
    if (item) {
      this.lastBallKey = key;
      this.lastBallAt = at;
      this.addHistory(item);
      this.register(item.id, item.text, item.lang);
    }
    return item;
  }

  async onBallAsync(state?: MatchState): Promise<GeneratedCommentary | null> {
    const local = this.onBall(state);
    if (!local || !state || !this.generator || !this.engine.getConfig().ai || this.inFlight >= MAX_IN_FLIGHT) {
      return local;
    }
    this.inFlight++;
    try {
      const text = await this.generator({
        state,
        moment: this.describeMoment(null, state),
        lang: this.engine.getConfig().language,
        persona: local.speaker,
      });
      if (text) local.text = text;
      return local;
    } catch {
      return local;
    } finally {
      this.inFlight--;
    }
  }

  /**
   * Expert-analysis line used between balls and during quiet passages. The local seed is factual;
   * the model is allowed to add a cautious forecast, but only from the match facts it receives.
   */
  async onAnalysisAsync(state?: MatchState): Promise<GeneratedCommentary | null> {
    if (!state || !this.analysisDue() || this.inFlight >= MAX_IN_FLIGHT) return null;
    const local = this.engine.onAnalysis(state);
    if (!local) return null;
    if (this.generator && this.engine.getConfig().ai) {
      this.inFlight++;
      try {
        const text = await this.generator({
          state,
          moment: this.describeAnalysis(state),
          lang: this.engine.getConfig().language,
          persona: local.speaker,
          mode: 'analysis',
        });
        if (text) local.text = text;
      } catch {
        /* the factual local seed still goes out */
      } finally {
        this.inFlight--;
      }
    }
    this.addHistory(local);
    this.register(local.id, local.text, local.lang);
    return local;
  }

  private describeAnalysis(state: MatchState): string {
    const batting = state.teams.find((team) => team.id === state.battingTeamId)?.name ?? state.teams[0].name;
    const chase = state.runsNeeded !== undefined && state.ballsLeft !== undefined;
    return chase
      ? `${batting} are chasing; analyse the required rate, wickets in hand and the next few overs`
      : `${batting} are building an innings at ${state.score.runs}-${state.score.wkts}; analyse the current phase and what both sides should do next`;
  }

  speak(text: string, eventType = 'CUSTOM', speakerId?: string): GeneratedCommentary {
    const item = this.engine.speak(text, eventType, speakerId);
    this.addHistory(item);
    this.register(item.id, item.text, item.lang);
    return item;
  }

  private describeMoment(event: EngineEvent | null, state: MatchState): string {
    const striker = state.batters.find((b) => b.onStrike)?.name ?? 'the batter';
    const bowler = state.bowler?.name ?? 'the bowler';
    if (event) {
      const p = event.payload as Record<string, unknown>;
      switch (event.type) {
        case 'FOUR':
          return `${p.batter ?? striker} scored a four off ${bowler}`;
        case 'SIX':
          return `${p.batter ?? striker} hit a six off ${bowler}`;
        case 'WICKET':
          return `${p.out ?? striker} is out, bowled by ${bowler}, score ${state.score.runs}-${state.score.wkts}`;
        case 'FIFTY':
          return `${p.name ?? striker} reached a fifty`;
        case 'HUNDRED':
          return `${p.name ?? striker} reached a century`;
        case 'OVER_END':
          return `end of over ${p.over ?? state.score.overs}, score ${state.score.runs}-${state.score.wkts}`;
        case 'NEW_BATTER':
          return `${p.name ?? 'a new batter'} came to the crease`;
        case 'DRS':
          return 'a review was taken';
        case 'INNINGS_END':
          return `the innings ended on ${state.score.runs}-${state.score.wkts}`;
        default:
          return `${event.type} happened`;
      }
    }
    const ball = state.thisOver[state.thisOver.length - 1] ?? state.lastBalls[state.lastBalls.length - 1];
    if (!ball) return 'a delivery was bowled';
    if (ball.wicket) return `${striker} got out off ${bowler}`;
    if (ball.extras?.type === 'wide') return `wide ball from ${bowler}`;
    if (ball.extras?.type === 'noball') return `no ball from ${bowler}, ${ball.runs} run(s) off the bat`;
    if (ball.runs === 0) return `dot ball from ${bowler}`;
    return `${striker} took ${ball.runs} run(s) off ${bowler}`;
  }

  private addHistory(item: GeneratedCommentary): void {
    this.history.unshift(item);
    if (this.history.length > MAX_HISTORY) {
      this.history.pop();
    }
  }
}