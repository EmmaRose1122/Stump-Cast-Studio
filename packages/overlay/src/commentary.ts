export interface CommentaryPayload {
  id: string;
  text: string;
  eventType?: string;
  timestamp: number;
}

export interface SpeechSynthesisUtteranceLike {
  text: string;
  rate: number;
  pitch: number;
  volume: number;
  voice?: unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onend?: ((this: any, ev?: any) => any) | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onerror?: ((this: any, ev?: any) => any) | null;
}

export interface OverlayCommentaryOptions {
  getSpeechSynthesis?: () => SpeechSynthesis | undefined;
  createUtterance?: (text: string) => SpeechSynthesisUtteranceLike;
  getVoices?: () => SpeechSynthesisVoice[];
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (id: unknown) => void;
}

/** A stuck utterance must not silence commentary for the rest of the session. */
const SPEAK_TIMEOUT_MS = 30_000;
/** Commentary is live reporting: a backlog older than a couple of ball-times is worth dropping. */
const MAX_QUEUE = 8;

export class OverlayCommentary {
  private queue: string[] = [];
  private speaking = false;
  private enabled = true;
  private volume = 1.0;
  private rate = 1.05;
  private pitch = 1.0;
  private timeout: unknown = null;

  private readonly setTimer: (fn: () => void, ms: number) => unknown;
  private readonly clearTimer: (id: unknown) => void;

  constructor(private readonly opts: OverlayCommentaryOptions = {}) {
    this.setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer =
      opts.clearTimer ?? ((id) => clearTimeout(id as ReturnType<typeof setTimeout>));
  }

  private get synth(): SpeechSynthesis | undefined {
    if (this.opts.getSpeechSynthesis) return this.opts.getSpeechSynthesis();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      return window.speechSynthesis;
    }
    return undefined;
  }

  setEnabled(val: boolean): void {
    this.enabled = val;
    if (!val) this.stop();
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
  }

  setRate(r: number): void {
    this.rate = Math.max(0.5, Math.min(2, r));
  }

  setPitch(p: number): void {
    this.pitch = Math.max(0.5, Math.min(2, p));
  }

  handle(payload: unknown): void {
    if (!payload || typeof payload !== 'object') return;
    const p = payload as Record<string, unknown>;
    const text = typeof p.text === 'string' ? p.text : '';
    if (text) {
      this.speak(text);
    }
  }

  speak(text: string): void {
    if (!this.enabled || !text.trim()) return;
    this.queue.push(text.trim());
    while (this.queue.length > MAX_QUEUE) this.queue.shift();
    this.processQueue();
  }

  stop(): void {
    this.queue = [];
    this.speaking = false;
    this.clearTimeout();
    this.synth?.cancel();
  }

  private clearTimeout(): void {
    if (this.timeout !== null) {
      this.clearTimer(this.timeout);
      this.timeout = null;
    }
  }

  private finish(): void {
    this.speaking = false;
    this.clearTimeout();
    this.processQueue();
  }

  private processQueue(): void {
    if (this.speaking || this.queue.length === 0) return;
    const synth = this.synth;
    if (!synth) return;

    const nextText = this.queue.shift();
    if (!nextText) return;

    try {
      const utterance: SpeechSynthesisUtteranceLike = this.opts.createUtterance
        ? this.opts.createUtterance(nextText)
        : typeof SpeechSynthesisUtterance !== 'undefined'
          ? new SpeechSynthesisUtterance(nextText)
          : { text: nextText, rate: this.rate, pitch: this.pitch, volume: this.volume };

      utterance.rate = this.rate;
      utterance.pitch = this.pitch;
      utterance.volume = this.volume;

      const voices = this.opts.getVoices ? this.opts.getVoices() : synth.getVoices?.() ?? [];
      // Commentary is Roman Hindi: a Hindi voice reads it best, an Indian English voice is the
      // next best thing, and any English voice is the fallback.
      const score = (v: SpeechSynthesisVoice) =>
        v.lang.startsWith('hi') ? 0 : v.lang.startsWith('en-IN') ? 1 : v.lang.startsWith('en') ? 2 : 9;
      const preferred = voices
        .map((v, i) => ({ v, i }))
        .filter(({ v }) => score(v) < 9)
        .sort((a, b) => score(a.v) - score(b.v) || (b.v.default ? 1 : 0) - (a.v.default ? 1 : 0) || a.i - b.i)[0];
      if (preferred) utterance.voice = preferred.v;

      utterance.onend = () => this.finish();
      utterance.onerror = () => this.finish();

      this.speaking = true;
      // Chrome drops `onend`/`onerror` for interrupted utterances, so the flag needs its own deadline.
      this.clearTimeout();
      this.timeout = this.setTimer(() => {
        this.timeout = null;
        synth.cancel();
        this.finish();
      }, SPEAK_TIMEOUT_MS);
      synth.speak(utterance as unknown as SpeechSynthesisUtterance);
    } catch {
      this.clearTimeout();
      this.speaking = false;
      this.processQueue();
    }
  }
}
