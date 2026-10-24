export interface CommentaryPayload {
  id: string;
  text: string;
  eventType?: string;
  timestamp: number;
  /** Script the line is written in, so the right voice reads it. */
  lang?: 'hi' | 'ur' | 'en';
  /** Speaker persona info for voice selection */
  speaker?: {
    id: string;
    name: string;
    gender: 'male' | 'female';
    voiceName: string;
    primaryLanguage: 'hi' | 'ur' | 'en';
  };
}

/** The slice of HTMLAudioElement the player needs; keeps this file testable without a browser. */
export interface AudioPlayerLike {
  volume: number;
  playbackRate: number;
  play(): Promise<void> | void;
  pause(): void;
  onended: (() => void) | null;
  onerror: (() => void) | null;
}

export interface SpeechSynthesisUtteranceLike {
  text: string;
  rate: number;
  pitch: number;
  volume: number;
  lang?: string;
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
  /** Where the server-rendered voice lives. Empty (the default) means "not configured". */
  audioBase?: string;
  createAudio?: (url: string) => AudioPlayerLike;
}

/** A stuck utterance must not silence commentary for the rest of the session. */
const SPEAK_TIMEOUT_MS = 30_000;
/** Commentary is live reporting: a backlog older than a couple of ball-times is worth dropping. */
const MAX_QUEUE = 8;
/** How long to wait for the server to speak a line before falling back to the browser. */
const AUDIO_WAIT_MS = 9_000;

interface QueuedLine {
  id: string;
  text: string;
  lang?: CommentaryPayload['lang'];
  speaker?: CommentaryPayload['speaker'];
}

export class OverlayCommentary {
  private queue: QueuedLine[] = [];
  private speaking = false;
  private enabled = true;
  private volume = 1.0;
  private rate = 1.05;
  private pitch = 1.0;
  private timeout: unknown = null;
  /** The server-audio element currently playing, so a stop() can actually silence it. */
  private current: AudioPlayerLike | null = null;

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
    const id = typeof p.id === 'string' ? p.id : '';
    const lang = p.lang === 'hi' || p.lang === 'ur' || p.lang === 'en' ? p.lang : undefined;
    const speaker = p.speaker && typeof p.speaker === 'object' ? p.speaker as CommentaryPayload['speaker'] : undefined;
    if (text) {
      this.speak(text, lang, id, speaker);
    }
  }

  speak(text: string, lang?: CommentaryPayload['lang'], id = '', speaker?: CommentaryPayload['speaker']): void {
    if (!this.enabled || !text.trim()) return;
    this.queue.push({ id, text: text.trim(), lang, speaker });
    while (this.queue.length > MAX_QUEUE) this.queue.shift();
    this.processQueue();
  }

  stop(): void {
    this.queue = [];
    this.speaking = false;
    this.clearTimeout();
    // Server-rendered audio is a real element, not an utterance: without pausing it the line keeps
    // playing after the operator switched commentary off.
    if (this.current) {
      this.current.pause();
      this.current = null;
    }
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
    const next = this.queue.shift();
    if (!next) return;
    this.speaking = true;
    const player = this.playerFor(next);
    // The server is asked first because an OBS browser source has no speech engine of its own;
    // whatever the browser can do is only the fallback. When there is nothing to ask, the browser
    // speaks in the same turn instead of waiting on a request that will never be made.
    if (!player) {
      this.speakWithBrowser(next);
      return;
    }
    void this.speakServerAudio(player).then((played) => {
      if (!played) this.speakWithBrowser(next);
    });
  }

  private playerFor(line: QueuedLine): AudioPlayerLike | undefined {
    const base = this.opts.audioBase;
    if (!base || !line.id) return undefined;
    const url = `${base}/api/commentary/audio/${encodeURIComponent(line.id)}`;
    if (this.opts.createAudio) return this.opts.createAudio(url);
    // The DOM element's handler signatures take a typed event; the player only ever fires them.
    return typeof Audio !== 'undefined' ? (new Audio(url) as unknown as AudioPlayerLike) : undefined;
  }

  /** Play audio rendered by the server. False means "no voice there", not a failure to report. */
  private speakServerAudio(player: AudioPlayerLike): Promise<boolean> {
    player.volume = this.volume;
    player.playbackRate = this.rate;
    this.current = player;
    return new Promise<boolean>((resolve) => {
      let settled = false;
      const done = (played: boolean) => {
        if (settled) return;
        settled = true;
        this.clearTimeout();
        if (this.current === player) this.current = null;
        if (played) this.finish();
        else resolve(false);
      };
      player.onended = () => done(true);
      player.onerror = () => done(false);
      // The deadline is for reaching the audio, not for playing it: a rendered line is longer than
      // this, and cutting it off would then have the browser read the same line over the top.
      this.clearTimeout();
      this.timeout = this.setTimer(() => {
        this.timeout = null;
        player.pause();
        done(false);
      }, AUDIO_WAIT_MS);
      try {
        const played = player.play();
        if (played && typeof played.then === 'function') {
          played.then(
            () => this.clearTimeout(),
            () => done(false),
          );
        } else {
          this.clearTimeout();
        }
      } catch {
        done(false);
      }
    });
  }

  private speakWithBrowser(line: QueuedLine): void {
    const synth = this.synth;
    if (!synth) {
      this.finish();
      return;
    }
    try {
      const utterance: SpeechSynthesisUtteranceLike = this.opts.createUtterance
        ? this.opts.createUtterance(line.text)
        : typeof SpeechSynthesisUtterance !== 'undefined'
          ? new SpeechSynthesisUtterance(line.text)
          : { text: line.text, rate: this.rate, pitch: this.pitch, volume: this.volume };

      utterance.rate = this.rate;
      utterance.pitch = this.pitch;
      utterance.volume = this.volume;

      const voices = this.opts.getVoices ? this.opts.getVoices() : synth.getVoices?.() ?? [];
      // Read the line with a voice that speaks its script: an English voice cannot pronounce
      // Devanagari or Nastaliq. Anything else degrades to en-IN, then any English voice.
      const wanted =
        line.lang === 'ur' ? ['ur', 'hi', 'en-IN'] : line.lang === 'en' ? ['en'] : ['hi', 'en-IN', 'en'];
      const score = (v: SpeechSynthesisVoice) => {
        const prefix = wanted.findIndex((p) => v.lang.toLowerCase().startsWith(p));
        return prefix < 0 ? 9 : prefix;
      };
      utterance.lang = line.lang === 'ur' ? 'ur-PK' : line.lang === 'en' ? 'en-GB' : 'hi-IN';
      
      // Prefer voice matching speaker gender if available
      let preferred = voices
        .map((v, i) => ({ v, i }))
        .filter(({ v }) => score(v) < 9)
        .sort(
          (a, b) =>
            score(a.v) - score(b.v) ||
            (b.v.default ? 1 : 0) - (a.v.default ? 1 : 0) ||
            a.i - b.i,
        )[0];
      
      // If we have speaker info, try to match gender
      if (line.speaker && preferred) {
        const genderPref = line.speaker.gender === 'male' ? 'male' : 'female';
        const genderMatch = voices.find((v) => 
          score(v) < 9 && v.name.toLowerCase().includes(genderPref)
        );
        if (genderMatch) preferred = { v: genderMatch, i: 0 };
      }
      
      if (preferred) utterance.voice = preferred.v;

      utterance.onend = () => this.finish();
      utterance.onerror = () => this.finish();

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
