import {
  buildCommentaryPrompt,
  cleanCommentary,
  type CommentaryRequest,
} from './prompt';

export type { CommentaryRequest } from './prompt';

export interface GeminiOptions {
  getApiKey: () => Promise<string | null> | string | null;
  model?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  /** Analysis is two sentences behind the ball feed, so it can afford a longer model round trip. */
  analysisTimeoutMs?: number;
  endpoint?: string;
}

const DEFAULT_MODEL = 'gemini-2.5-flash';
const DEFAULT_TIMEOUT_MS = 1200;

/**
 * Natural, non-templated narration from Gemini. Everything about this module is optional: with no
 * key, no network or a slow model the caller falls back to the local phrasebook, because silence
 * on air is worse than a stock line.
 */
export class GeminiCommentator {
  private readonly model: string;
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;
  private readonly analysisTimeoutMs: number;
  private readonly endpoint: string;
  private lastFailure: string | null = null;
  private cooldownUntil = 0;

  constructor(private readonly opts: GeminiOptions) {
    this.model = opts.model ?? DEFAULT_MODEL;
    this.fetchFn = opts.fetchFn ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.analysisTimeoutMs = opts.analysisTimeoutMs ?? 6000;
    this.endpoint = opts.endpoint ?? 'https://generativelanguage.googleapis.com';
  }

  lastError(): string | null {
    return this.lastFailure;
  }

  /** One short spoken line, or null when the model is unavailable or says something unusable. */
  async line(req: CommentaryRequest): Promise<string | null> {
    if (Date.now() < this.cooldownUntil) return null;
    let key: string | null = null;
    try {
      key = await this.opts.getApiKey();
    } catch (err) {
      this.lastFailure = `Gemini key unavailable: ${err instanceof Error ? err.message : String(err)}`;
      return null;
    }
    if (!key) {
      this.lastFailure = 'No Gemini API key';
      return null;
    }

    const prompt = buildCommentaryPrompt(req);
    const controller = new AbortController();
    const timeout = req.mode === 'analysis' ? this.analysisTimeoutMs : this.timeoutMs;
    const timer = setTimeout(() => controller.abort(), timeout);
    // Node's fetch types and the DOM's disagree on AbortSignal; this is the global fetch either way.
    const init = {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: req.mode === 'analysis' ? 0.85 : 1.0,
          maxOutputTokens: req.mode === 'analysis' ? 512 : 120,
          // 2.5 Flash otherwise spends the answer budget on hidden reasoning and can cut a word
          // mid-script. Commentary does not need chain-of-thought, only a fluent broadcast line.
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
      signal: controller.signal,
    } as unknown as RequestInit;
    try {
      const res = await this.fetchFn(
        `${this.endpoint}/v1beta/models/${encodeURIComponent(this.model)}:generateContent`,
        init,
      );
      if (!res.ok) {
        const detail = (await res.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 180);
        this.lastFailure = `Gemini HTTP ${res.status}${detail ? `: ${detail}` : ''}`;
        if (res.status === 429 || res.status >= 500) {
          const retryAfter = Number(res.headers?.get('retry-after'));
          const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
            ? Math.min(5 * 60_000, retryAfter * 1000)
            : 60_000;
          this.cooldownUntil = Date.now() + waitMs;
        }
        return null;
      }
      const body = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text = body.candidates?.[0]?.content?.parts
        ?.map((p) => p.text ?? '')
        .join('')
        .trim();
      const line = cleanCommentary(text, req.mode === 'analysis' ? 2 : 1);
      this.lastFailure = line ? null : 'Gemini returned no usable commentary';
      return line;
    } catch (err) {
      this.lastFailure =
        err instanceof Error && err.name === 'AbortError'
          ? `Gemini timed out after ${timeout} ms`
          : `Gemini request failed: ${err instanceof Error ? err.message : String(err)}`;
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
