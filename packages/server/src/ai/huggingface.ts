import {
  buildCommentaryPrompt,
  cleanCommentary,
  type CommentaryRequest,
} from './prompt';

export interface HuggingFaceOptions {
  getApiKey: () => Promise<string | null> | string | null;
  /** Any chat-completions model enabled for this Hugging Face account. */
  model?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  analysisTimeoutMs?: number;
  endpoint?: string;
}

export const DEFAULT_HF_TEXT_MODEL = 'Qwen/Qwen3-8B';
const DEFAULT_ENDPOINT = 'https://router.huggingface.co/v1/chat/completions';
const DEFAULT_TIMEOUT_MS = 3500;

/**
 * Text commentary through Hugging Face Inference Providers. The existing Hugging Face token also
 * powers XTTS, so one token covers voice and written lines. HF is credit-metered rather than
 * unlimited: a 402/429 is reported and cooled down instead of hammering the router every ball.
 */
export class HuggingFaceCommentator {
  private readonly model: string;
  private readonly fetchFn: typeof fetch;
  private readonly endpoint: string;
  private readonly timeoutMs: number;
  private readonly analysisTimeoutMs: number;
  private lastFailure: string | null = null;
  private cooldownUntil = 0;

  constructor(private readonly opts: HuggingFaceOptions) {
    this.model = opts.model ?? DEFAULT_HF_TEXT_MODEL;
    this.fetchFn = opts.fetchFn ?? fetch;
    this.endpoint = opts.endpoint ?? DEFAULT_ENDPOINT;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.analysisTimeoutMs = opts.analysisTimeoutMs ?? 8000;
  }

  getModel(): string {
    return this.model;
  }

  lastError(): string | null {
    return this.lastFailure;
  }

  async line(req: CommentaryRequest): Promise<string | null> {
    if (Date.now() < this.cooldownUntil) return null;
    let key: string | null = null;
    try {
      key = await this.opts.getApiKey();
    } catch (err) {
      this.lastFailure = `Hugging Face token unavailable: ${err instanceof Error ? err.message : String(err)}`;
      return null;
    }
    if (!key) {
      this.lastFailure = 'No Hugging Face token';
      return null;
    }

    const analysis = req.mode === 'analysis';
    // Qwen3 otherwise emits a private reasoning block before the spoken answer.
    const prompt = `${this.model.toLowerCase().includes('qwen3') ? '/no_think\n' : ''}${buildCommentaryPrompt(req)}`;
    const controller = new AbortController();
    const timeout = analysis ? this.analysisTimeoutMs : this.timeoutMs;
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await this.fetchFn(this.endpoint, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${key}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: analysis ? 0.85 : 1.0,
          max_tokens: analysis ? 512 : 120,
          stream: false,
        }),
        signal: controller.signal,
      } as unknown as RequestInit);

      if (!res.ok) {
        const detail = (await res.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 220);
        this.lastFailure = `Hugging Face HTTP ${res.status}${detail ? `: ${detail}` : ''}`;
        if (res.status === 402 || res.status === 429 || res.status >= 500) {
          const retryAfter = Number(res.headers?.get('retry-after'));
          const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
            ? Math.min(10 * 60_000, retryAfter * 1000)
            : res.status === 402 ? 5 * 60_000 : 60_000;
          this.cooldownUntil = Date.now() + waitMs;
        }
        return null;
      }

      const body = (await res.json()) as {
        choices?: { message?: { content?: string | { text?: string }[] } }[];
      };
      const content = body.choices?.[0]?.message?.content;
      const text = Array.isArray(content)
        ? content.map((part) => part.text ?? '').join('')
        : content;
      const line = cleanCommentary(text, analysis ? 2 : 1);
      this.lastFailure = line ? null : 'Hugging Face returned no usable commentary';
      return line;
    } catch (err) {
      this.lastFailure =
        err instanceof Error && err.name === 'AbortError'
          ? `Hugging Face timed out after ${timeout} ms`
          : `Hugging Face request failed: ${err instanceof Error ? err.message : String(err)}`;
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
