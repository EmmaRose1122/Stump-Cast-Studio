import { describe, expect, it, vi } from 'vitest';
import { fixtures } from '@stumpcast/shared';
import { HuggingFaceCommentator } from './huggingface';

const request = {
  state: fixtures.t20,
  moment: 'a delivery was bowled',
  lang: 'ur' as const,
  mode: 'analysis' as const,
};

const completion = (content: string) =>
  ({
    ok: true,
    json: async () => ({ choices: [{ message: { content } }] }),
  }) as unknown as Response;

describe('HuggingFaceCommentator', () => {
  it('uses the stored HF token and the configured model', async () => {
    const fetchFn = vi.fn(async () => completion('یہ اہم موقع ہے۔ دباؤ بڑھ رہا ہے۔'));
    const hf = new HuggingFaceCommentator({ getApiKey: () => 'hf_test', fetchFn, model: 'Qwen/Qwen3-8B' });
    expect(await hf.line(request)).toBe('یہ اہم موقع ہے۔ دباؤ بڑھ رہا ہے۔');

    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://router.huggingface.co/v1/chat/completions');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer hf_test');
    const body = JSON.parse(String(init.body)) as { model: string; messages: { content: string }[] };
    expect(body.model).toBe('Qwen/Qwen3-8B');
    expect(body.messages[0]?.content).toContain('/no_think');
    expect(body.messages[0]?.content).toContain('Never invent head-to-head records');
  });

  it('reports exhausted credits and backs off instead of retrying every ball', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: false,
      status: 402,
      text: async () => 'You have no remaining credits.',
    }) as unknown as Response);
    const hf = new HuggingFaceCommentator({ getApiKey: () => 'hf_test', fetchFn });
    expect(await hf.line(request)).toBeNull();
    expect(hf.lastError()).toContain('HTTP 402');
    expect(await hf.line(request)).toBeNull();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('stays silent with no token and never speaks a truncated answer', async () => {
    const noKey = new HuggingFaceCommentator({ getApiKey: () => null, fetchFn: vi.fn() });
    expect(await noKey.line(request)).toBeNull();
    expect(noKey.lastError()).toBe('No Hugging Face token');

    const truncated = new HuggingFaceCommentator({
      getApiKey: () => 'hf_test',
      fetchFn: vi.fn(async () => completion('یہ جملہ ادھو')),
    });
    expect(await truncated.line(request)).toBeNull();
    expect(truncated.lastError()).toMatch(/no usable commentary/);
  });
});
