import { describe, expect, it, vi } from 'vitest';
import { fixtures } from '@stumpcast/shared';
import { GeminiCommentator, type CommentaryRequest } from './gemini';

const req = (over: Partial<CommentaryRequest> = {}): CommentaryRequest => ({
  state: fixtures.t20,
  moment: 'Babar Azam hit a six off Shaheen Afridi',
  lang: 'hi',
  ...over,
});

const response = (text: string) =>
  ({
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
  }) as unknown as Response;

describe('GeminiCommentator', () => {
  it('stays silent with no key instead of failing the broadcast', async () => {
    const fetchFn = vi.fn();
    const g = new GeminiCommentator({ getApiKey: () => null, fetchFn });
    expect(await g.line(req())).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('sends the key as a header, never in the url', async () => {
    const fetchFn = vi.fn(async () => response('शाबाश! बाबर का छक्का।'));
    const g = new GeminiCommentator({ getApiKey: () => 'SECRET-XYZ', fetchFn });
    await g.line(req());
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).not.toContain('SECRET-XYZ');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('SECRET-XYZ');
    expect(String(init.body)).toContain('Devanagari');
  });

  it('returns the model line, stripped to one speakable sentence', async () => {
    const g = new GeminiCommentator({
      getApiKey: () => 'k',
      fetchFn: vi.fn(async () => response('“छक्का! बाबर का शानदार शॉट।” यह लंबी बात है।')),
    });
    expect(await g.line(req())).toBe('छक्का! बाबर का शानदार शॉट।');
  });

  it('drops anything unusable: errors, empty text, or a one-word non-answer', async () => {
    expect(
      await new GeminiCommentator({ getApiKey: () => 'k', fetchFn: vi.fn(async () => ({ ok: false, status: 400 }) as unknown as Response) }).line(req()),
    ).toBeNull();
    expect(
      await new GeminiCommentator({ getApiKey: () => 'k', fetchFn: vi.fn(async () => response('  ')) }).line(req()),
    ).toBeNull();
    expect(
      await new GeminiCommentator({ getApiKey: () => 'k', fetchFn: vi.fn(async () => response('Six.')) }).line(req()),
    ).toBeNull();
    expect(
      await new GeminiCommentator({
        getApiKey: () => 'k',
        fetchFn: vi.fn(async () => {
          throw new Error('offline');
        }),
      }).line(req()),
    ).toBeNull();
  });

  it('gives up on a slow model rather than holding up the broadcast', async () => {
    const g = new GeminiCommentator({
      getApiKey: () => 'k',
      timeoutMs: 50,
      fetchFn: vi.fn(
        (_u: string | URL | Request, init?: RequestInit) =>
          new Promise<Response>((_, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
          }),
      ),
    });
    expect(await g.line(req())).toBeNull();
  });
});
