import type { CommentaryLanguage, MatchState } from '@stumpcast/shared';

export interface CommentaryRequest {
  state: MatchState;
  /** What just happened, in plain terms: the delivery, or the event that fired. */
  moment: string;
  lang: CommentaryLanguage;
}

export interface GeminiOptions {
  getApiKey: () => Promise<string | null> | string | null;
  model?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  endpoint?: string;
}

const LANGUAGE_NAME: Record<CommentaryLanguage, string> = {
  hi: 'Hindi, written in Devanagari script',
  ur: 'Urdu, written in Nastaliq/Arabic script',
  en: 'English',
};

/** Cricket terms the commentator actually uses, in the target script. */
const SCRIPT_NOTE: Record<CommentaryLanguage, string> = {
  hi: 'चौका, छक्का, वाइड, नो बॉल, डॉट, साझेदारी, रन रेट जैसे शब्द इस्तेमाल करें।',
  ur: 'چوکا، چھکا، وائڈ، نو بال، ڈاٹ، شراکدار، رن ریٹ جیسے الفاظ استعمال کریں۔',
  en: 'Use normal broadcast cricket vocabulary.',
};

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
  private readonly endpoint: string;

  constructor(private readonly opts: GeminiOptions) {
    this.model = opts.model ?? DEFAULT_MODEL;
    this.fetchFn = opts.fetchFn ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.endpoint = opts.endpoint ?? 'https://generativelanguage.googleapis.com';
  }

  /** One short spoken line, or null when the model is unavailable or says something unusable. */
  async line(req: CommentaryRequest): Promise<string | null> {
    let key: string | null = null;
    try {
      key = await this.opts.getApiKey();
    } catch {
      return null;
    }
    if (!key) return null;

    const prompt = this.prompt(req);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    // Node's fetch types and the DOM's disagree on AbortSignal; this is the global fetch either way.
    const init = {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 1.0, maxOutputTokens: 90 },
      }),
      signal: controller.signal,
    } as unknown as RequestInit;
    try {
      const res = await this.fetchFn(
        `${this.endpoint}/v1beta/models/${encodeURIComponent(this.model)}:generateContent`,
        init,
      );
      if (!res.ok) return null;
      const body = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text = body.candidates?.[0]?.content?.parts
        ?.map((p) => p.text ?? '')
        .join('')
        .trim();
      return this.clean(text);
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private prompt(req: CommentaryRequest): string {
    const { state: s } = req;
    const striker = s.batters.find((b) => b.onStrike);
    const nonStriker = s.batters.find((b) => !b.onStrike);
    const facts = [
      `Score ${s.score.runs}-${s.score.wkts} after ${s.score.overs}.${s.score.balls} overs`,
      striker ? `${striker.name} on strike ${striker.runs}(${striker.balls})` : '',
      nonStriker ? `${nonStriker.name} ${nonStriker.runs}(${nonStriker.balls})` : '',
      s.bowler?.name ? `bowler ${s.bowler.name} ${s.bowler.wkts}-${s.bowler.runs} in ${s.bowler.overs}.${s.bowler.balls}` : '',
      s.target !== undefined ? `target ${s.target}` : '',
      s.rrr !== undefined ? `required rate ${s.rrr.toFixed(2)}` : '',
      s.crr !== undefined ? `current rate ${s.crr.toFixed(2)}` : '',
      s.partnership ? `partnership ${s.partnership.runs} from ${s.partnership.balls}` : '',
    ].filter(Boolean);

    return [
      `You are the Hindi/Urdu radio commentator on a live ${s.format} cricket broadcast.`,
      `Reply in ${LANGUAGE_NAME[req.lang]} only. ${SCRIPT_NOTE[req.lang]}`,
      `Just happened: ${req.moment}.`,
      `Match facts: ${facts.join('; ')}.`,
      'Write ONE sentence of natural spoken commentary, 6 to 18 words, that a real commentator',
      'would say in this exact moment. Vary your opening every time. No player statistics that are',
      'not in the facts above. No quotes, no emoji, no markdown, no prefix, no explanation.',
    ].join(' ');
  }

  /** The model talks; this keeps it to one speakable line. */
  private clean(raw: string | undefined | null): string | null {
    if (!raw) return null;
    const one = raw
      .replace(/["'“”‘’`]+/g, '')
      .replace(/[*_#]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    // Cut at the first full stop or danda. `!` and `?` stay put: a commentary line legitimately
    // starts "छक्का! ..." and must not be chopped down to one word.
    const cut = one.match(/^(.*?[।.](?=\s|$))/)?.[1] ?? one;
    const line = (cut.length >= 8 ? cut : one).trim();
    if (line.length < 8 || line.length > 180) return null;
    return line;
  }
}
