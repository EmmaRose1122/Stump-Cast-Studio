// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { RawUpdateSchema, type RawUpdate } from '@stumpcast/shared';
import type { Adapter } from '../adapter';
import { TAP_MARKER, type ContentMessage, type TapMessage } from '../messages';
import { createPipeline } from './pipeline';
import { installTap, type TapWindow } from './tap';

// ---- fake browser pieces ------------------------------------------------------------------

const flush = () => new Promise((r) => setTimeout(r, 0));

class FakeXHR {
  static sentTo: string[] = [];
  responseType = '';
  responseText = '';
  private listeners: Record<string, (() => void)[]> = {};
  open(_method: string, url: string) {
    this.url = url;
  }
  url = '';
  send(_body?: unknown) {
    FakeXHR.sentTo.push(this.url);
  }
  addEventListener(type: string, fn: () => void) {
    (this.listeners[type] ??= []).push(fn);
  }
  fireLoad(text: string) {
    this.responseText = text;
    this.listeners.load?.forEach((f) => f());
  }
}

const makeWindow = (fetchImpl: (...a: unknown[]) => Promise<Response>) => {
  const posted: TapMessage[] = [];
  let onMessage: ((e: MessageEvent) => void) | null = null;
  const win = {
    fetch: fetchImpl,
    XMLHttpRequest: FakeXHR,
    location: { href: 'https://www.example.invalid/match/1' },
    postMessage: (m: unknown) => posted.push(m as TapMessage),
    addEventListener: (_t: 'message', fn: (e: MessageEvent) => void) => {
      onMessage = fn;
    },
  };
  const configure = (urlRegexes: string[]) =>
    onMessage?.({ data: { marker: TAP_MARKER, kind: 'config', urlRegexes } } as MessageEvent);
  return { win: win as unknown as TapWindow & typeof win, posted, configure };
};

const jsonResponse = (body: unknown) => new Response(JSON.stringify(body));

// ---- tap ----------------------------------------------------------------------------------

describe('installTap', () => {
  it('forwards matching fetch responses and leaves the page response readable', async () => {
    const fetchSpy = vi.fn(async () => jsonResponse({ runs: 10 }));
    const { win, posted, configure } = makeWindow(fetchSpy);
    installTap(win);
    configure(['api/score']);

    const res = await win.fetch!('https://www.example.invalid/api/score?id=1' as never);
    expect(await res.json()).toEqual({ runs: 10 }); // page can still read its own body
    await flush();

    expect(fetchSpy).toHaveBeenCalledTimes(1); // no extra request from the tap
    expect(posted).toHaveLength(1);
    expect(posted[0]).toMatchObject({
      kind: 'response',
      url: 'https://www.example.invalid/api/score?id=1',
      json: { runs: 10 },
    });
  });

  it('ignores non-matching and non-JSON responses', async () => {
    const fetchSpy = vi.fn(async (url: unknown) =>
      String(url).includes('html') ? new Response('<html>') : jsonResponse({ a: 1 }),
    );
    const { win, posted, configure } = makeWindow(fetchSpy);
    installTap(win);
    configure(['api/score']);
    await win.fetch!('https://x.invalid/other' as never);
    await win.fetch!('https://x.invalid/api/score.html' as never);
    await flush();
    expect(posted).toHaveLength(0);
  });

  it('buffers responses seen before config arrives, then flushes matches only', async () => {
    const { win, posted, configure } = makeWindow(async () => jsonResponse({ a: 1 }));
    installTap(win);
    await win.fetch!('https://x.invalid/api/score' as never);
    await win.fetch!('https://x.invalid/unrelated' as never);
    await flush();
    expect(posted).toHaveLength(0);
    configure(['api/score']);
    expect(posted.map((p) => (p as { url: string }).url)).toEqual(['https://x.invalid/api/score']);
  });

  it('observes XHR without changing the request', async () => {
    FakeXHR.sentTo = [];
    const { win, posted, configure } = makeWindow(async () => jsonResponse({}));
    installTap(win);
    configure(['live']);
    const xhr = new (win.XMLHttpRequest as unknown as typeof FakeXHR)();
    xhr.open('GET', '/live/score');
    xhr.send();
    xhr.fireLoad('{"wkts":3}');
    await flush();
    expect(FakeXHR.sentTo).toEqual(['/live/score']);
    expect(posted[0]).toMatchObject({
      url: 'https://www.example.invalid/live/score',
      json: { wkts: 3 },
    });
  });

  it('propagates fetch failures to the page unchanged', async () => {
    const { win, configure } = makeWindow(async () => {
      throw new Error('network down');
    });
    installTap(win);
    configure(['.*']);
    await expect(win.fetch!('https://x.invalid/a' as never)).rejects.toThrow('network down');
  });
});

// ---- pipeline -----------------------------------------------------------------------------

const update = (runs: number, confidence = 1): RawUpdate =>
  RawUpdateSchema.parse({
    source: 'cricbuzz',
    matchId: 'm1',
    url: 'https://www.example.invalid/match/1',
    capturedAt: 1,
    confidence,
    fields: {
      innings: [{ team: 'A', runs, wkts: 0, overs: 1, balls: 0 }],
    },
    missing: confidence < 0.6 ? ['score'] : [],
  });

const harness = (adapter: Adapter, minIntervalMs = 500) => {
  let t = 0;
  const sent: ContentMessage[] = [];
  const timers: { at: number; fn: () => void; id: number }[] = [];
  let nextId = 1;
  const pipeline = createPipeline({
    site: 'cricbuzz',
    adapter,
    getDocument: () => ({}) as Document,
    getUrl: () => 'https://www.example.invalid/match/1',
    send: (m) => sent.push(m),
    now: () => t,
    minIntervalMs,
    setTimer: (fn, ms) => {
      const id = nextId++;
      timers.push({ at: t + ms, fn, id });
      return id;
    },
    clearTimer: (id) => {
      const i = timers.findIndex((x) => x.id === id);
      if (i >= 0) timers.splice(i, 1);
    },
  });
  const advance = (ms: number) => {
    t += ms;
    for (const due of timers.filter((x) => x.at <= t).sort((a, b) => a.at - b.at)) {
      timers.splice(timers.indexOf(due), 1);
      due.fn();
    }
  };
  return { pipeline, sent, advance };
};

describe('createPipeline', () => {
  it('drops identical consecutive updates', () => {
    const h = harness(() => update(10));
    h.pipeline.trigger();
    h.advance(1000);
    h.pipeline.trigger();
    expect(h.sent).toHaveLength(1);
  });

  it('rate-limits to 2/s and keeps only the newest pending update', () => {
    let runs = 1;
    const h = harness(() => update(runs));
    h.pipeline.trigger(); // t=0 sent
    runs = 2;
    h.advance(100);
    h.pipeline.trigger(); // waits
    runs = 3;
    h.advance(100);
    h.pipeline.trigger(); // replaces pending
    expect(h.sent).toHaveLength(1);
    h.advance(300); // t=500
    expect(h.sent).toHaveLength(2);
    expect((h.sent[1] as { update: RawUpdate }).update.fields.innings[0]?.runs).toBe(3);
  });

  it('sends adapter-degraded once per episode, never a score', () => {
    const h = harness(() => update(0, 0.2));
    h.pipeline.trigger();
    h.pipeline.trigger();
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0]).toMatchObject({ type: 'adapter-degraded', missing: ['score'] });
  });

  it('pausing stops all updates immediately', () => {
    const h = harness(() => update(5));
    h.pipeline.setPaused(true);
    h.pipeline.trigger();
    expect(h.sent).toHaveLength(0);
  });

  it('survives an adapter that throws', () => {
    const h = harness(() => {
      throw new Error('boom');
    });
    expect(() => h.pipeline.trigger()).not.toThrow();
    expect(h.sent).toHaveLength(0);
  });

  it('passes tapped JSON to the adapter, latest per URL', () => {
    const seen: unknown[][] = [];
    const h = harness((input) => {
      seen.push(input.taps.map((t) => t.json));
      return update(1);
    });
    h.pipeline.addTap('u1', { v: 1 });
    h.advance(1000);
    h.pipeline.addTap('u1', { v: 2 });
    expect(seen.at(-1)).toEqual([{ v: 2 }]);
  });

  it('hot-swaps adapter on selector update and immediately parses with new rules', () => {
    const currentAdapter = () => update(10);
    const h = harness(() => currentAdapter());
    h.pipeline.trigger();
    expect((h.sent[0] as { update: RawUpdate }).update.fields.innings[0]?.runs).toBe(10);

    // Live update from remote bundle replaces adapter
    h.advance(1000);
    h.pipeline.setAdapter(() => update(88));
    h.pipeline.trigger();
    expect((h.sent[1] as { update: RawUpdate }).update.fields.innings[0]?.runs).toBe(88);
  });
});
