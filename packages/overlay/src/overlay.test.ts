// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  coralDusk,
  createMatchState,
  fixtures,
  graphiteTeal,
  type MatchState,
} from '@stumpcast/shared';
import {
  BACKOFF_MAX_MS,
  OverlayWsClient,
  backoffDelay,
  type ClientTimers,
  type SocketLike,
} from './client';
import { OverlayComponent } from './component';
import { parseParams } from './debug';
import { applyLook, lookToCssVars } from './look';
import { applyBackground, applyComposition, applyTvTheme } from './layout';
import { entranceVars } from './motion';
import { STAGE_HEIGHT, STAGE_WIDTH, fitStage, mountStage } from './stage';
import { OverlayStore } from './store';

// ---- stage --------------------------------------------------------------------------------

describe('fitStage', () => {
  it('is identity at 1920x1080', () => {
    expect(fitStage(1920, 1080)).toEqual({ scale: 1, x: 0, y: 0 });
  });
  it('scales down and letterboxes a 4:3 window', () => {
    const t = fitStage(960, 720);
    expect(t.scale).toBe(0.5);
    expect(t.x).toBe(0);
    expect(t.y).toBe((720 - STAGE_HEIGHT * 0.5) / 2);
  });
  it('centres horizontally in an ultra-wide window', () => {
    const t = fitStage(2560, 1080);
    expect(t.scale).toBe(1);
    expect(t.x).toBe((2560 - STAGE_WIDTH) / 2);
  });
  it('never returns NaN for a zero-size window', () => {
    expect(fitStage(0, 0)).toEqual({ scale: 1, x: 0, y: 0 });
  });
  it('mountStage sizes the element and follows resizes', () => {
    const el = document.createElement('div');
    const win = { innerWidth: 960, innerHeight: 540, ...makeEvents() } as unknown as Window;
    mountStage(el, win);
    expect(el.style.width).toBe('1920px');
    expect(el.style.transform).toContain('scale(0.5)');
    Object.assign(win, { innerWidth: 1920, innerHeight: 1080 });
    (win as unknown as { fire(t: string): void }).fire('resize');
    expect(el.style.transform).toContain('scale(1)');
  });
});

describe('stage background', () => {
  it('keeps the stage transparent when no background asset is selected', () => {
    const stage = document.createElement('div');
    applyBackground(stage, null, 0.3);
    expect(stage.style.backgroundImage).toBe('none');
    expect(stage.dataset.backdrop).toBe('transparent');
  });

  it('uses the local asset path and configured dim when a background is selected', () => {
    const stage = document.createElement('div');
    applyBackground(stage, 'backgrounds/stadium-night.webp', 0.4);
    expect(stage.style.backgroundImage).toContain('/assets/backgrounds/stadium-night.webp');
    expect(stage.style.backgroundImage).toContain('0.4');
    expect(stage.style.backgroundSize).toBe('cover');
    expect(stage.style.getPropertyValue('--stadium-bg')).toContain('/assets/backgrounds/stadium-night.webp');
  });
});

describe('broadcast composition and tv theme', () => {
  it('sets the shared preset on the overlay stage', () => {
    const stage = document.createElement('div');
    applyComposition(stage, 'J');
    expect(stage.dataset.composition).toBe('J');
  });

  it('sets tv theme on dataset of stage and document root', () => {
    const stage = document.createElement('div');
    applyTvTheme(stage, 'sky-sports');
    expect(stage.dataset.tvTheme).toBe('sky-sports');
    expect(document.documentElement.dataset.tvTheme).toBe('sky-sports');
  });
});

function makeEvents() {
  const handlers: Record<string, (() => void)[]> = {};
  return {
    addEventListener: (t: string, fn: () => void) => (handlers[t] ??= []).push(fn),
    removeEventListener: () => undefined,
    fire: (t: string) => handlers[t]?.forEach((f) => f()),
  };
}

// ---- looks --------------------------------------------------------------------------------

describe('looks', () => {
  it('turns tokens into CSS variables and sets data-look', () => {
    const root = document.createElement('html');
    applyLook(graphiteTeal, root);
    expect(root.style.getPropertyValue('--color-accent')).toBe('#19D3C5');
    expect(root.style.getPropertyValue('--radius-card')).toBe('12px');
    expect(root.dataset.look).toBe('graphite-teal');
    expect(root.dataset.scorePosition).toBe('top');

    applyLook(coralDusk, root);
    expect(root.dataset.look).toBe('coral-dusk');
    expect(root.dataset.scoreBar).toBe('pill');
    expect(root.style.getPropertyValue('--color-accent')).toBe('#FF6B57');
  });

  it('exposes the numbers font for scoreboards', () => {
    expect(lookToCssVars(graphiteTeal)['--font-numbers']).toContain('Barlow Condensed');
  });

  it('has an entrance for every motion style', () => {
    for (const e of ['slide', 'fade', 'zoom', 'flip', 'blur', 'curtain', 'iris', 'skew'] as const) {
      expect(Object.keys(entranceVars(e)).length).toBeGreaterThan(0);
    }
  });
});

// ---- params -------------------------------------------------------------------------------

describe('parseParams', () => {
  it('reads debug, fixture and match', () => {
    expect(parseParams('?debug=1&fixture=test&match=abc')).toMatchObject({
      debug: true,
      fixture: 'TEST',
      match: 'abc',
    });
    expect(parseParams('')).toEqual({
      debug: false,
      fixture: null,
      match: null,
      look: null,
      layout: null,
      composition: null,
      event: null,
      preview: false,
      gallery: false,
    });
    expect(parseParams('?fixture=nonsense').fixture).toBeNull();
    expect(parseParams('?layout=Arena&look=ember&event=six')).toMatchObject({
      layout: 'arena',
      look: 'ember',
      event: 'SIX',
    });
    expect(parseParams('?composition=J').composition).toBe('J');
    expect(parseParams('?composition=Z').composition).toBeNull();
    expect(parseParams('?layout=bogus').layout).toBeNull();
  });
});

// ---- store --------------------------------------------------------------------------------

const at = (m: MatchState, updatedAt: string): MatchState => ({ ...m, updatedAt });

describe('OverlayStore', () => {
  it('selects the first match seen and keeps it', () => {
    const s = new OverlayStore();
    s.setMatch(fixtures.t20);
    s.setMatch(fixtures.test);
    expect(s.get().matchId).toBe(fixtures.t20.id);
    expect(s.current()?.id).toBe(fixtures.t20.id);
  });

  it('honours a pinned match id', () => {
    const s = new OverlayStore(fixtures.test.id);
    s.setMatch(fixtures.t20);
    expect(s.current()).toBeUndefined();
    s.setMatch(fixtures.test);
    expect(s.current()?.id).toBe(fixtures.test.id);
  });

  it('ignores an older delivery of the same match', () => {
    const s = new OverlayStore();
    const newer = at(createMatchState({ id: 'x' }), '2026-01-01T00:00:10.000Z');
    s.setMatch(newer);
    s.setMatch(
      at(
        createMatchState({ id: 'x', score: { runs: 5, wkts: 0, overs: 1, balls: 0 } }),
        '2026-01-01T00:00:05.000Z',
      ),
    );
    expect(s.current()?.score.runs).toBe(0);
  });

  it('keeps state when the connection drops', () => {
    const s = new OverlayStore();
    s.setMatch(fixtures.t20);
    s.setConnection('closed');
    expect(s.current()?.id).toBe(fixtures.t20.id);
  });

  it('applies card show and hide', () => {
    const s = new OverlayStore();
    s.applyCard({ action: 'show', cardId: 'manhattan', durationSec: 8, source: 'director' });
    expect(s.get().active?.cardId).toBe('manhattan');
    s.applyCard({ action: 'hide', cardId: 'other' });
    expect(s.get().active).not.toBeNull();
    s.applyCard({ action: 'hide' });
    expect(s.get().active).toBeNull();
  });

  it('notifies subscribers with previous state', () => {
    const s = new OverlayStore();
    const fn = vi.fn();
    s.subscribe(fn);
    s.setConnection('open');
    expect(fn).toHaveBeenCalledOnce();
    expect(fn.mock.calls[0]![1].connection).toBe('connecting');
  });
});

// ---- ws client ----------------------------------------------------------------------------

class FakeSocket implements SocketLike {
  readyState = 0;
  sent: unknown[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  send(d: string) {
    this.sent.push(JSON.parse(d));
  }
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  push(msg: unknown) {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }
}

const makeClient = () => {
  const sockets: FakeSocket[] = [];
  const timeouts: { fn: () => void; ms: number; id: number }[] = [];
  const intervals: { fn: () => void; ms: number }[] = [];
  let id = 1;
  let time = 0;
  const timers: ClientTimers = {
    setTimeout: (fn, ms) => {
      const t = { fn, ms, id: id++ };
      timeouts.push(t);
      return t.id;
    },
    clearTimeout: (x) => {
      const i = timeouts.findIndex((t) => t.id === x);
      if (i >= 0) timeouts.splice(i, 1);
    },
    setInterval: (fn, ms) => {
      intervals.push({ fn, ms });
      return intervals.length;
    },
    clearInterval: () => undefined,
  };
  const messages: unknown[] = [];
  const statuses: string[] = [];
  let opens = 0;
  const client = new OverlayWsClient({
    url: 'ws://x/ws',
    channels: ['state', 'cards'],
    onMessage: (m) => messages.push(m),
    onStatus: (s) => statuses.push(s),
    onOpen: () => opens++,
    createSocket: () => {
      const s = new FakeSocket();
      sockets.push(s);
      return s;
    },
    timers,
    random: () => 0.5, // jitter factor 1.0
    now: () => time,
  });
  return {
    client,
    sockets,
    timeouts,
    intervals,
    messages,
    statuses,
    opens: () => opens,
    advance: (ms: number) => (time += ms),
  };
};

describe('OverlayWsClient', () => {
  afterEach(() => vi.restoreAllMocks());

  it('backs off exponentially, capped, with jitter bounds', () => {
    expect(backoffDelay(0, () => 0.5)).toBe(500);
    expect(backoffDelay(1, () => 0.5)).toBe(1000);
    expect(backoffDelay(10, () => 0.5)).toBe(BACKOFF_MAX_MS);
    expect(backoffDelay(0, () => 0)).toBe(375);
    expect(backoffDelay(0, () => 1)).toBe(625);
  });

  it('subscribes on open and delivers validated messages', () => {
    const h = makeClient();
    h.client.start();
    h.sockets[0]!.open();
    expect(h.sockets[0]!.sent[0]).toEqual({ type: 'subscribe', channels: ['state', 'cards'] });
    expect(h.opens()).toBe(1);
    h.sockets[0]!.push({ type: 'message', channel: 'state', event: 'x', payload: {}, ts: 1 });
    h.sockets[0]!.push({ type: 'bogus' });
    expect(h.messages).toHaveLength(1);
  });

  it('reconnects with growing delay and resets after a successful open', () => {
    const h = makeClient();
    h.client.start();
    h.sockets[0]!.close();
    expect(h.timeouts.at(-1)!.ms).toBe(500);
    h.timeouts.pop()!.fn();
    h.sockets[1]!.close();
    expect(h.timeouts.at(-1)!.ms).toBe(1000);
    h.timeouts.pop()!.fn();
    h.sockets[2]!.open(); // success resets
    h.sockets[2]!.close();
    expect(h.timeouts.at(-1)!.ms).toBe(500);
    expect(h.statuses).toContain('closed');
  });

  it('forces a reconnect when the connection goes silent', () => {
    const h = makeClient();
    h.client.start();
    h.sockets[0]!.open();
    const ping = h.intervals.at(-1)!;
    h.advance(10_000);
    ping.fn();
    expect(h.sockets[0]!.sent.at(-1)).toEqual({ type: 'ping' });
    h.advance(41_000);
    ping.fn();
    expect(h.sockets[0]!.readyState).toBe(3);
    expect(h.timeouts.length).toBe(1);
  });

  it('does not reconnect after stop()', () => {
    const h = makeClient();
    h.client.start();
    h.client.stop();
    expect(h.timeouts).toHaveLength(0);
  });
});

// ---- component base -----------------------------------------------------------------------

class Probe extends OverlayComponent {
  updates = 0;
  shown: unknown[] = [];
  protected build() {
    return document.createElement('div');
  }
  update() {
    this.updates++;
  }
  protected override onShow(data?: unknown) {
    this.shown.push(data);
  }
}

describe('OverlayComponent', () => {
  it('mounts hidden, shows with data, hides and destroys without leaking timelines', () => {
    const stage = document.createElement('div');
    const c = new Probe();
    c.mount(stage, graphiteTeal);
    expect(stage.children).toHaveLength(1);
    expect(c.isVisible).toBe(false);

    c.show({ a: 1 });
    expect(c.isVisible).toBe(true);
    expect(c.shown).toEqual([{ a: 1 }]);
    expect(c.activeTimelines).toBe(1);

    c.show({ a: 2 }); // replaces, does not stack timelines
    expect(c.activeTimelines).toBe(1);

    c.hide();
    expect(c.isVisible).toBe(false);

    c.destroy();
    expect(c.activeTimelines).toBe(0);
    expect(stage.children).toHaveLength(0);
  });

  it('tags the root for debug outlines and ignores double mount', () => {
    const stage = document.createElement('div');
    const c = new Probe();
    c.mount(stage, graphiteTeal);
    c.mount(stage, graphiteTeal);
    expect(stage.children).toHaveLength(1);
    expect((stage.firstElementChild as HTMLElement).dataset.component).toBe('Probe');
  });
});
