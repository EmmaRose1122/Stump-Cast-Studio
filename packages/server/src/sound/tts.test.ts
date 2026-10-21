import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommentaryTts } from './tts';

const pcm = (samples: number) => {
  const buf = Buffer.alloc(samples * 2);
  buf.fill(0x11, 0);
  return buf;
};

const wavOf = (pcmBytes: Buffer, rate = 24_000) => {
  // Enough of a RIFF header for the tests to read the sample rate back.
  const head = Buffer.alloc(44);
  head.write('RIFF', 0);
  head.write('WAVE', 8);
  head.writeUInt32LE(rate, 24);
  return Buffer.concat([head, pcmBytes]);
};

describe('CommentaryTts', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'stumpcast-tts-'));
  });
  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  const make = (over: Partial<ConstructorParameters<typeof CommentaryTts>[0]> = {}) =>
    new CommentaryTts({ getApiKey: () => null, cacheDir: dir, ...over });

  it('reads a line with the Gemini voice when a key is stored', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        candidates: [
          { content: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: pcm(400).toString('base64') } }] } },
        ],
      }),
    })) as unknown as typeof fetch;

    const tts = make({ getApiKey: () => 'test-key', fetchFn });
    tts.register('a', 'چھکا!', 'ur');
    const wav = await tts.wav('a');

    expect(wav?.subarray(0, 4).toString()).toBe('RIFF');
    expect(wav?.readUInt32LE(24)).toBe(24_000);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const init = (fetchFn as unknown as { mock: { calls: [string, { headers: Record<string, string>; body: string }][] } }).mock.calls[0]![1];
    expect(init.headers['x-goog-api-key']).toBe('test-key');
    expect(JSON.parse(init.body).generationConfig.responseModalities).toEqual(['AUDIO']);
  });

  it('serves the same line from disk instead of asking the model twice', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ inlineData: { data: pcm(400).toString('base64') } }] } }],
      }),
    })) as unknown as typeof fetch;

    const tts = make({ getApiKey: () => 'k', fetchFn });
    tts.register('a', 'سنچری!', 'ur');
    await tts.wav('a');
    await tts.wav('a');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('reports no voice for a script this PC cannot read', async () => {
    const run = vi.fn(async () => Buffer.from('en-US\r\nen-US', 'utf8'));
    const tts = make({ platform: 'win32', run });
    expect(await tts.installedVoices()).toEqual(['en-US', 'en-US']);
    expect(await tts.engine('en')).toBe('system');
    expect(await tts.engine('ur')).toBe('none');
    expect(await tts.engine('hi')).toBe('none');
  });

  it('plays no audio rather than a silent file when the desktop voice cannot speak', async () => {
    const run = vi.fn(async (_f: string, args: string[], env?: Record<string, string>) => {
      // A desktop voice with no Urdu pack writes a valid but empty WAV.
      if (env?.STUMCAST_TTS_OUT) await fs.writeFile(env.STUMCAST_TTS_OUT, wavOf(Buffer.alloc(2)));
      return Buffer.alloc(0);
    });
    const tts = make({ platform: 'win32', run });
    tts.register('u', 'چھکا!', 'ur');
    expect(await tts.wav('u')).toBeNull();
  });

  it('uses the desktop voice for a script it can read', async () => {
    const run = vi.fn(async (_f: string, args: string[], env?: Record<string, string>) => {
      if (env?.STUMCAST_TTS_OUT) await fs.writeFile(env.STUMCAST_TTS_OUT, wavOf(pcm(9000), 22_050));
      return Buffer.alloc(0);
    });
    const tts = make({
      platform: 'win32',
      run: async (f, a, e) => {
        if (!e) return Buffer.from('en-US', 'utf8');
        return run(f, a, e);
      },
    });
    tts.register('e', 'FOUR!', 'en');
    const wav = await tts.wav('e');
    expect(wav?.readUInt32LE(24)).toBe(22_050);
  });

  it('never puts the line into the command it runs', async () => {
    const seen: { args: string[]; env?: Record<string, string> }[] = [];
    const tts = make({
      platform: 'win32',
      run: async (f, a, e) => {
        seen.push({ args: a, env: e });
        if (!e) return Buffer.from('en-US', 'utf8');
        if (e.STUMCAST_TTS_OUT) await fs.writeFile(e.STUMCAST_TTS_OUT, wavOf(pcm(9000), 22_050));
        return Buffer.alloc(0);
      },
    });
    tts.register('x', "'; rm -rf C:\\ #", 'en');
    await tts.wav('x');
    const cmd = seen.find((s) => s.env?.STUMCAST_TTS_TEXT);
    expect(cmd?.args.join(' ')).not.toContain('rm -rf');
    expect(cmd?.env?.STUMCAST_TTS_TEXT).toBe("'; rm -rf C:\\ #");
  });

  it('answers null for a line nobody registered', async () => {
    expect(await make().wav('nope')).toBeNull();
  });
});