// @vitest-environment node
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { SelectorConfigSchema, type SelectorConfig } from './config';
import { createAdapter, isDegraded } from './engine';

/**
 * These tests use a SYNTHETIC page and made-up selectors to exercise the engine. They say
 * nothing about the real Cricbuzz/Crex markup (that is covered by fixture tests).
 */
const URL_ = 'https://example.invalid/live/12345/some-match';
const NOW = 1_700_000_000_000;

const makeConfig = (patch: Partial<SelectorConfig> = {}): SelectorConfig =>
  SelectorConfigSchema.parse({
    version: 1,
    site: 'cricbuzz',
    urlPatterns: ['example\\.invalid/live/'],
    matchIdRegex: '/live/(\\d+)',
    jsonTaps: [
      {
        urlRegex: 'api/score',
        map: { score: '$.s.runs_wkts', overs: '$.s.ov', 'batter1.name': '$.b[0].n' },
      },
    ],
    dom: {
      title: { selectors: ['h1.t'] },
      score: { selectors: ['.sc'] },
      overs: { selectors: ['.ov'], regex: '\\((.+?)\\)' },
      'batter1.name': { selectors: ['.b1 .n'] },
      'batter1.runs': { selectors: ['.b1 .r'] },
      'batter1.balls': { selectors: ['.b1 .b'] },
      status: { selectors: ['.st'] },
    },
    minConfidenceFields: ['score', 'overs', 'batter1.name', 'batter1.runs', 'batter1.balls'],
    ...patch,
  });

const html = (o: { score?: string; scClass?: string; overs?: string; status?: string } = {}) => `
  <h1 class="t">A v B</h1>
  <div class="${o.scClass ?? 'sc'}">${o.score ?? '98-2'}</div>
  <div class="ov">(${o.overs ?? '11.3'})</div>
  <div class="b1"><span class="n">Aiden Markram*</span><span class="r">41</span><span class="b">28</span></div>
  <div class="st">${o.status ?? ''}</div>`;

const run = (
  handle: ReturnType<typeof createAdapter>,
  page: string,
  taps: { url: string; json: unknown }[] = [],
) =>
  handle.adapter({
    site: 'cricbuzz',
    url: URL_,
    document: new JSDOM(page).window.document,
    taps,
    now: NOW,
  });

describe('createAdapter (DOM strategy)', () => {
  it('parses a full page with confidence 1', () => {
    const h = createAdapter(makeConfig());
    const u = run(h, html());
    expect(u.confidence).toBe(1);
    expect(u.matchId).toBe('12345');
    expect(u.fields.innings).toEqual([{ team: '', runs: 98, wkts: 2, overs: 11, balls: 3 }]);
    expect(u.fields.batters[0]).toMatchObject({ name: 'Aiden Markram', runs: 41, onStrike: true });
    expect(u.missing).toEqual([]);
    expect(h.diagnostics()?.strategy).toBe('dom');
  });

  it('reports missing fields and is degraded below the threshold', () => {
    const h = createAdapter(makeConfig());
    const u = run(h, '<h1 class="t">A v B</h1><div class="sc">98-2</div>');
    expect(u.confidence).toBeCloseTo(0.2);
    expect(u.missing).toContain('overs');
    expect(isDegraded(u)).toBe(true);
  });

  it('simulated site change: breaks, then a config-only edit fixes it', () => {
    const changed = html({ scClass: 'score-new' });
    const before = run(createAdapter(makeConfig()), changed);
    expect(before.confidence).toBeLessThan(1);
    expect(before.missing).toContain('score');

    const fixed = makeConfig();
    fixed.dom.score = { selectors: ['.score-new', '.sc'] };
    const after = run(createAdapter(fixed), changed);
    expect(after.confidence).toBe(1);
  });

  it('falls back to the next selector in the list', () => {
    const cfg = makeConfig();
    cfg.dom.score = { selectors: ['.does-not-exist', '.sc'] };
    expect(run(createAdapter(cfg), html()).fields.innings[0]?.runs).toBe(98);
  });
});

describe('createAdapter (JSON strategy)', () => {
  const tap = {
    url: 'https://example.invalid/api/score?id=1',
    json: { s: { runs_wkts: '110-3', ov: '13.0' }, b: [{ n: 'Babar Azam' }] },
  };

  it('is preferred when it is at least as confident as the DOM', () => {
    const cfg = makeConfig({
      minConfidenceFields: ['score', 'overs', 'batter1.name'],
    });
    const h = createAdapter(cfg);
    const u = run(h, html(), [tap]);
    expect(h.diagnostics()?.strategy).toBe('json');
    expect(u.fields.innings[0]).toMatchObject({ runs: 110, wkts: 3, overs: 13 });
    expect(u.fields.batters).toEqual([]); // runs/balls were not in the tap
  });

  it('uses the DOM when the JSON tap is partial and the DOM is better', () => {
    const h = createAdapter(makeConfig());
    const u = run(h, html(), [tap]);
    expect(h.diagnostics()?.strategy).toBe('dom');
    expect(u.fields.innings[0]?.runs).toBe(98);
  });

  it('ignores responses whose URL does not match', () => {
    const h = createAdapter(makeConfig());
    run(h, html(), [{ url: 'https://example.invalid/other', json: { s: { runs_wkts: '1-0' } } }]);
    expect(h.diagnostics()?.jsonConfidence).toBe(0);
  });
});

describe('sanity checks and safety', () => {
  it('fails the score field when wickets exceed 10', () => {
    const u = run(createAdapter(makeConfig()), html({ score: '98-11' }));
    expect(u.missing).toContain('score');
  });

  it('fails overs beyond the limited-overs maximum unless it is a Test', () => {
    const limited = run(createAdapter(makeConfig()), html({ overs: '77.2' }));
    expect(limited.missing).toContain('overs');

    const test = run(createAdapter(makeConfig()), html({ overs: '77.2', status: 'Day 3: Stumps' }));
    expect(test.missing).not.toContain('overs');
    expect(test.fields.day).toBe(3);
  });

  it('rejects runs moving backwards within the same innings', () => {
    const h = createAdapter(makeConfig());
    expect(run(h, html({ score: '120-3' })).confidence).toBe(1);
    const back = run(h, html({ score: '90-3' }));
    expect(back.missing).toContain('score');
    expect(isDegraded(back)).toBe(false); // 4/5 fields still pass
  });

  it('never throws and skips invalid selectors', () => {
    const cfg = makeConfig();
    cfg.dom.score = { selectors: ['<<<bad', '.sc'] };
    expect(() => run(createAdapter(cfg), html())).not.toThrow();
    expect(run(createAdapter(cfg), html()).fields.innings).toHaveLength(1);
  });

  it('an unconfigured adapter has confidence 0', () => {
    const cfg = SelectorConfigSchema.parse({ version: 1, site: 'crex', urlPatterns: [] });
    const u = run(createAdapter(cfg), html());
    expect(u.confidence).toBe(0);
    expect(isDegraded(u)).toBe(true);
  });
});

describe('SelectorConfigSchema', () => {
  it('rejects unknown field names and bad regexes', () => {
    expect(
      SelectorConfigSchema.safeParse({
        version: 1,
        site: 'cricbuzz',
        urlPatterns: [],
        dom: { nonsense: { selectors: ['a'] } },
      }).success,
    ).toBe(false);
    expect(
      SelectorConfigSchema.safeParse({ version: 1, site: 'cricbuzz', urlPatterns: ['('] }).success,
    ).toBe(false);
  });
});
