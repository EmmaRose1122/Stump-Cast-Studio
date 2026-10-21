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
    // The tap names the batter but has no figures; the page has them, and the merge fills the gap.
    expect(u.fields.batters).toEqual([{ name: 'Babar Azam', runs: 41, balls: 28 }]);
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

describe('fields that used to be invented from adjacent text', () => {
  it('uses the label to tell the "This Over" strip from the "Recent" strip', () => {
    const cfg = makeConfig({
      dom: {
        score: { selectors: ['.sc'] },
        overs: { selectors: ['.ov'] },
        thisOver: { selectors: ['.balls'] },
        lastBalls: { selectors: ['.balls'], label: 'Recent' },
      },
      minConfidenceFields: ['score', 'overs'],
    });
    const u = run(
      createAdapter(cfg),
      `<div class="sc">100-2</div><div class="ov">12.0</div>
       <div><p class="lbl">This Over :</p><p class="balls">4 1 0</p></div>
       <div><p class="lbl">Recent :</p><p class="balls">0 0 1 W</p></div>`,
    );
    expect(u.fields.thisOver).toEqual(['4', '1', '0']);
    expect(u.fields.lastBalls).toEqual(['0', '0', '1', 'W']);
  });

  it('never uses score-shaped or toss-shaped text as a team name', () => {
    const cfg = makeConfig({
      dom: {
        score: { selectors: ['.sc'] },
        overs: { selectors: ['.ov'] },
        battingTeam: { selectors: ['.sc'] },
        team1: { selectors: ['.team1'] },
      },
      minConfidenceFields: ['score', 'overs'],
    });
    const u = run(
      createAdapter(cfg),
      `<div class="team1">India</div><div class="sc">145/3</div><div class="ov">16.0</div>`,
    );
    expect(u.fields.innings[0]?.team).toBe('India');
  });

  it('reports a live innings it cannot read instead of guessing all out', () => {
    const cfg = makeConfig({
      dom: { score: { selectors: ['.sc'] }, overs: { selectors: ['.gone'] } },
      minConfidenceFields: ['score', 'overs'],
    });
    const u = run(createAdapter(cfg), `<div class="sc">260</div>`);
    expect(u.fields.innings).toEqual([]);
    expect(u.missing).toEqual(['score', 'overs']);
    expect(isDegraded(u)).toBe(true);
  });

  it('reads a closed bare total as all out and flags the overs the page never showed', () => {
    const cfg = makeConfig({
      dom: {
        'inn1.score': { selectors: ['.a'] },
        'inn2.score': { selectors: ['.b'] },
        'inn2.overs': { selectors: ['.ov'] },
      },
      minConfidenceFields: ['score', 'overs'],
    });
    const u = run(
      createAdapter(cfg),
      `<div class="a">260</div><div class="b">7/0</div><div class="ov">2.3</div>`,
    );
    expect(u.fields.innings.map((i) => [i.runs, i.wkts, i.overs, i.balls])).toEqual([
      [260, 10, 0, 0],
      [7, 0, 2, 3],
    ]);
    expect(u.confidence).toBe(0.5);
    expect(u.missing).toEqual(['overs']);
  });

  it('drops a toss field that landed on a table header', () => {
    const cfg = makeConfig({
      dom: {
        score: { selectors: ['.sc'] },
        overs: { selectors: ['.ov'] },
        toss: { selectors: ['.hdr'] },
      },
      minConfidenceFields: ['score', 'overs'],
    });
    const u = run(
      createAdapter(cfg),
      `<div class="hdr">BatterRB4s6sSR</div><div class="sc">145/3</div><div class="ov">16.0</div>`,
    );
    expect(u.fields.toss).toBeUndefined();
    expect(u.fields.innings[0]).toMatchObject({ runs: 145, wkts: 3, overs: 16 });
    expect(u.confidence).toBe(1);
  });
});

describe('jsonTap templates', () => {
  const cfg = () =>
    makeConfig({
      jsonTaps: [
        {
          urlRegex: 'api/live',
          map: {
            score: '${s.runs}/${s.wkts}',
            overs: 's.ov',
            status: 'live.status',
            format: 's.format',
          },
        },
        {
          urlRegex: 'api/meta',
          map: {
            title: '${t1.name} vs ${t2.name}, ${desc}',
            team1: 't1.name',
            team2: 't2.name',
          },
        },
      ],
      minConfidenceFields: ['score', 'overs'],
    });
  const meta = { url: 'https://example.invalid/api/meta', json: { t1: { name: 'Pakistan' }, t2: { name: 'England' }, desc: '2nd Match' } };

  it('composes one field out of several JSON keys', () => {
    const u = run(createAdapter(cfg()), '<h1 class="t">A v B</h1>', [
      { url: 'https://example.invalid/api/live', json: { s: { runs: 197, wkts: 6, ov: '34.5', format: 'ODI' } } },
    ]);
    expect(u.confidence).toBe(1);
    expect(u.fields.innings[0]).toEqual({ team: '', runs: 197, wkts: 6, overs: 34, balls: 5 });
    expect(u.fields.format).toBe('ODI');
  });

  it('drops a composed value when any part is missing', () => {
    const u = run(createAdapter(cfg()), '<h1 class="t">A v B</h1>', [
      { url: 'https://example.invalid/api/live', json: { s: { runs: 197, ov: '34.5' } } },
    ]);
    expect(u.fields.innings).toEqual([]);
    expect(u.missing).toEqual(['score', 'overs']);
    expect(isDegraded(u)).toBe(true);
  });

  it('will not turn a title-only read into a confident 0-0 match', () => {
    const h = createAdapter(cfg());
    const u = run(h, '<h1 class="t">2nd Match</h1>', [meta]);
    expect(u.confidence).toBe(0);
    expect(u.fields.innings).toEqual([]);
    expect(u.fields.preMatch).toBeUndefined();
    expect(h.diagnostics()?.strategy).toBe('none');
  });

  it('keeps a real preview page and marks the 0-0 as not yet played', () => {
    const u = run(createAdapter(cfg()), '<div class="st">nothing</div>', [
      meta,
      { url: 'https://example.invalid/api/live', json: { live: { status: 'Match starts at 1:30 PM' } } },
    ]);
    expect(u.fields.innings).toEqual([{ team: 'Pakistan', runs: 0, wkts: 0, overs: 0, balls: 0 }]);
    expect(u.fields.preMatch).toBe(true);
  });

  it('never lets the invented 0-0 outrank a page the DOM can really read', () => {
    const h = createAdapter(cfg());
    const u = run(h, html(), [
      meta,
      { url: 'https://example.invalid/api/live', json: { live: { status: 'Match starts at 1:30 PM' } } },
    ]);
    expect(h.diagnostics()).toMatchObject({ jsonConfidence: 1, domConfidence: 1, strategy: 'dom' });
    expect(u.fields.innings[0]).toMatchObject({ runs: 98, wkts: 2 });
    expect(u.fields.preMatch).toBeUndefined();
  });

  it('fills the fields only the page shows from the DOM, while the response still wins', () => {
    const withVenue = cfg();
    withVenue.dom.venue = { selectors: ['.v'] };
    const h = createAdapter(withVenue);
    const u = run(h, '<div class="v">Rawalpindi Cricket Stadium</div>', [
      { url: 'https://example.invalid/api/live', json: { s: { runs: 197, wkts: 6, ov: '34.5' } } },
    ]);
    expect(h.diagnostics()?.strategy).toBe('json');
    expect(u.fields.innings[0]).toMatchObject({ runs: 197, wkts: 6 });
    expect(u.fields.venue).toBe('Rawalpindi Cricket Stadium');
  });
});
