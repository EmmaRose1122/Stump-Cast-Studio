import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { CommentaryLanguage } from '@stumpcast/shared';
import { pcmToWav } from './wav';

export type TtsEngine = 'gemini' | 'system' | 'none';

/** Gemini's TTS preview model: it reads Hindi, Urdu and English, which a desktop voice may not. */
const DEFAULT_TTS_MODEL = 'gemini-2.5-flash-preview-tts';
/** Prebuilt voices; the choice is stylistic, the model handles the script. */
const DEFAULT_VOICE = 'Kore';
/** Gemini returns 16-bit mono PCM at this rate. */
const GEMINI_RATE = 24_000;
const DEFAULT_TIMEOUT_MS = 8_000;
/** Lines repeat a lot on a cricket feed; keeping the recent ones avoids re-saying the work. */
const MAX_TRACKED = 200;
/** Fits comfortably inside MAX_TRACKED, so a line kept in memory almost always has its audio. */
const MAX_CACHED_FILES = 300;
/** Which installed voices can read which script. */
const SCRIPT_CULTURES: Record<CommentaryLanguage, string[]> = {
  ur: ['ur'],
  hi: ['hi', 'mr'],
  en: ['en'],
};
/** A desktop voice that produced this little said nothing at all. */
const MIN_USEFUL_BYTES = 1_024;
/** Refused requests are retried once; a wrong key or model is not worth a second call. */
const RETRY_DELAY_MS = 400;

interface GeminiAttempt {
  wav: Buffer | null;
  /** Worth a second call? (rate limit / server error, not a bad key) */
  retryable: boolean;
  /** What to show the operator when nothing was spoken. Empty only on success. */
  reason: string;
  tookMs: number;
}

/** The `error.message` Google puts in a failed response body, shortened for a status line. */
const jsonError = (body: string): string => {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    return (parsed.error?.message ?? body).replace(/\s+/g, ' ').trim().slice(0, 180);
  } catch {
    return body.replace(/\s+/g, ' ').trim().slice(0, 180);
  }
};

export interface TtsOptions {
  getApiKey: () => string | null | Promise<string | null>;
  cacheDir: string;
  /** Read per request so switching the voice in the admin panel takes effect at once. */
  voice?: () => string;
  model?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
  endpoint?: string;
  /** Test seam for the platform speech engines. Null means "this engine is not installed". */
  run?: (file: string, args: string[], env?: Record<string, string>) => Promise<Buffer | null>;
  platform?: NodeJS.Platform;
}

interface TrackedLine {
  text: string;
  lang: CommentaryLanguage;
}

/** PowerShell gets the line through the environment, never through the command string. */
const PS_SCRIPT = [
  'Add-Type -AssemblyName System.Speech;',
  '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer;',
  'if ($env:STUMCAST_TTS_VOICE) { $s.SelectVoice($env:STUMCAST_TTS_VOICE) };',
  '$s.Rate = [int]$env:STUMCAST_TTS_RATE;',
  '$s.Volume = [int]$env:STUMCAST_TTS_VOLUME;',
  '$s.SetOutputToWaveFile($env:STUMCAST_TTS_OUT);',
  '$s.Speak($env:STUMCAST_TTS_TEXT);',
  '$s.Dispose();',
].join(' ');

const runCommand = (
  file: string,
  args: string[],
  env?: Record<string, string>,
): Promise<Buffer | null> =>
  new Promise((resolve) => {
    execFile(
      file,
      args,
      { env: { ...process.env, ...env }, timeout: 20_000, windowsHide: true },
      (err, stdout) => resolve(err ? null : Buffer.from(stdout)),
    );
  });

/**
 * Speaks a commentary line to a WAV. The overlay's browser speech API has no voice inside an OBS
 * browser source, which is why captions were all a broadcast ever got: the audio is made here,
 * on the machine that runs the engine, and the overlay only plays it.
 *
 * Gemini is used when a key is stored, because it is the only engine here that reads Urdu well.
 * Otherwise the desktop's own speech engine is used, and if neither exists the overlay falls back
 * to whatever the browser can do.
 */
export class CommentaryTts {
  private readonly cacheDir: string;
  private readonly lines = new Map<string, TrackedLine>();
  /** Same line in flight twice (preview + overlay both asking) must not be spoken twice. */
  private readonly pending = new Map<string, Promise<Buffer | null>>();
  /** Asked once: listing desktop voices costs a PowerShell launch. */
  private voices: Promise<string[]> | null = null;
  private lastFailure: string | null = null;

  constructor(private readonly opts: TtsOptions) {
    this.cacheDir = path.join(opts.cacheDir, 'commentary-tts');
  }

  /** Which engine a new line would use right now. `none` means captions only. */
  async engine(lang: CommentaryLanguage = 'hi'): Promise<TtsEngine> {
    if (await this.key()) return 'gemini';
    return this.systemEngine(lang);
  }

  /**
   * Whether the desktop's own voice can read this script, ignoring the stored key: when Gemini
   * refuses a line the machine still has to say something.
   */
  async systemEngine(lang: CommentaryLanguage = 'hi'): Promise<TtsEngine> {
    const voices = await this.installedVoices();
    if (!voices) return 'system';
    const wanted = SCRIPT_CULTURES[lang] ?? [];
    return voices.some((c) => wanted.some((w) => c.toLowerCase().startsWith(w)))
      ? 'system'
      : 'none';
  }

  /** Why the last synthesis failed, so "captions only" can be explained instead of guessed. */
  lastError(): string | null {
    return this.lastFailure;
  }

  /** Cultures of the voices this machine has, or null where the platform reads any script. */
  async installedVoices(): Promise<string[] | null> {
    if (this.platform() !== 'win32') return null;
    this.voices ??= this.run(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        "Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; " +
          '$s.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Culture.Name }',
      ],
    ).then((out) =>
      out
        ? out
            .toString('utf8')
            .split(/\r?\n/)
            .map((c) => c.trim())
            .filter(Boolean)
        : [],
    );
    return this.voices;
  }

  /** Remember a line so the overlay can ask for its audio by id. */
  register(id: string, text: string, lang: CommentaryLanguage = 'hi'): void {
    if (this.lines.size >= MAX_TRACKED) {
      const oldest = this.lines.keys().next();
      if (!oldest.done) this.lines.delete(oldest.value);
    }
    this.lines.set(id, { text, lang });
  }

  /** WAV bytes for a registered line, synthesised on first ask and cached on disk afterwards. */
  async wav(id: string): Promise<Buffer | null> {
    const line = this.lines.get(id);
    if (!line) return null;
    const key = this.cacheKey(line);
    const file = path.join(this.cacheDir, `${key}.wav`);
    try {
      return await fs.readFile(file);
    } catch {
      // not cached yet
    }
    const inflight = this.pending.get(key);
    if (inflight) return inflight;
    const job = this.synthesise(line, file).finally(() => this.pending.delete(key));
    this.pending.set(key, job);
    return job;
  }

  /** Speaks an arbitrary line straight away, used by the "test voice" button. */
  async speakNow(text: string, lang: CommentaryLanguage = 'hi'): Promise<Buffer | null> {
    return this.synthesise({ text, lang }, path.join(this.cacheDir, `${this.cacheKey({ text, lang })}.wav`));
  }

  private cacheKey(l: TrackedLine): string {
    return createHash('sha1')
      .update(`${l.lang}|${this.voiceName}|${l.text}`)
      .digest('hex');
  }

  /** The stored config calls the default voice "default"; no engine knows that name. */
  private get voiceName(): string {
    const v = this.chosenVoice;
    return !v || v === 'default' ? DEFAULT_VOICE : v;
  }

  /** A desktop voice is named, not "Kore": the system engine takes it only when one was chosen. */
  private get systemVoice(): string {
    const v = this.chosenVoice;
    return !v || v === 'default' ? '' : v;
  }

  private get chosenVoice(): string {
    try {
      return this.opts.voice?.().trim() ?? '';
    } catch {
      return '';
    }
  }

  private async key(): Promise<string | null> {
    try {
      return await this.opts.getApiKey();
    } catch {
      return null;
    }
  }

  private get run() {
    return this.opts.run ?? runCommand;
  }

  private platform(): NodeJS.Platform {
    return this.opts.platform ?? process.platform;
  }

  private async synthesise(line: TrackedLine, file: string): Promise<Buffer | null> {
    const gemini = await this.gemini(line);
    if (gemini) {
      this.lastFailure = null;
      return this.remember(gemini, file);
    }
    const reason = this.lastFailure;
    // A stored key used to switch the desktop voice off completely, so one rate-limited request
    // cost the line and the broadcast went silent mid-over.
    if ((await this.systemEngine(line.lang)) !== 'system') return null;
    const system = await this.system(line, file);
    if (system && system.length >= MIN_USEFUL_BYTES) {
      // Keep the model's complaint on screen: the line was rescued by a voice that cannot read
      // every script, and a key that is being refused is worth fixing.
      this.lastFailure = reason ? `${reason} — spoken with this PC's voice instead` : null;
      return this.remember(system, file);
    }
    // The desktop voice answered with silence: it has no pack for this script.
    this.lastFailure ??= `No desktop voice for ${line.lang.toUpperCase()} on this machine`;
    return null;
  }

  private async remember(wav: Buffer, file: string): Promise<Buffer> {
    await fs.mkdir(this.cacheDir, { recursive: true });
    await fs.writeFile(file, wav).catch(() => undefined);
    void this.trimCache();
    return wav;
  }

  /**
   * The cache used to grow for the life of the installation (hundreds of MB over a season).
   * Lines are only ever replayed while they are still in memory, so the oldest files can go.
   */
  private async trimCache(): Promise<void> {
    try {
      const names = (await fs.readdir(this.cacheDir)).filter((n) => n.endsWith('.wav'));
      if (names.length <= MAX_CACHED_FILES) return;
      const aged = await Promise.all(
        names.map(async (name) => {
          const full = path.join(this.cacheDir, name);
          const st = await fs.stat(full).catch(() => null);
          return { full, at: st?.mtimeMs ?? 0 };
        }),
      );
      aged.sort((a, b) => b.at - a.at);
      await Promise.all(aged.slice(MAX_CACHED_FILES).map((f) => fs.unlink(f.full).catch(() => undefined)));
    } catch {
      // A cache that cannot be trimmed is still a working cache.
    }
  }

  /** The model that can actually read Urdu; null when there is no key or it fails. */
  private async gemini(line: TrackedLine): Promise<Buffer | null> {
    const timeoutMs = this.opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const first = await this.geminiAttempt(line);
    if (first.wav) return first.wav;
    this.lastFailure = first.reason;
    // A refused request (rate limit, transient server error) gets one more try: the overlay waits
    // about nine seconds for the audio, and a line it never hears is a line the broadcast lost.
    // An attempt that ran the whole timeout is not retried — by then the overlay has given up.
    if (!first.retryable || first.tookMs > timeoutMs / 2) return null;
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    const second = await this.geminiAttempt(line);
    if (second.wav) return second.wav;
    this.lastFailure = `${first.reason} (retry: ${second.reason})`;
    return null;
  }

  private async geminiAttempt(line: TrackedLine): Promise<GeminiAttempt> {
    const key = await this.key();
    if (!key) return { wav: null, retryable: false, reason: 'No Gemini key stored', tookMs: 0 };
    const started = Date.now();
    const fetchFn = this.opts.fetchFn ?? fetch;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    const init = {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: line.text }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: this.voiceName } },
          },
        },
      }),
      signal: controller.signal,
    } as unknown as RequestInit;
    const took = () => Date.now() - started;
    try {
      const res = await fetchFn(
        `${this.opts.endpoint ?? 'https://generativelanguage.googleapis.com'}/v1beta/models/${encodeURIComponent(this.opts.model ?? DEFAULT_TTS_MODEL)}:generateContent`,
        init,
      );
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        const message = jsonError(detail);
        return {
          wav: null,
          // 429 and 5xx mean "ask again"; 400/401/403 mean the key or the model is wrong and a
          // second call would only burn the quota further.
          retryable: res.status === 429 || res.status >= 500,
          reason: `Gemini HTTP ${res.status}${message ? `: ${message}` : ''}`,
          tookMs: took(),
        };
      }
      const body = (await res.json()) as {
        candidates?: { content?: { parts?: { inlineData?: { mimeType?: string; data?: string } }[] } }[];
      };
      const part = body.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
      const data = part?.inlineData?.data;
      if (!data) return { wav: null, retryable: false, reason: 'Gemini returned no audio', tookMs: took() };
      const rate = Number(/rate=(\d+)/.exec(part?.inlineData?.mimeType ?? '')?.[1] ?? GEMINI_RATE);
      return { wav: pcmToWav(Buffer.from(data, 'base64'), rate || GEMINI_RATE), retryable: false, reason: '', tookMs: took() };
    } catch (err) {
      const aborted = controller.signal.aborted;
      return {
        wav: null,
        retryable: false,
        reason: aborted
          ? `Gemini timed out after ${this.opts.timeoutMs ?? DEFAULT_TIMEOUT_MS} ms`
          : `Gemini request failed: ${err instanceof Error ? err.name : String(err)}`,
        tookMs: took(),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /** The desktop's own voice: SAPI on Windows, `say` on macOS, eSpeak on Linux. */
  private async system(line: TrackedLine, file: string): Promise<Buffer | null> {
    await fs.mkdir(this.cacheDir, { recursive: true });
    const tmp = `${file}.tmp`;
    const env = {
      STUMCAST_TTS_TEXT: line.text,
      STUMCAST_TTS_OUT: tmp,
      STUMCAST_TTS_VOICE: this.systemVoice,
      STUMCAST_TTS_RATE: '1',
      STUMCAST_TTS_VOLUME: '100',
    };
    let ok = false;
    try {
      if (this.platform() === 'win32') {
        const out = await this.run(
          'powershell.exe',
          ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', PS_SCRIPT],
          env,
        );
        ok = !!out;
      } else if (this.platform() === 'darwin') {
        ok = !!(await this.run('say', ['-o', tmp, '--data-format=LEI16@22050', line.text]));
      } else {
        ok = !!(await this.run('espeak', ['-w', tmp, line.text]));
      }
    } catch {
      ok = false;
    }
    if (!ok) return null;
    try {
      return await fs.readFile(tmp);
    } catch {
      return null;
    } finally {
      await fs.rm(tmp, { force: true }).catch(() => undefined);
    }
  }
}