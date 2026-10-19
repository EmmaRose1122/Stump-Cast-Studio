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
}

export class OverlayCommentary {
  private queue: string[] = [];
  private speaking = false;
  private enabled = true;
  private volume = 1.0;
  private rate = 1.05;
  private pitch = 1.0;

  constructor(private readonly opts: OverlayCommentaryOptions = {}) {}

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
    this.processQueue();
  }

  stop(): void {
    this.queue = [];
    this.speaking = false;
    this.synth?.cancel();
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
      const englishVoice = voices.find(
        (v) =>
          v.lang.startsWith('en') &&
          (v.name.includes('Natural') || v.name.includes('English') || v.default),
      );
      if (englishVoice) {
        utterance.voice = englishVoice;
      }

      utterance.onend = () => {
        this.speaking = false;
        this.processQueue();
      };
      utterance.onerror = () => {
        this.speaking = false;
        this.processQueue();
      };

      this.speaking = true;
      synth.speak(utterance as unknown as SpeechSynthesisUtterance);
    } catch {
      this.speaking = false;
    }
  }
}
