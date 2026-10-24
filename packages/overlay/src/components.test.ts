// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ALL_LOOKS,
  DEFAULT_LOOK,
  FREE_LOOKS,
  PRO_LOOKS,
  PRO_LOOKS_23,
  createBall,
  deriveStats,
  fixtures,
  graphiteTeal,
  OBS_LAYOUT_PRESETS,
  type EngineEvent,
} from '@stumpcast/shared';
import { BannerQueue, type BannerItem } from './bannerQueue';
import { ScoreBar } from './components/ScoreBar';
import { StatsTiles } from './components/StatsTiles';
import { ThisOver } from './components/ThisOver';
import { MatchCentre } from './components/MatchCentre';
import { ThisBall } from './components/ThisBall';
import { WinProb } from './components/WinProb';
import { Watermark } from './components/Watermark';
import { BatterCards, BowlerCard } from './components/PlayerCards';
import { PreMatchScreen } from './components/PreMatchScreen';
import { ResultScreen } from './components/ResultScreen';
import { ScorePop } from './components/ScorePop';
import { StreamFrame } from './components/StreamFrame';
import { UpgradePopup } from './components/UpgradePopup';
import { ballChip, situationText } from './format';
import { applyLayout, createZones } from './layout';

const mount = <T extends { mount(stage: HTMLElement, look: typeof graphiteTeal): void }>(c: T) => {
  const stage = document.createElement('div');
  c.mount(stage, graphiteTeal);
  return stage;
};

const t20 = deriveStats(fixtures.t20);
const test = deriveStats(fixtures.test);
const result = deriveStats(fixtures.result);

describe('Looks', () => {
  it('has 8 valid looks: 3 free, 5 pro, unique ids', () => {
    expect(ALL_LOOKS).toHaveLength(8);
    expect(FREE_LOOKS).toHaveLength(3);
    expect(PRO_LOOKS).toHaveLength(5);
    expect(new Set(ALL_LOOKS.map((l) => l.id)).size).toBe(8);
    // The look a fresh install boots into has to be one a free channel may actually keep.
    expect(DEFAULT_LOOK.plan).toBe('free');
  });

  it('each look differs in shape, entrance and boundary style', () => {
    for (const key of [
      (l: (typeof ALL_LOOKS)[number]) => l.tokens.scoreBarShape,
      (l: (typeof ALL_LOOKS)[number]) => l.motion.entrance,
      (l: (typeof ALL_LOOKS)[number]) => l.layoutVariant.boundaryStyle,
      (l: (typeof ALL_LOOKS)[number]) => l.tokens.colors.accent,
    ]) {
      expect(new Set(ALL_LOOKS.map(key)).size).toBe(8);
    }
    // Both score positions and both card styles are used.
    expect(new Set(ALL_LOOKS.map((l) => l.layoutVariant.scorePosition))).toEqual(
      new Set(['top', 'bottom']),
    );
    expect(new Set(ALL_LOOKS.map((l) => l.layoutVariant.playerCardStyle))).toEqual(
      new Set(['cutout', 'badge']),
    );
  });

  it('loads every attached Pro look with its arena panel and player arrangement', () => {
    expect(PRO_LOOKS_23).toHaveLength(23);
    expect(new Set(PRO_LOOKS_23.map((look) => look.id)).size).toBe(23);
    expect(new Set(PRO_LOOKS_23.map((look) => look.layoutVariant.middleLayout)).size).toBeGreaterThan(1);
    expect(new Set(PRO_LOOKS_23.map((look) => look.layoutVariant.playerOrder))).toEqual(
      new Set(['striker-left', 'bowler-left', 'bowler-middle']),
    );
  });
});

describe('ScoreBar', () => {
  it('shows batting team, score, overs, situation and rates (first innings)', () => {
    const bar = new ScoreBar();
    const stage = mount(bar);
    bar.update(t20);
    const text = stage.textContent!;
    expect(text).toContain('RSA');
    expect(text).toContain('98-2');
    expect(text).toContain('11.3');
    expect(text).toContain('Projected 170');
    expect(text).toContain('CRR 8.52');
    expect(stage.querySelector('.sb-rrr')!.hasAttribute('hidden')).toBe(true);
  });

  it('shows need/target and RRR in a chase', () => {
    const chase = deriveStats({
      ...fixtures.t20,
      currentInnings: 2,
      target: 160,
      innings: [
        fixtures.t20.innings[0]!,
        {
          ...fixtures.t20.innings[0]!,
          number: 2,
          score: { runs: 100, wkts: 3, overs: 12, balls: 0 },
        },
      ],
      score: { runs: 100, wkts: 3, overs: 12, balls: 0 },
    });
    const bar = new ScoreBar();
    const stage = mount(bar);
    bar.update(chase);
    expect(stage.textContent).toContain('Need 60 off 48');
    expect(stage.textContent).toContain('RRR 7.50');
  });

  it('shows the result text for a finished match and no RRR', () => {
    const bar = new ScoreBar();
    const stage = mount(bar);
    bar.update(result);
    expect(stage.textContent).toContain('Pakistan won by 6 wickets');
    expect(stage.querySelector('.sb-rrr')!.hasAttribute('hidden')).toBe(true);
  });

  it('shows Test day, session and lead', () => {
    expect(situationText(test)).toBe('Day 4 · Afternoon · Lead by 264');
  });

  it('shows previous innings totals beside the corresponding team', () => {
    const batting = test.teams.find((team) => team.id === test.battingTeamId)!;
    const bowling = test.teams.find((team) => team.id !== batting.id)!;
    const state = {
      ...test,
      currentInnings: 4,
      innings: [
        { number: 1, battingTeamId: batting.id, score: { runs: 284, wkts: 10, overs: 90, balls: 0 }, declared: false, allOut: true },
        { number: 2, battingTeamId: bowling.id, score: { runs: 390, wkts: 10, overs: 120, balls: 0 }, declared: false, allOut: true },
        { number: 3, battingTeamId: bowling.id, score: { runs: 314, wkts: 6, overs: 80, balls: 0 }, declared: false, allOut: false },
        { number: 4, battingTeamId: batting.id, score: test.score, declared: false, allOut: false },
      ],
    };
    const bar = new ScoreBar();
    const stage = mount(bar);
    bar.update(state);
    expect(stage.querySelector('.sb-bat .sb-history')?.textContent).toBe('284-10');
    expect(stage.querySelector('.sb-bowl .sb-history')?.textContent).toBe('390-10 & 314-6');
  });

  it('never reads NEED 0 or off 0 once the chase is decided', () => {
    const chase = (runs: number, overs: number, balls: number) =>
      deriveStats({
        ...fixtures.t20,
        currentInnings: 2,
        target: 160,
        innings: [
          fixtures.t20.innings[0]!,
          { ...fixtures.t20.innings[0]!, number: 2, score: { runs, wkts: 8, overs, balls } },
        ],
        score: { runs, wkts: 8, overs, balls },
      });

    const bar = new ScoreBar();
    const stage = mount(bar);
    bar.update(chase(161, 19, 2)); // target reached
    expect(stage.textContent).toContain('TARGET');
    expect(stage.textContent).not.toMatch(/NEED\s*0/);
    expect(situationText(chase(161, 19, 2))).toContain('have reached the target');

    const lastOver = chase(159, 20, 0); // nothing printed and the chase is over
    expect(situationText(lastOver)).not.toMatch(/off 0/);
    expect(situationText(lastOver)).toContain('need 1 to reach 160');
  });
});

describe('ThisOver', () => {
  it('renders a chip per ball with kinds, and updates in place', () => {
    const c = new ThisOver();
    const stage = mount(c);
    c.update({
      ...t20,
      thisOver: [1, 0, 4, 6].map((r, i) => createBall({ ball: i + 1, runs: r })),
    });
    const kinds = [...stage.querySelectorAll('.to-ball')].map((e) => e.className);
    expect(kinds).toHaveLength(4);
    expect(kinds[1]).toContain('to-dot');
    expect(kinds[2]).toContain('to-four');
    expect(kinds[3]).toContain('to-six');
    expect(kinds[3]).toContain('to-latest');
  });

  it('maps wickets and extras', () => {
    expect(ballChip(createBall({ wicket: { kind: 'bowled', playerOutId: 'x' } }))).toEqual({
      label: 'W',
      kind: 'wicket',
    });
    expect(ballChip(createBall({ extras: { type: 'wide', runs: 1 } }))).toEqual({
      label: 'wd',
      kind: 'extra',
    });
    expect(ballChip(createBall({ extras: { type: 'noball', runs: 3 } })).label).toBe('3nb');
  });
});

describe('MatchCentre / ThisBall', () => {
  it('shows match context, toss, last six deliveries and current delivery outcome', () => {
    const centre = new MatchCentre();
    const centreStage = mount(centre);
    const state = {
      ...t20,
      toss: { winnerTeamId: t20.teams[0].id, decision: 'bat' as const },
      lastBalls: [createBall({ ball: 1, runs: 0 }), createBall({ ball: 2, runs: 4 })],
    };
    centre.update(state);
    expect(centreStage.textContent).toContain(t20.title);
    expect(centreStage.textContent).toContain(`${t20.teams[0].name} (bat)`);
    expect(centreStage.querySelectorAll('.mc-ball')).toHaveLength(2);
    expect(centreStage.querySelector('.mc-four')?.textContent).toBe('4');

    const ball = new ThisBall();
    const ballStage = mount(ball);
    ball.update({ ...state, thisOver: [], lastBalls: [createBall({ ball: 1, runs: 4 })] });
    expect(ballStage.querySelector('.tb-value')?.textContent).toBe('4');
    expect(ballStage.querySelector('.tb-detail')?.textContent).toBe('FOUR');
    ball.update({ ...state, thisOver: [], lastBalls: [createBall({ ball: 1, runs: 0, wicket: { kind: 'bowled', playerOutId: 'p1' } })] });
    expect(ballStage.querySelector('.tb-detail')?.textContent).toBe('WICKET');
  });

  it('reads the current delivery from the over in progress, which is never behind', () => {
    const ball = new ThisBall();
    const stage = mount(ball);
    // The scraped "recent balls" strip lagged a delivery behind, so a wicket went out as a dot.
    ball.update({
      ...t20,
      lastBalls: [createBall({ ball: 5, runs: 0 })],
      thisOver: [createBall({ ball: 6, runs: 0, wicket: { kind: 'bowled', playerOutId: 'p1' } })],
    });
    expect(stage.querySelector('.tb-value')?.textContent).toBe('W');
    expect(stage.querySelector('.tb-detail')?.textContent).toBe('WICKET');
  });
});

describe('StatsTiles / WinProb / PlayerCards / Watermark', () => {
  it('builds the right tiles', () => {
    expect(StatsTiles.tiles(t20).map((t) => t.label)).toEqual([
      'CRR',
      'PARTNERSHIP',
      'PROJECTED',
      'WICKETS LEFT',
    ]);
    expect(StatsTiles.tiles(test).some((t) => t.label === 'LEAD')).toBe(true);
    expect(StatsTiles.tiles(result).some((t) => t.label === 'TARGET')).toBe(true);
  });

  it('updates tiles in place', () => {
    const c = new StatsTiles();
    const stage = mount(c);
    c.update(t20);
    const first = stage.querySelector('.st-tile');
    c.update(deriveStats({ ...fixtures.t20, score: { ...fixtures.t20.score, runs: 120 } }));
    expect(stage.querySelector('.st-tile')).toBe(first);
  });

  it('shows win probability and hides it when there is no estimate', () => {
    const c = new WinProb();
    const stage = mount(c);
    c.update(t20);
    expect(stage.querySelector('.c-winprob')!.hasAttribute('hidden')).toBe(false);
    expect(stage.textContent).toMatch(/\d+%/);
    c.update(test);
    expect(stage.querySelector('.c-winprob')!.hasAttribute('hidden')).toBe(true);
  });

  it('win probability halves always add up to 100%', () => {
    const c = new WinProb();
    const stage = mount(c);
    c.update({ ...t20, winProb: { teamA: 0.345, teamB: 0.655 } });
    const pct = [...stage.querySelectorAll('.wp-pct-a, .wp-pct-b')].map((e) =>
      parseInt(e.textContent ?? '0', 10),
    );
    expect(pct).toHaveLength(2);
    expect(pct.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('keeps the batting side on the left, where the scorebar puts it', () => {
    const c = new WinProb();
    const stage = mount(c);
    // Pakistan batting while listed second: `teamA` belongs to teams[0] (South Africa), so the
    // left-hand number on the bar has to be Pakistan's 70%, not the 30% sitting in `teamA`.
    c.update({ ...t20, battingTeamId: 'team-pak', winProb: { teamA: 0.3, teamB: 0.7 } });
    expect(stage.querySelector('.wp-a')!.textContent).toBe('PAK');
    expect(stage.querySelector('.wp-b')!.textContent).toBe('RSA');
    expect(stage.querySelector('.wp-pct-a')!.textContent).toBe('70%');
    expect(stage.querySelector('.wp-crest-a img')!.getAttribute('src')).toContain('team-pak');
    expect(stage.querySelector('.wp-crest-b img')!.getAttribute('src')).toContain('team-rsa');
    expect((stage.querySelector('.wp-fill') as HTMLElement).style.width).toBe('70%');
    // The fill is the left-hand side's colour, so it has to be Pakistan's, not South Africa's.
    expect((stage.querySelector('.wp-fill') as HTMLElement).style.background).toContain('17, 87, 6');
  });

  it('hides the rail when fewer than two teams are known', () => {
    const c = new WinProb();
    const stage = mount(c);
    c.update({ ...t20, teams: t20.teams.slice(0, 1) as unknown as typeof t20.teams });
    expect(stage.querySelector('.c-winprob')!.hasAttribute('hidden')).toBe(true);
  });

  it('renders batters with the striker marked, and the bowler figures', () => {
    const b = new BatterCards();
    const s1 = mount(b);
    b.update(t20);
    expect(s1.querySelectorAll('.pc-card')).toHaveLength(2);
    expect(s1.querySelector('.pc-strike .pc-name')!.textContent).toContain('Aiden Markram');
    expect(s1.textContent).toContain('41 (28)');

    const w = new BowlerCard();
    const s2 = mount(w);
    w.update(t20);
    expect(s2.textContent).toContain('1-21');
    expect(s2.textContent).toContain('2.3 ov');
  });

  it('handles very long names without breaking the DOM structure', () => {
    const b = new BatterCards();
    const stage = mount(b);
    const long = 'Abdullah Ahmadzai Khan Mohammadzai';
    b.update({ ...t20, batters: [{ ...t20.batters[0], name: long }, t20.batters[1]] });
    expect(stage.querySelector('.pc-name')!.textContent).toContain(long);
  });

  it('watermark can be hidden once licensed', () => {
    const w = new Watermark();
    const stage = mount(w);
    expect(stage.textContent).toContain('StumpCast');
    w.setVisible(false);
    expect(stage.querySelector('.c-watermark')!.hasAttribute('hidden')).toBe(true);
  });
});

describe('StreamFrame camera panels', () => {
  const makeStream = (deviceId: string) => {
    const t = { deviceId, stop: vi.fn(), getSettings: () => ({ deviceId }) };
    return { tracks: [t], getVideoTracks: () => [t], getTracks: () => [t] };
  };

  const withCameras = (deviceIds: string[]) => {
    const streams = new Map<string, ReturnType<typeof makeStream>>();
    const getUserMedia = vi.fn(async (c?: { video?: { deviceId?: { exact?: string } } }) => {
      const id = c?.video?.deviceId?.exact ?? deviceIds[0];
      if (id === undefined || !deviceIds.includes(id)) throw new Error('no such camera');
      let s = streams.get(id);
      if (!s) streams.set(id, (s = makeStream(id)));
      return s;
    });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia,
        enumerateDevices: async () =>
          deviceIds.map((d) => ({ kind: 'videoinput', deviceId: d })),
      },
    });
    HTMLMediaElement.prototype.play = () => Promise.resolve();
    return { getUserMedia, streams };
  };

  const settle = () => new Promise((r) => setTimeout(r, 0));

  it('keeps CAM 2 off air when the machine only has one camera', async () => {
    const { getUserMedia } = withCameras(['cam-1']);
    const f = new StreamFrame();
    const stage = mount(f);
    f.setCameraMode('two');
    await settle();
    await settle();
    expect(stage.querySelector('.sf-cam-2')!.classList.contains('is-offline')).toBe(true);
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    f.destroy();
  });

  it('attaches a different device to CAM 2 when one exists', async () => {
    const { getUserMedia, streams } = withCameras(['cam-1', 'cam-2']);
    const f = new StreamFrame();
    const stage = mount(f);
    f.setCameraMode('two');
    await settle();
    await settle();
    const cam2 = stage.querySelector('.sf-cam-2')!;
    expect(cam2.classList.contains('is-offline')).toBe(false);
    expect(getUserMedia).toHaveBeenLastCalledWith({
      video: { deviceId: { exact: 'cam-2' } },
      audio: false,
    });
    const second = streams.get('cam-2')!;
    f.setCameraMode('none');
    expect(second.tracks[0]!.stop).toHaveBeenCalled();
    expect(cam2.classList.contains('is-offline')).toBe(true);
    f.destroy();
  });
});

describe('UpgradePopup timers', () => {
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('cancels the intro popup when the licence lands inside its window', () => {
    vi.useFakeTimers();
    const p = new UpgradePopup();
    const stage = mount(p);
    p.start();
    p.stop();
    vi.advanceTimersByTime(30_000);
    expect(stage.querySelector('.c-upgrade-popup')!.classList.contains('visible')).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });

  it('pops on the first cycle while unlicensed and leaves nothing running after destroy', () => {
    vi.useFakeTimers();
    const p = new UpgradePopup();
    const stage = mount(p);
    const popup = stage.querySelector('.c-upgrade-popup')!;
    p.start();
    vi.advanceTimersByTime(3_000);
    expect(popup.classList.contains('visible')).toBe(true);
    p.destroy();
    expect(popup.classList.contains('visible')).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });

  it('rolls the gap inside 10-15 s and never repeats a fixed period', () => {
    const gaps = [0, 0.25, 0.5, 0.75, 1].map((r) => new UpgradePopup({ random: () => r }).nextGapMs());
    expect(gaps).toEqual([10_000, 11_250, 12_500, 13_750, 15_000]);
    // A broken RNG must still land inside the band rather than firing every millisecond.
    for (const r of [Number.NaN, -1, 2]) {
      const g = new UpgradePopup({ random: () => r }).nextGapMs();
      expect(g).toBeGreaterThanOrEqual(10_000);
      expect(g).toBeLessThanOrEqual(15_000);
    }
  });

  it('shows for exactly three seconds, then waits a freshly rolled gap before the next pop', () => {
    vi.useFakeTimers();
    const rolls: number[] = [];
    const seq = [0.5, 0, 1];
    const p = new UpgradePopup({ random: () => (rolls.push(seq[0]!), seq.shift() ?? 0) });
    const stage = mount(p);
    const popup = stage.querySelector('.c-upgrade-popup')!;
    p.start();

    vi.advanceTimersByTime(3_000); // the intro hop
    expect(popup.classList.contains('visible')).toBe(true);
    vi.advanceTimersByTime(2_999);
    expect(popup.classList.contains('visible')).toBe(true);
    vi.advanceTimersByTime(1);
    expect(popup.classList.contains('visible')).toBe(false);

    // roll 0.5 -> 12.5 s
    vi.advanceTimersByTime(12_499);
    expect(popup.classList.contains('visible')).toBe(false);
    vi.advanceTimersByTime(1);
    expect(popup.classList.contains('visible')).toBe(true);
    vi.advanceTimersByTime(3_000);
    expect(popup.classList.contains('visible')).toBe(false);

    // roll 0 -> 10 s (a shorter gap than the last, so it cannot be a fixed interval)
    vi.advanceTimersByTime(9_999);
    expect(popup.classList.contains('visible')).toBe(false);
    vi.advanceTimersByTime(1);
    expect(popup.classList.contains('visible')).toBe(true);
    vi.advanceTimersByTime(3_000);
    expect(popup.classList.contains('visible')).toBe(false);

    // roll 1 -> 15 s
    vi.advanceTimersByTime(14_999);
    expect(popup.classList.contains('visible')).toBe(false);
    vi.advanceTimersByTime(1);
    expect(popup.classList.contains('visible')).toBe(true);

    expect(rolls).toEqual([0.5, 0, 1]);
    p.destroy();
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });

  it('never parks on the score: over a long run no appearance outlives its three seconds', () => {
    vi.useFakeTimers();
    const p = new UpgradePopup({ random: () => 0.5 });
    const stage = mount(p);
    const popup = stage.querySelector('.c-upgrade-popup')!;
    p.start();
    let onFor = 0;
    let longest = 0;
    let offFor = 0;
    let longestOff = 0;
    for (let i = 0; i < 240; i++) {
      vi.advanceTimersByTime(500);
      if (popup.classList.contains('visible')) {
        onFor += 500;
        longestOff = Math.max(longestOff, offFor);
        offFor = 0;
      } else {
        longest = Math.max(longest, onFor);
        onFor = 0;
        offFor += 500;
      }
    }
    expect(longest).toBeLessThanOrEqual(3_000);
    expect(longestOff).toBeGreaterThanOrEqual(10_000);
    p.destroy();
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });

  it('drops a pending random gap when the licence arrives mid-cycle', () => {
    vi.useFakeTimers();
    const p = new UpgradePopup({ random: () => 1 });
    const stage = mount(p);
    const popup = stage.querySelector('.c-upgrade-popup')!;
    p.start();
    vi.advanceTimersByTime(3_000);
    expect(popup.classList.contains('visible')).toBe(true);
    p.stop();
    expect(popup.classList.contains('visible')).toBe(false);
    vi.advanceTimersByTime(120_000);
    expect(popup.classList.contains('visible')).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });

  it('clears an appearance whose hide timer was throttled away as soon as the page is looked at', () => {
    let clock = 1_000;
    vi.useFakeTimers();
    const p = new UpgradePopup({ random: () => 0.5, now: () => clock });
    const stage = mount(p);
    const popup = stage.querySelector('.c-upgrade-popup')!;
    p.start();
    vi.advanceTimersByTime(3_000);
    expect(popup.classList.contains('visible')).toBe(true);
    // A frozen/occluded renderer: wall time passes but the 3 s timeout is never given a turn.
    clock += 30_000;
    expect(popup.classList.contains('visible')).toBe(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(popup.classList.contains('visible')).toBe(false);
    // The backstop re-arms the rolled gap instead of letting the cycle fire twice.
    vi.advanceTimersByTime(12_499);
    expect(popup.classList.contains('visible')).toBe(false);
    vi.advanceTimersByTime(1);
    expect(popup.classList.contains('visible')).toBe(true);
    p.destroy();
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });

  it('stays silent for the session after Dismiss, even if start is called again', () => {    vi.useFakeTimers();
    const p = new UpgradePopup({ random: () => 0 });
    const stage = mount(p);
    const popup = stage.querySelector('.c-upgrade-popup')!;
    p.start();
    vi.advanceTimersByTime(3_000);
    expect(popup.classList.contains('visible')).toBe(true);
    stage.querySelector<HTMLButtonElement>('.upgrade-popup-btn-close')!.click();
    expect(popup.classList.contains('visible')).toBe(false);
    vi.advanceTimersByTime(60_000);
    expect(popup.classList.contains('visible')).toBe(false);
    p.start();
    vi.advanceTimersByTime(60_000);
    expect(popup.classList.contains('visible')).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });
});

describe('ScorePop ball strip', () => {
  it('pops for each new delivery, lasts three seconds, and ignores a repeat', () => {
    vi.useFakeTimers();
    const p = new ScorePop();
    const stage = mount(p);
    const el = stage.querySelector<HTMLElement>('.c-score-pop')!;
    const ball = createBall({
      over: 11,
      ball: 4,
      runs: 4,
      batterId: t20.batters[0].playerId,
      bowlerId: t20.bowler.playerId,
    });
    const next = { ...t20, score: { runs: 102, wkts: 2, overs: 11, balls: 4 }, thisOver: [ball], lastBalls: [ball] };

    p.update(t20); // first sight is only the baseline
    expect(el.hidden).toBe(true);

    p.update(next);
    expect(el.hidden).toBe(false);
    expect(el.querySelector('.sp-ball')!.textContent).toBe('4');
    expect(el.dataset.kind).toBe('four');
    expect(el.querySelector('.sp-score')!.textContent).toBe('102-2');
    expect(el.querySelector('.sp-overs')!.textContent).toBe('11.4 OV');

    vi.advanceTimersByTime(2_999);
    expect(el.hidden).toBe(false);
    vi.advanceTimersByTime(2);
    expect(el.hidden).toBe(true);

    p.update(next); // the same delivery re-rendered must not pop again
    expect(el.hidden).toBe(true);
    vi.useRealTimers();
  });
});

describe('layouts', () => {
  it('defines ten valid OBS presets with normalized source rectangles', () => {
    expect(OBS_LAYOUT_PRESETS.map((preset) => preset.id)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']);
    for (const preset of OBS_LAYOUT_PRESETS) {
      for (const rect of Object.values(preset.roles)) {
        expect(rect!.x).toBeGreaterThanOrEqual(0);
        expect(rect!.y).toBeGreaterThanOrEqual(0);
        expect(rect!.x + rect!.width).toBeLessThanOrEqual(1);
        expect(rect!.y + rect!.height).toBeLessThanOrEqual(1);
      }
    }
  });

  it('creates zones and switches layout via data attribute only', () => {
    const stage = document.createElement('div');
    const zones = createZones(stage);
    expect(Object.keys(zones).sort()).toEqual(['bottom', 'card', 'left', 'main', 'right', 'top']);
    applyLayout(stage, 'arena', 1.2);
    expect(stage.dataset.layout).toBe('arena');
    expect(stage.style.getPropertyValue('--card-scale')).toBe('1.2');
    const before = stage.children.length;
    applyLayout(stage, 'ticker');
    expect(stage.children.length).toBe(before); // no DOM rebuild
  });
});

describe('pre-match and result screens', () => {
  it('waits for data instead of going to air with a fabricated fixture', () => {
    const s = new PreMatchScreen();
    const pre = mount(s).textContent!;
    expect(pre).toContain('WAITING FOR MATCH DATA');
    expect(pre).not.toMatch(/KINGSMEAD|SOUTH AFRICA VS|AUSTRALIA|10:00 AM/);

    const r = new ResultScreen();
    const res = mount(r).textContent!;
    expect(res).toContain('AWAITING RESULT');
    expect(res).not.toMatch(/KINGSMEAD|214 RUNS|314-6/);

    const f = new StreamFrame();
    expect(mount(f).querySelector('.sf-match-slug')!.textContent).toBe('');
  });


  it('the clock scene shows feed facts and no invented captains or pitch reports', () => {
    const s = new PreMatchScreen();
    const stage = mount(s);
    s.show();
    s.setScene('clock');
    s.update(fixtures.result);
    const text = stage.textContent!;
    expect(text).not.toMatch(/BAVUMA|CUMMINS|PITCH REPORT|HARD GREEN|\b00\b.*HRS/);
    expect(text).toContain('NEWLANDS, CAPE TOWN');
    s.destroy();
  });

  it('the squad scene refuses to list a fabricated eleven', () => {
    const s = new PreMatchScreen();
    const stage = mount(s);
    s.show();
    s.setScene('squad1');
    s.update(fixtures.result);
    const text = stage.textContent!;
    expect(text).toContain('PLAYING XI');
    expect(text).toContain('LINE-UP NOT ANNOUNCED');
    expect(text).not.toMatch(/Markram|Rabada|Ngidi|Khawaja|Starc/);
    s.destroy();
  });

  it('the toss scene follows the reported toss instead of a fixed script', () => {
    const s = new PreMatchScreen();
    const stage = mount(s);
    s.show();
    s.setScene('toss');
    s.update(fixtures.result); // RSA won and elected to bat
    const pills = [...stage.querySelectorAll('.pms-toss-pill')].map((p) => p.textContent ?? '');
    expect(pills[0]).toContain('BATTING FIRST');
    expect(pills[1]).toContain('FIELDING FIRST');
    expect(stage.textContent).toContain('WON THE TOSS');

    s.update({ ...fixtures.result, toss: undefined });
    expect(stage.textContent).toContain('YET TO TAKE PLACE');
    expect(stage.textContent).not.toContain('OFFICIAL TOSS RESULT');
    s.destroy();
  });

  it('the auto cycle is armed only while on air and is disarmed by pinning a scene', () => {
    const armed: number[] = [];
    const setIntervalSpy = vi
      .spyOn(window, 'setInterval')
      .mockImplementation(((fn: () => void, ms: number) => {
        armed.push(ms);
        return 1;
      }) as unknown as typeof window.setInterval);
    const clearSpy = vi
      .spyOn(window, 'clearInterval')
      .mockImplementation((() => undefined) as unknown as typeof window.clearInterval);

    const s = new PreMatchScreen();
    const stage = mount(s);
    s.show();
    s.update(fixtures.result);
    expect(armed).toEqual([15_000]);
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);

    s.setScene('clock'); // a pinned scene must not keep the cycler alive
    expect(clearSpy).toHaveBeenCalledTimes(1);
    s.destroy();
    vi.restoreAllMocks();
    stage.remove();
  });

  it('the result screen reports missing feed data instead of demo figures', () => {
    const r = new ResultScreen();
    const stage = mount(r);
    r.update({
      ...fixtures.result,
      innings: [],
      batters: [
        { ...fixtures.result.batters[0], name: '—' },
        { ...fixtures.result.batters[1], name: '—' },
      ],
      bowler: { ...fixtures.result.bowler, name: '—' },
    });
    const text = stage.textContent!;
    expect(text).toContain('NO INNINGS DATA RECORDED');
    expect(text).toContain('BATTING NOT PROVIDED');
    expect(text).toContain('BOWLING NOT PROVIDED');
    expect(text).not.toMatch(/112\.4|6-49|Hazlewood/);
    r.destroy();
  });
});

describe('BannerQueue', () => {
  const ev = (id: string, type: EngineEvent['type']): EngineEvent => ({
    id,
    matchId: 'm',
    type,
    at: '2026-01-01T00:00:00.000Z',
    payload: {},
  });

  const make = (now = () => 0) => {
    const played: BannerItem[] = [];
    const finishers: (() => void)[] = [];
    const q = new BannerQueue((item, done) => {
      played.push(item);
      finishers.push(done);
    }, now);
    return { q, played, finish: () => finishers.shift()?.() };
  };

  it('plays one at a time, in order', () => {
    const { q, played, finish } = make();
    q.enqueue(ev('a', 'FOUR'));
    q.enqueue(ev('b', 'SIX'));
    q.enqueue(ev('c', 'WICKET'));
    expect(played.map((p) => p.id)).toEqual(['a']);
    finish();
    expect(played.map((p) => p.id)).toEqual(['a', 'b']);
    finish();
    finish();
    expect(played.map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('ignores duplicates and non-banner events', () => {
    const { q, played } = make();
    expect(q.enqueue(ev('a', 'FOUR'))).toBe(true);
    expect(q.enqueue(ev('a', 'FOUR'))).toBe(false);
    expect(q.enqueue(ev('o', 'OVER_END'))).toBe(false);
    expect(played).toHaveLength(1);
  });

  it('keeps a wicket when the queue overflows, dropping boundaries first', () => {
    const { q, played, finish } = make();
    q.enqueue(ev('first', 'FOUR')); // playing
    q.enqueue(ev('w', 'WICKET'));
    for (let i = 0; i < 6; i++) q.enqueue(ev(`f${i}`, 'FOUR'));
    expect(q.pending.length).toBeLessThanOrEqual(4);
    expect(q.pending.some((p) => p.id === 'w')).toBe(true);
    finish();
    expect(played.at(-1)!.id).toBe('w');
  });

  it('drops items that went stale while waiting', () => {
    let t = 0;
    const { q, played, finish } = make(() => t);
    q.enqueue(ev('a', 'FOUR'));
    q.enqueue(ev('b', 'SIX'));
    t = 20_000;
    finish();
    expect(played.map((p) => p.id)).toEqual(['a']);
  });
});
