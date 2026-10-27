import { isProLook2, slug, type BallEvent, type Look, type MatchState } from '@stumpcast/shared';
import { attachPlayerPhoto } from './assets';
import { OverlayComponent } from './component';

/**
 * The Pro Look 2 stage: the operator's own 1280x720 broadcast mockup, painted from live match
 * state. It is a second renderer rather than another arena skin, because the pack's design is a
 * different picture — one three-part score bar with a live side and a "yet to bat" side, a role
 * tab on every player card, and a stat column that changes which rail it sits on.
 *
 * The DOM is built once per look and then patched in place through `data-bind`, so a delivery
 * never replays the entrance animation and never throws away the video element.
 */

interface Pl2Player {
  playerId: string;
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
}

interface Pl2Board {
  team1: string;
  team2: string;
  team2Status: string;
  runs: number;
  wickets: number;
  oversWhole: number;
  oversBalls: number;
  format: string;
  channel: string;
  thisBallNum: string;
  thisBallUnit: string;
  overBalls: string[];
  overRuns: string;
  crr: string;
  partnershipRuns: number;
  partnershipBalls: number;
  lastOv: string;
  proj: string;
  tossNote: string;
  striker: Pl2Player;
  nonStriker: Pl2Player;
  bowler: {
    playerId: string;
    name: string;
    wickets: number;
    runs: number;
    overs: string;
    dots: number;
    maidens: number;
  };
}

const upper = (value: string): string => (value || '').toUpperCase();
const short = (team: { short?: string; name: string }): string => upper(team.short || team.name.slice(0, 3));

/** Names and notes come off a scraped feed, so anything interpolated into markup is escaped. */
export const esc = (value: string): string =>
  value.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

const ballToken = (ball: BallEvent): string => {
  if (ball.wicket) return 'W';
  const extra = ball.extras?.type;
  if (extra === 'wide') return 'wd';
  if (extra === 'noball') return 'nb';
  if (extra === 'bye') return 'b';
  if (extra === 'legbye') return 'lb';
  if (extra === 'penalty') return 'p';
  return String(ball.runs);
};

const ballTotal = (ball: BallEvent): number => ball.runs + (ball.extras?.runs ?? 0);

const sr = (runs: number, balls: number): string => (balls ? ((runs / balls) * 100).toFixed(1) : '0.0');

/** The board the stage draws. Every field is real; nothing here invents a figure the feed lacks. */
export const boardFrom = (state: MatchState): Pl2Board => {
  const batting = state.teams.find((t) => t.id === state.battingTeamId) ?? state.teams[0];
  const other = state.teams.find((t) => t.id !== batting.id) ?? state.teams[1];
  const last = state.lastBalls[state.lastBalls.length - 1];
  const thisOver = state.thisOver ?? [];
  const overRuns = thisOver.reduce((sum, ball) => sum + ballTotal(ball), 0);
  const striker = state.batters.find((b) => b.onStrike) ?? state.batters[0];
  const partner = state.batters.find((b) => b.playerId !== striker.playerId) ?? state.batters[1];
  const otherInnings = state.innings.find((i) => i.battingTeamId === other.id);
  const oversLimit = state.format === 'T20' ? 20 : state.format === 'ODI' ? 50 : 90;
  const projected =
    state.projected ?? (state.format === 'TEST' ? null : Math.round(state.crr * oversLimit));

  return {
    team1: short(batting),
    team2: short(other),
    team2Status: state.target
      ? `NEED ${Math.max(0, state.target - state.score.runs)}`
      : otherInnings
        ? `${otherInnings.score.runs}-${otherInnings.score.wkts}`
        : 'YET TO BAT',
    runs: state.score.runs,
    wickets: state.score.wkts,
    oversWhole: state.score.overs,
    oversBalls: state.score.balls,
    format: state.format,
    channel: 'STUMPCAST',
    thisBallNum: last ? ballToken(last) : '—',
    thisBallUnit: !last
      ? 'THIS BALL'
      : last.wicket
        ? 'WICKET'
        : last.runs === 0
          ? 'DOT'
          : last.runs === 1
            ? 'RUN'
            : 'RUNS',
    overBalls: thisOver.length ? thisOver.slice(-6).map(ballToken) : ['·'],
    overRuns: `+ ${overRuns}`,
    crr: state.crr.toFixed(2),
    partnershipRuns: state.partnership.runs,
    partnershipBalls: state.partnership.balls,
    lastOv: thisOver.length >= 6 ? String(overRuns) : '—',
    proj: projected === null ? '—' : String(projected),
    tossNote: state.toss
      ? `${short(state.teams.find((t) => t.id === state.toss?.winnerTeamId) ?? batting)} OPT TO ${upper(state.toss.decision)}`
      : 'TOSS PENDING',
    striker: {
      playerId: striker.playerId,
      name: upper(striker.name),
      runs: striker.runs,
      balls: striker.balls,
      fours: striker.fours,
      sixes: striker.sixes,
    },
    nonStriker: {
      playerId: partner.playerId,
      name: upper(partner.name),
      runs: partner.runs,
      balls: partner.balls,
      fours: partner.fours,
      sixes: partner.sixes,
    },
    bowler: {
      playerId: state.bowler.playerId,
      name: upper(state.bowler.name),
      wickets: state.bowler.wkts,
      runs: state.bowler.runs,
      overs: `${state.bowler.overs}.${state.bowler.balls}`,
      dots: 0,
      maidens: state.bowler.maidens,
    },
  };
};

/** Look tokens -> the `--look-*` custom properties the stage CSS reads. */
export const pl2Vars = (look: Look): Record<string, string> => {
  const c = look.tokens.colors;
  const bar = look.layoutVariant.broadcastBarStyle ?? 'flat';
  const theme = look.layoutVariant.statTheme ?? 'light';
  const isWhite = theme === 'broadcast-white' || bar === 'floating-white';
  const isDarkCells = theme.startsWith('dark') || theme.startsWith('led') || theme === 'glass-sky';
  const isLed = theme.startsWith('led');
  const isMono = bar.includes('mono');
  const accent = c.accent ?? '#eab308';
  return {
    '--look-accent': accent,
    '--look-accent-alpha': `${accent}88`,
    '--look-secondary': c.secondary ?? c.accent2 ?? '#0e7490',
    '--look-rival-bg': c.rival ?? '#b91c1c',
    // Per-design surface tones: each package carries its own deep panel colour, so two looks
    // never read as the same navy behind the graphics.
    '--look-bg': c.bg ?? '#080e1a',
    '--look-panel': c.panel ?? '#0c1220',
    '--look-panel-deep': c.panelDeep ?? '#080e1a',
    '--look-wing-shade': c.wingShade ?? '#081c2e',
    '--look-rival-shade': c.rivalShade ?? '#450a0a',
    '--look-card-bg': c.card ?? '#0e6482',
    '--look-bowler-card-bg': c.bowlerCard ?? '#991b1b',
    '--look-thisball-bg': isLed ? '#090d16' : '#ffffff',
    '--look-thisball-txt': isLed ? accent : '#0f172a',
    '--look-cell-bg': isDarkCells ? 'var(--look-panel-deep)' : '#ffffff',
    '--look-cell-txt': isLed ? accent : isDarkCells ? '#ffffff' : '#0f172a',
    '--look-hdr-bg': theme === 'mono-light' ? '#09090b' : accent,
    '--look-hdr-txt': theme === 'mono-light' ? '#ffffff' : '#090d16',
    '--look-footer-bg': isWhite ? '#f1f5f9' : 'var(--look-panel-deep)',
    '--look-footer-lbl': isWhite ? '#475569' : '#94a3b8',
    '--look-footer-val': isWhite ? '#0f172a' : '#ffffff',
    '--look-main-txt': isWhite ? '#0f172a' : '#ffffff',
    '--look-score-txt': isLed || isMono ? accent : isWhite ? '#0f172a' : '#ffffff',
    '--look-yet-txt': isWhite ? '#0f172a' : '#fde047',
  };
};

const headSvg = (): string => `
  <svg viewBox="0 0 90 105" style="width:100%; height:100%; display:block;">
    <rect x="33" y="64" width="24" height="41" rx="3" fill="#b87e52"/>
    <rect x="36" y="64" width="18" height="41" fill="#a56c41" opacity="0.35"/>
    <ellipse cx="45" cy="45" rx="20" ry="23" fill="#c68b59"/>
    <path d="M23 36 L23 58 L30 63 L30 36 Z" fill="#1e293b"/>
    <path d="M67 36 L67 58 L60 63 L60 36 Z" fill="#1e293b"/>
    <rect x="32" y="38" width="9" height="2.4" rx="1" fill="#23170f"/>
    <rect x="49" y="38" width="9" height="2.4" rx="1" fill="#23170f"/>
    <circle cx="36.5" cy="42.5" r="2.2" fill="#160e09"/>
    <circle cx="53.5" cy="42.5" r="2.2" fill="#160e09"/>
    <path d="M21 36 C21 10, 69 10, 69 36 L73 39 L17 39 Z" fill="#263548"/>
    <path d="M25 28 C33 14, 57 14, 65 28" fill="none" stroke="#3b4f66" stroke-width="2" opacity="0.6"/>
    <path d="M18 36 Q45 30 72 36 L69 40 Q45 35 21 40 Z" fill="#16202c"/>
    <path d="M25 47 Q45 52 65 47" fill="none" stroke="#1e293b" stroke-width="2.5"/>
    <path d="M26 53.5 Q45 58.5 64 53.5" fill="none" stroke="#1e293b" stroke-width="2.5"/>
    <path d="M29 60 Q45 64.5 61 60" fill="none" stroke="#1e293b" stroke-width="2.5"/>
    <line x1="35" y1="46" x2="36" y2="62" stroke="#1e293b" stroke-width="2.2"/>
    <line x1="45" y1="48" x2="45" y2="63" stroke="#1e293b" stroke-width="2.2"/>
    <line x1="55" y1="46" x2="54" y2="62" stroke="#1e293b" stroke-width="2.2"/>
  </svg>`;

const crestSvg = (side: 'batting' | 'bowling'): string =>
  side === 'batting'
    ? `<svg viewBox="0 0 46 46" style="width:42px; height:42px; flex-shrink:0;">
        <path d="M23 3 L40 9 L40 23 C40 34 23 43 23 43 C23 43 6 34 6 23 L6 9 Z" fill="#0b1526" stroke="#64748b" stroke-width="2"/>
        <line x1="15" y1="14" x2="31" y2="30" stroke="#dc2626" stroke-width="5" stroke-linecap="round"/>
        <line x1="17" y1="12" x2="33" y2="28" stroke="#fbbf24" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="17" cy="27" r="2.5" fill="#fbbf24"/>
      </svg>`
    : `<svg viewBox="0 0 60 38" style="width:58px; height:36px; border-radius:3px; border:1px solid rgba(255,255,255,0.35); flex-shrink:0;">
        <rect width="60" height="12.6" y="0" fill="#ffffff"/>
        <rect width="60" height="12.6" y="12.6" fill="#dc2626"/>
        <rect width="60" height="12.8" y="25.2" fill="#16a34a"/>
        <rect width="20" height="38" x="0" y="0" fill="#dc2626"/>
        <circle cx="10" cy="8.5" r="3.5" fill="none" stroke="#ffffff" stroke-width="1.2"/>
        <path d="M7 5.5 L13 11.5 M13 5.5 L7 11.5" stroke="#ffffff" stroke-width="1.2"/>
      </svg>`;

const ballChips = (balls: string[], size = 32): string =>
  balls
    .map((b) => {
      const isFour = b === '4';
      const isSix = b === '6';
      const isWicket = b === 'W';
      const bg = isFour ? '#2563eb' : isSix || isWicket ? '#10b981' : '#ffffff';
      const txt = isFour || isSix || isWicket ? '#ffffff' : '#0f172a';
      return `<span style="width:${size}px; height:${size - 2}px; border-radius:4px; background:${bg}; color:${txt}; display:inline-flex; align-items:center; justify-content:center; font-size:${size - 14}px; font-weight:900; box-shadow:0 1px 3px rgba(0,0,0,0.4);">${b}</span>`;
    })
    .join('');

const centreBadges = (b: Pl2Board): string => `
  <span style="padding:2px 9px; border-radius:3px; background:#dc2626; color:#ffffff; font-size:10px; font-weight:800; letter-spacing:0.08em; line-height:1;">&bull; LIVE</span>
  <span data-bind="match-format" style="padding:2px 12px; border-radius:3px; background:var(--look-accent); color:#090d16; font-size:13px; font-weight:900; letter-spacing:0.08em; line-height:1.05;">${b.format}</span>
  <span data-bind="match-channel" style="padding:1px 8px; border-radius:999px; background:#090d16; color:#e2e8f0; border:1px solid var(--look-accent-alpha); font-size:8.5px; font-weight:700; letter-spacing:0.08em;">&bull; ${b.channel}</span>`;

const battingBlock = (b: Pl2Board, align: 'left' | 'right'): string => {
  const inner = `
    <div style="display:flex; flex-direction:column;">
      <span data-bind="team1-name" style="font-size:12px; font-weight:800; letter-spacing:0.08em; line-height:1; color:var(--look-main-txt); opacity:0.9;">${esc(b.team1)}</span>
      <div style="display:flex; align-items:baseline; gap:10px; margin-top:2px;">
        <span data-bind="team1-score" style="font-size:50px; font-weight:900; line-height:0.8; letter-spacing:-0.01em; color:var(--look-score-txt); text-shadow:0 2px 6px rgba(0,0,0,0.45);">${b.runs}-${b.wickets}</span>
        <div style="display:flex; flex-direction:column; line-height:0.95;">
          <span data-bind="team1-overs" style="font-size:22px; font-weight:800; color:var(--look-main-txt);">${b.oversWhole}.${b.oversBalls}</span>
          <span style="font-size:9px; font-weight:700; letter-spacing:0.1em; color:var(--look-main-txt); opacity:0.75;">OVERS</span>
        </div>
      </div>
    </div>`;
  return align === 'left'
    ? `<div style="display:flex; align-items:center; gap:12px;">${crestSvg('batting')}${inner}</div>`
    : `<div style="display:flex; align-items:center; gap:12px; justify-content:flex-end;">
        <div style="display:flex; flex-direction:column; align-items:flex-end;">
          <span data-bind="team1-name" style="font-size:12px; font-weight:800; letter-spacing:0.08em; line-height:1; color:var(--look-main-txt); opacity:0.9;">${esc(b.team1)}</span>
          <div style="display:flex; align-items:baseline; gap:10px; margin-top:2px;">
            <div style="display:flex; flex-direction:column; align-items:flex-end; line-height:0.95;">
              <span data-bind="team1-overs" style="font-size:22px; font-weight:800; color:var(--look-main-txt);">${b.oversWhole}.${b.oversBalls}</span>
              <span style="font-size:9px; font-weight:700; letter-spacing:0.1em; color:var(--look-main-txt); opacity:0.75;">OVERS</span>
            </div>
            <span data-bind="team1-score" style="font-size:50px; font-weight:900; line-height:0.8; letter-spacing:-0.01em; color:var(--look-score-txt); text-shadow:0 2px 6px rgba(0,0,0,0.45);">${b.runs}-${b.wickets}</span>
          </div>
        </div>
        ${crestSvg('batting')}
      </div>`;
};

const bowlingBlock = (b: Pl2Board, align: 'left' | 'right'): string => {
  const text = `<div style="text-align:${align}; line-height:1.05;">
      <div data-bind="team2-name" style="font-size:12px; font-weight:800; letter-spacing:0.08em; color:var(--look-main-txt); opacity:0.9;">${esc(b.team2)}</div>
      <div data-bind="team2-status" style="font-size:25px; font-weight:900; letter-spacing:0.03em; color:var(--look-yet-txt);">${esc(b.team2Status)}</div>
    </div>`;
  return align === 'left'
    ? `<div style="display:flex; align-items:center; gap:12px;">${crestSvg('bowling')}${text}</div>`
    : `<div style="display:flex; align-items:center; gap:12px; justify-content:flex-end;">${text}${crestSvg('bowling')}</div>`;
};

const scoreBar = (look: Look, b: Pl2Board): string => {
  const battingLeft = look.layoutVariant.teamOrder !== 'batting-right';
  const bar = look.layoutVariant.broadcastBarStyle ?? 'flat';
  const isWhite = bar === 'floating-white';
  const left = battingLeft ? battingBlock(b, 'left') : bowlingBlock(b, 'left');
  const right = battingLeft ? bowlingBlock(b, 'right') : battingBlock(b, 'right');

  if (bar === 'floating' || bar === 'floating-white') {
    const leftBg = isWhite
      ? '#ffffff'
      : battingLeft
        ? 'linear-gradient(90deg, var(--look-panel-deep) 0%, var(--look-secondary) 100%)'
        : 'linear-gradient(90deg, var(--look-rival-bg) 0%, var(--look-rival-shade) 100%)';
    const rightBg = isWhite
      ? '#ffffff'
      : battingLeft
        ? 'linear-gradient(90deg, var(--look-rival-bg) 0%, var(--look-rival-shade) 100%)'
        : 'linear-gradient(90deg, var(--look-panel-deep) 0%, var(--look-secondary) 100%)';
    return `
      <div class="pl2-scorebar-floating">
        <div class="pl2-pod" style="background:${leftBg}; justify-content:flex-start;">${left}</div>
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px;">${centreBadges(b)}</div>
        <div class="pl2-pod" style="background:${rightBg}; justify-content:flex-end;">${right}</div>
      </div>`;
  }

  const leftWing = battingLeft
    ? 'linear-gradient(90deg, var(--look-wing-shade) 0%, var(--look-secondary) 100%)'
    : 'linear-gradient(90deg, var(--look-rival-shade) 0%, var(--look-rival-bg) 100%)';
  const rightWing = battingLeft
    ? 'linear-gradient(90deg, var(--look-rival-bg) 0%, var(--look-rival-shade) 100%)'
    : 'linear-gradient(90deg, var(--look-secondary) 0%, var(--look-wing-shade) 100%)';
  return `
    <div class="pl2-scorebar-wrap">
      <div class="pl2-wing-left" style="background:${leftWing};">${left}</div>
      <div class="pl2-center-trapezoid">${centreBadges(b)}</div>
      <div class="pl2-wing-right" style="background:${rightWing};">${right}</div>
    </div>`;
};

const playerCard = (
  roleKey: 'striker' | 'nonstriker' | 'bowler',
  label: string,
  name: string,
  big: string,
  sub: string,
  footer: { label: string; val: string | number }[],
  photoRight: boolean,
  badge: string,
): string => {
  const isBowler = roleKey === 'bowler';
  const tabBg = isBowler ? 'var(--look-accent)' : '#ffffff';
  const tabTxt = isBowler ? '#090d16' : '#0f172a';
  const bodyGrad = isBowler
    ? 'linear-gradient(90deg, var(--look-rival-shade) 0%, var(--look-bowler-card-bg) 100%)'
    : 'linear-gradient(90deg, var(--look-panel-deep) 0%, var(--look-card-bg) 100%)';
  // The photo slot keeps the drawn cricketer as its fallback; the real asset is layered on top
  // after paint, so a missing upload still reads as a designed card instead of an empty frame.
  const portrait = `<span class="pl2-photo" data-photo="${roleKey}">${headSvg()}</span>`;
  const photo = badge.startsWith('round')
    ? `<div class="pl2-round-badge">${portrait}</div>`
    : badge.startsWith('square')
      ? `<div class="pl2-square-badge">${portrait}</div>`
      : `<div class="pl2-cutout-wrap">${portrait}</div>`;
  return `
    <div class="pl2-pcard" data-role="${roleKey}" style="background:${bodyGrad};">
      <div class="pl2-role-tab ${photoRight ? 'tab-left' : 'tab-right'}" style="background:${tabBg}; color:${tabTxt};">${label}</div>
      <div class="pl2-pcard-body" style="flex-direction:${photoRight ? 'row-reverse' : 'row'}; justify-content:space-between;">
        ${photo}
        <div style="flex:1; min-width:0; text-align:${photoRight ? 'left' : 'right'};">
          <div data-bind="${roleKey}-name" style="font-size:16px; font-weight:800; text-transform:uppercase; color:var(--look-main-txt); letter-spacing:0.03em; line-height:1.05; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(name)}</div>
          <div style="display:inline-flex; align-items:baseline; gap:6px; margin-top:2px;">
            <span data-bind="${roleKey}-big" style="font-size:44px; font-weight:900; line-height:0.84; color:var(--look-score-txt); text-shadow:0 2px 5px rgba(0,0,0,0.4);">${big}</span>
            <span data-bind="${roleKey}-sub" style="font-size:21px; font-weight:700; line-height:1; color:var(--look-main-txt); opacity:0.9;">${sub}</span>
          </div>
        </div>
      </div>
      <div class="pl2-pcard-footer">
        ${footer
          .map(
            (it, i) =>
              `<span style="color:var(--look-footer-lbl);">${it.label} <strong data-bind="${roleKey}-f${i}" style="color:var(--look-footer-val); font-weight:900; font-size:13.5px;">${it.val}</strong></span>`,
          )
          .join('')}
      </div>
    </div>`;
};

const playerRow = (look: Look, b: Pl2Board): string => {
  const badge = look.layoutVariant.broadcastBadgeStyle ?? 'cutout-left';
  const photoRight = badge.includes('right');
  return `<div class="pl2-players-grid">
    ${playerCard('striker', '&#9889; ON STRIKE', b.striker.name, String(b.striker.runs), `(${b.striker.balls})`, [
      { label: '4s', val: b.striker.fours },
      { label: '6s', val: b.striker.sixes },
      { label: 'SR', val: sr(b.striker.runs, b.striker.balls) },
    ], photoRight, badge)}
    ${playerCard('nonstriker', '&#127951; BATTER', b.nonStriker.name, String(b.nonStriker.runs), `(${b.nonStriker.balls})`, [
      { label: '4s', val: b.nonStriker.fours },
      { label: '6s', val: b.nonStriker.sixes },
      { label: 'SR', val: sr(b.nonStriker.runs, b.nonStriker.balls) },
    ], photoRight, badge)}
    ${playerCard('bowler', '&#9679; BOWLER', b.bowler.name, `${b.bowler.wickets}-${b.bowler.runs}`, `(${b.bowler.overs})`, [
      { label: 'Econ', val: (b.bowler.runs / (parseFloat(b.bowler.overs) || 1)).toFixed(2) },
      { label: 'Dots', val: b.bowler.dots },
      { label: 'M', val: b.bowler.maidens },
    ], photoRight, badge)}
  </div>`;
};

const statSidebar = (b: Pl2Board): string => `
  <div style="display:flex; flex-direction:column; gap:8px;">
    <div style="border-radius:5px; overflow:hidden; border:1.5px solid var(--look-accent); background:var(--look-thisball-bg); box-shadow:0 6px 16px rgba(0,0,0,0.55);">
      <div style="height:19px; padding:0 10px; background:var(--look-hdr-bg); color:var(--look-hdr-txt); font-size:11px; font-weight:800; letter-spacing:0.06em; display:flex; align-items:center; justify-content:space-between;">THIS BALL</div>
      <div style="height:74px; display:flex; align-items:baseline; justify-content:center; gap:6px; padding-top:10px; color:var(--look-thisball-txt);">
        <span data-bind="this-ball-num" style="font-size:54px; font-weight:900; line-height:0.85;">${b.thisBallNum}</span>
        <span data-bind="this-ball-unit" style="font-size:26px; font-weight:900; line-height:1;">${b.thisBallUnit}</span>
      </div>
    </div>
    <div style="border-radius:5px; border:1.5px solid var(--look-accent); background:linear-gradient(90deg, var(--look-panel) 0%, var(--look-rival-shade) 100%); padding:6px 8px; box-shadow:0 6px 16px rgba(0,0,0,0.55);">
      <div style="display:flex; align-items:center; justify-content:space-between; font-size:11px; font-weight:800; color:#cbd5e1; margin-bottom:5px; letter-spacing:0.05em;">
        <span>THIS OVER</span><span data-bind="over-runs" style="color:#ffffff; font-size:13px;">${b.overRuns}</span>
      </div>
      <div data-bind="over-balls" style="display:flex; align-items:center; justify-content:space-between;">${ballChips(b.overBalls)}</div>
    </div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
      ${statCell('CRR', 'crr', b.crr)}
      ${statCellHtml(
        "P'SHIP",
        `<span data-bind="pship">${b.partnershipRuns}</span> <span data-bind="pship-balls" style="font-size:18px; margin-left:4px; opacity:0.85;">(${b.partnershipBalls})</span>`,
      )}
      ${statCell('LAST OV', 'last-ov', b.lastOv)}
      ${statCell('PROJ', 'proj', b.proj)}
    </div>
  </div>`;

const statCell = (label: string, bind: string, value: string): string =>
  statCellHtml(label, `<span data-bind="${bind}">${value}</span>`);

/** `value` may carry markup, so the bind lives on the inner leaf the patcher writes to. */
const statCellHtml = (label: string, value: string): string => `
  <div style="border-radius:4px; overflow:hidden; border:1.5px solid var(--look-accent); background:var(--look-cell-bg); box-shadow:0 4px 12px rgba(0,0,0,0.5);">
    <div style="height:18px; background:var(--look-hdr-bg); color:var(--look-hdr-txt); font-size:11px; font-weight:800; display:flex; align-items:center; justify-content:center; letter-spacing:0.05em;">${label}</div>
    <div style="height:44px; display:flex; align-items:center; justify-content:center; font-size:28px; font-weight:900; color:var(--look-cell-txt);">${value}</div>
  </div>`;

/**
 * The designed CAM 1 monitor. The live camera monitor is re-homed into `[data-pl2-cam]` by the
 * StreamFrame, so the operator's camera shows inside this window. With the camera switched off
 * the whole box is hidden by CSS — the design never advertises a feed that is not there.
 */
const camBox = (): string => `
  <div class="pl2-cam-box" style="height:184px; border-radius:5px; border:1.5px solid var(--look-accent); background:var(--look-panel-deep); display:flex; flex-direction:column; overflow:hidden; box-shadow:0 6px 16px rgba(0,0,0,0.6);">
    <div class="pl2-cam-window" data-pl2-cam>
      <div class="pl2-cam-placeholder">
        <svg viewBox="0 0 24 24" style="width:28px; height:28px; margin-bottom:4px; stroke:currentColor;" fill="none" stroke-width="1.8">
          <rect x="2" y="6" width="14" height="12" rx="2"/><polygon points="16,10 22,7 22,17 16,14"/>
        </svg>
        <span style="font-size:12px; font-weight:800; letter-spacing:0.08em;">CAM 1</span>
      </div>
    </div>
    <div style="height:26px; padding:0 10px; background:linear-gradient(90deg, var(--look-secondary) 0%, var(--look-panel-deep) 100%); border-top:1px solid var(--look-accent-alpha); display:flex; align-items:center; gap:6px; flex-shrink:0;">
      <span style="width:6px; height:6px; border-radius:50%; background:var(--look-accent);"></span>
      <span style="font-size:11.5px; font-weight:800; letter-spacing:0.06em; color:#ffffff;">STREAMER 1</span>
    </div>
  </div>`;

const matchCentre = (b: Pl2Board): string => `
  <div style="height:178px; border-radius:5px; border:1.5px solid var(--look-accent); background:linear-gradient(135deg, var(--look-panel) 0%, var(--look-rival-shade) 100%); padding:10px; display:flex; flex-direction:column; justify-content:space-between; box-shadow:0 6px 16px rgba(0,0,0,0.6);">
    <div style="font-size:13px; font-weight:900; letter-spacing:0.06em; color:var(--look-accent); border-bottom:1px solid rgba(255,255,255,0.14); padding-bottom:4px;">MATCH CENTRE</div>
    <div>
      <div style="display:flex; align-items:center; justify-content:space-between; font-size:10px; font-weight:800; color:#cbd5e1; margin-bottom:4px;">
        <span data-bind="mc-over">OVER ${b.oversWhole + 1}</span>
        <span data-bind="over-runs" style="color:#ffffff; font-size:13px;">${b.overRuns}</span>
      </div>
      <div data-bind="mc-balls" style="display:flex; align-items:center; gap:5px;">${ballChips(b.overBalls.slice(1), 28)}</div>
    </div>
    <div style="border-radius:4px; overflow:hidden; border:1px solid var(--look-accent);">
      <div data-bind="team2-name" style="height:16px; padding:0 8px; background:var(--look-accent); color:#090d16; font-size:10px; font-weight:900; display:flex; align-items:center;">${esc(b.team2)}</div>
      <div data-bind="toss-note" style="height:23px; padding:0 8px; background:#ffffff; color:#0f172a; font-size:12.5px; font-weight:900; display:flex; align-items:center;">${esc(b.tossNote)}</div>
    </div>
  </div>`;

const partnershipBanner = (b: Pl2Board): string => `
  <div style="height:108px; border-radius:5px; border:1.5px solid var(--look-accent); background:#ffffff; color:#0f172a; overflow:hidden; display:flex; flex-direction:column; justify-content:space-between; box-shadow:0 6px 18px rgba(0,0,0,0.6);">
    <div style="height:22px; padding:0 12px; background:#0f766e; color:#ffffff; font-size:11.5px; font-weight:800; display:flex; align-items:center; justify-content:space-between; letter-spacing:0.05em;">
      <span>PARTNERSHIP</span><span data-bind="pship-head">CRR ${b.crr} &bull; ${b.partnershipBalls} BALLS</span>
    </div>
    <div style="flex:1; padding:0 16px; display:flex; align-items:center; justify-content:space-between;">
      <div style="display:flex; align-items:center; gap:10px;">
        <div style="width:46px; height:56px;">${headSvg()}</div>
        <div>
          <div data-bind="striker-name" style="font-size:14px; font-weight:800; color:#334155;">${esc(b.striker.name)}</div>
          <div style="font-size:28px; font-weight:900; line-height:0.9; color:#0369a1;"><span data-bind="pship-a">${b.striker.runs}</span> <span data-bind="pship-a-balls" style="font-size:17px; color:#d97706;">(${b.striker.balls})</span></div>
        </div>
      </div>
      <div style="text-align:center;">
        <div data-bind="pship" style="font-size:44px; font-weight:900; line-height:0.85; color:#d97706;">${b.partnershipRuns}</div>
        <div data-bind="pship-balls" style="font-size:11px; font-weight:800; color:#64748b;">${b.partnershipBalls} BALLS</div>
      </div>
      <div style="display:flex; align-items:center; gap:10px;">
        <div style="text-align:right;">
          <div data-bind="nonstriker-name" style="font-size:14px; font-weight:800; color:#334155;">${esc(b.nonStriker.name)}</div>
          <div style="font-size:28px; font-weight:900; line-height:0.9; color:#0369a1;"><span data-bind="pship-b">${b.nonStriker.runs}</span> <span data-bind="pship-b-balls" style="font-size:17px; color:#d97706;">(${b.nonStriker.balls})</span></div>
        </div>
        <div style="width:46px; height:56px;">${headSvg()}</div>
      </div>
    </div>
  </div>`;

const projectedBanner = (b: Pl2Board): string => {
  const base = parseInt(b.proj, 10) || Math.round(parseFloat(b.crr) * 20);
  return `
  <div style="height:108px; border-radius:5px; border:1.5px solid var(--look-accent); background:#ffffff; color:#0f172a; overflow:hidden; display:flex; flex-direction:column; justify-content:space-between; box-shadow:0 6px 18px rgba(0,0,0,0.6);">
    <div style="height:22px; padding:0 12px; background:linear-gradient(90deg, #0d9488 0%, #b91c1c 100%); color:#ffffff; font-size:11.5px; font-weight:800; display:flex; align-items:center; justify-content:space-between; letter-spacing:0.05em;">
      <span>PROJECTED SCORE</span><span data-bind="proj-rate">@ ${b.crr}/OV</span>
    </div>
    <div style="flex:1; display:grid; grid-template-columns:repeat(4, 1fr); align-items:center; text-align:center;">
      ${[
        { label: `@ ${b.crr}/OV`, value: base - 2, color: '#d97706', bind: 'proj-a' },
        { label: '@ 6/OV', value: base + 29, color: '#0369a1', bind: 'proj-b' },
        { label: '@ 7/OV', value: base + 48, color: '#1d4ed8', bind: 'proj-c' },
        { label: '@ 8/OV', value: base + 66, color: '#0f172a', bind: 'proj-d' },
      ]
        .map(
          (cell, i) => `<div style="${i < 3 ? 'border-right:1px solid #e2e8f0;' : ''}">
            <div data-bind="${cell.bind}-label" style="font-size:11px; font-weight:800; color:#64748b;">${cell.label}</div>
            <div data-bind="${cell.bind}" style="font-size:36px; font-weight:900; line-height:0.95; color:${cell.color};">${cell.value}</div>
          </div>`,
        )
        .join('')}
    </div>
  </div>`;
};

const recentOversBanner = (b: Pl2Board): string => `
  <div style="height:148px; border-radius:5px; border:1.5px solid var(--look-accent); background:#ffffff; color:#0f172a; overflow:hidden; display:flex; flex-direction:column; justify-content:space-between; box-shadow:0 6px 18px rgba(0,0,0,0.6);">
    <div style="height:24px; padding:0 12px; background:linear-gradient(90deg, #991b1b 0%, #0f766e 100%); color:#ffffff; font-size:12px; font-weight:800; display:flex; align-items:center; justify-content:space-between; letter-spacing:0.05em;">
      <span>RECENT OVERS</span><span data-bind="crr-gold" style="color:#fde047;">CRR ${b.crr}</span>
    </div>
    <div style="flex:1; padding:6px 14px; display:flex; flex-direction:column; justify-content:space-between; font-size:17px; font-weight:800;">
      ${[1, 2]
        .map(
          (back) => `<div style="display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid #e2e8f0; padding-bottom:2px;">
          <span style="color:#334155; width:90px;">OVER ${Math.max(0, b.oversWhole - back)}</span>
          <span style="color:#0f172a;">${b.lastOv}</span>
          <span style="color:#d97706; font-weight:900; font-size:20px;">= ${b.lastOv}</span>
        </div>`,
        )
        .join('')}
      <div style="display:flex; align-items:center; justify-content:space-between;">
        <span style="color:#334155; width:90px;">OVER ${b.oversWhole + 1}</span>
        <span data-bind="recent-current" style="display:flex; align-items:center; gap:10px;">${b.overBalls.map(esc).join(' ')}</span>
        <span data-bind="over-runs" style="color:#d97706; font-weight:900; font-size:20px;">= ${b.overRuns.replace('+ ', '')}</span>
      </div>
    </div>
  </div>`;

const clusterStats = (b: Pl2Board): string => `
  <div style="height:148px; display:grid; grid-template-columns:145px 1fr; gap:8px;">
    <div style="border-radius:5px; border:1.5px solid var(--look-accent); background:#ffffff; color:#0f172a; display:flex; flex-direction:column; justify-content:space-between; overflow:hidden; box-shadow:0 6px 16px rgba(0,0,0,0.55);">
      <div style="height:20px; padding:0 8px; background:var(--look-accent); color:#090d16; font-size:11px; font-weight:900; display:flex; align-items:center;">THIS BALL</div>
      <div style="flex:1; display:flex; align-items:baseline; justify-content:center; gap:5px; padding-top:26px;">
        <span data-bind="this-ball-num" style="font-size:62px; font-weight:900; line-height:0.8;">${b.thisBallNum}</span>
        <span data-bind="this-ball-unit" style="font-size:26px; font-weight:900;">${b.thisBallUnit}</span>
      </div>
    </div>
    <div style="display:flex; flex-direction:column; justify-content:space-between; gap:6px;">
      <div style="height:54px; border-radius:5px; border:1.5px solid var(--look-accent); background:linear-gradient(90deg, var(--look-panel) 0%, var(--look-rival-shade) 100%); padding:4px 8px; display:flex; flex-direction:column; justify-content:space-between;">
        <div style="display:flex; justify-content:space-between; font-size:10px; font-weight:800; color:#cbd5e1;">
          <span>THIS OVER</span><span data-bind="over-runs" style="color:#ffffff;">${b.overRuns}</span>
        </div>
        <div data-bind="over-balls-sm" style="display:flex; gap:5px;">${ballChips(b.overBalls, 27)}</div>
      </div>
      <div style="flex:1; display:grid; grid-template-columns:1fr 1fr; gap:6px;">
        ${['CRR|crr|' + b.crr, "P'SHIP|pship-inline|" + b.partnershipRuns + ' (' + b.partnershipBalls + ')', 'LAST OV|last-ov|' + b.lastOv, 'PROJ|proj|' + b.proj]
          .map((row) => {
            const [label, bind, value] = row.split('|');
            return `<div style="border-radius:4px; overflow:hidden; border:1.5px solid var(--look-accent); background:#ffffff; display:flex; align-items:center;">
              <span style="width:44%; height:100%; background:var(--look-accent); color:#090d16; font-size:12px; font-weight:900; display:flex; align-items:center; justify-content:center;">${label}</span>
              <span data-bind="${bind}" style="flex:1; text-align:center; font-size:23px; font-weight:900; color:#0f172a;">${value}</span>
            </div>`;
          })
          .join('')}
      </div>
    </div>
  </div>`;

const videoBox = (): string =>
  `<div class="pl2-video" data-pl2-video style="flex:1; min-height:0;"></div>`;

const middleLayout = (look: Look, b: Pl2Board): string => {
  const kind = look.layoutVariant.middleLayout;
  if (kind.startsWith('right-cluster')) {
    const bottom =
      kind === 'right-cluster-recent' ? recentOversBanner(b) : kind === 'right-cluster-partnership' ? partnershipBanner(b) : '';
    return `
      <div class="pl2-layout-cluster">
        <div style="display:flex; flex-direction:column; gap:8px; height:100%;">
          ${videoBox()}
          ${bottom}
        </div>
        <div style="display:flex; flex-direction:column; justify-content:space-between; gap:8px; height:100%;">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">${camBox()}${matchCentre(b)}</div>
          ${clusterStats(b)}
        </div>
      </div>`;
  }
  if (kind.startsWith('right-stats')) {
    const banner = kind === 'right-stats-projected' ? projectedBanner(b) : kind === 'right-stats-striker' ? partnershipBanner(b) : '';
    return `
      <div class="pl2-layout-right-stats">
        <div style="display:flex; flex-direction:column; gap:8px;">${camBox()}${matchCentre(b)}</div>
        <div style="height:100%; display:flex; flex-direction:column; gap:8px;">
          ${videoBox()}
          ${banner}
        </div>
        <div>${statSidebar(b)}</div>
      </div>`;
  }
  const banner = kind === 'left-stats-projected' ? projectedBanner(b) : kind === 'left-stats-partnership' ? partnershipBanner(b) : '';
  return `
    <div class="pl2-layout-std">
      <div>${statSidebar(b)}</div>
      <div style="height:100%; display:flex; flex-direction:column; gap:8px;">
        <div style="height:${banner ? '342px' : '436px'}; display:flex;">${videoBox()}</div>
        ${banner}
      </div>
      <div style="display:flex; flex-direction:column; gap:8px;">${camBox()}${matchCentre(b)}</div>
    </div>`;
};

/**
 * Each package keeps one continuous effect, chosen from the entrance language it already
 * declares. Six families keep the set varied without inventing a second motion vocabulary.
 */
export type Pl2Ambient = 'sheen' | 'pulse' | 'scan' | 'sweep' | 'orbit' | 'breathe';

const AMBIENT_BY_ENTRANCE: Record<string, Pl2Ambient> = {
  slide: 'sheen',
  'slide-right': 'sheen',
  rise: 'sheen',
  drop: 'sheen',
  glitch: 'scan',
  skew: 'scan',
  stretch: 'scan',
  iris: 'pulse',
  zoom: 'pulse',
  'zoom-out': 'pulse',
  pop: 'pulse',
  diamond: 'pulse',
  spin: 'pulse',
  blinds: 'sweep',
  curtain: 'sweep',
  unfold: 'sweep',
  flip: 'orbit',
  swing: 'orbit',
  fade: 'breathe',
  blur: 'breathe',
};

export const ambientFor = (entrance: string): Pl2Ambient =>
  AMBIENT_BY_ENTRANCE[entrance] ?? 'sheen';

/** The whole 1280x720 package for one look. */
export const pl2StageHtml = (look: Look, b: Pl2Board): string => {
  const v = look.layoutVariant;
  const entrance = look.motion.entrance;
  return `
    <div class="pl2-canvas"
         data-look="${look.id}"
         data-score-position="${v.scorePosition}"
         data-middle-layout="${v.middleLayout}"
         data-player-order="${v.playerOrder}"
         data-bar-style="${v.broadcastBarStyle ?? 'flat'}"
         data-badge-style="${v.broadcastBadgeStyle ?? 'cutout-left'}"
         data-team-order="${v.teamOrder}"
         data-stat-theme="${v.statTheme ?? 'light'}"
         data-entrance="${entrance}"
         data-ambient="${ambientFor(entrance)}">
      <div class="pl2-row-score pl2-entrance" style="animation-name: pl2-anim-${entrance};">${scoreBar(look, b)}</div>
      <div class="pl2-row-middle">${middleLayout(look, b)}</div>
      <div class="pl2-row-players pl2-entrance" style="animation-name: pl2-anim-${entrance};">${playerRow(look, b)}</div>
    </div>`;
};

/** A board with no match yet: the stage still has to look like a broadcast, not a template. */
export const emptyBoard = (): Pl2Board => ({
  team1: '—',
  team2: '—',
  team2Status: 'YET TO BAT',
  runs: 0,
  wickets: 0,
  oversWhole: 0,
  oversBalls: 0,
  format: 'T20',
  channel: 'STUMPCAST',
  thisBallNum: '—',
  thisBallUnit: 'THIS BALL',
  overBalls: ['·'],
  overRuns: '+ 0',
  crr: '0.00',
  partnershipRuns: 0,
  partnershipBalls: 0,
  lastOv: '—',
  proj: '—',
  tossNote: 'TOSS PENDING',
  striker: { playerId: '', name: '—', runs: 0, balls: 0, fours: 0, sixes: 0 },
  nonStriker: { playerId: '', name: '—', runs: 0, balls: 0, fours: 0, sixes: 0 },
  bowler: { playerId: '', name: '—', wickets: 0, runs: 0, overs: '0.0', dots: 0, maidens: 0 },
});

/** Every `data-bind` leaf the stage paints, keyed by its bind name. */
export const bindingsFor = (b: Pl2Board): Record<string, string> => ({
  'team1-name': b.team1,
  'team1-score': `${b.runs}-${b.wickets}`,
  'team1-overs': `${b.oversWhole}.${b.oversBalls}`,
  'team2-name': b.team2,
  'team2-status': b.team2Status,
  'match-format': b.format,
  'match-channel': `• ${b.channel}`,
  'this-ball-num': b.thisBallNum,
  'this-ball-unit': b.thisBallUnit,
  'over-runs': b.overRuns,
  crr: b.crr,
  'crr-gold': `CRR ${b.crr}`,
  'proj-rate': `@ ${b.crr}/OV`,
  pship: String(b.partnershipRuns),
  'pship-balls': `(${b.partnershipBalls})`,
  'pship-inline': `${b.partnershipRuns} (${b.partnershipBalls})`,
  'pship-head': `CRR ${b.crr} • ${b.partnershipBalls} BALLS`,
  'last-ov': b.lastOv,
  proj: b.proj,
  'toss-note': b.tossNote,
  'mc-over': `OVER ${b.oversWhole + 1}`,
  'striker-name': b.striker.name,
  'striker-big': String(b.striker.runs),
  'striker-sub': `(${b.striker.balls})`,
  'striker-f0': String(b.striker.fours),
  'striker-f1': String(b.striker.sixes),
  'striker-f2': sr(b.striker.runs, b.striker.balls),
  'nonstriker-name': b.nonStriker.name,
  'nonstriker-big': String(b.nonStriker.runs),
  'nonstriker-sub': `(${b.nonStriker.balls})`,
  'nonstriker-f0': String(b.nonStriker.fours),
  'nonstriker-f1': String(b.nonStriker.sixes),
  'nonstriker-f2': sr(b.nonStriker.runs, b.nonStriker.balls),
  'bowler-name': b.bowler.name,
  'bowler-big': `${b.bowler.wickets}-${b.bowler.runs}`,
  'bowler-sub': `(${b.bowler.overs})`,
  'bowler-f0': (b.bowler.runs / (parseFloat(b.bowler.overs) || 1)).toFixed(2),
  'bowler-f1': String(b.bowler.dots),
  'bowler-f2': String(b.bowler.maidens),
  'pship-a': String(b.striker.runs),
  'pship-a-balls': `(${b.striker.balls})`,
  'pship-b': String(b.nonStriker.runs),
  'pship-b-balls': `(${b.nonStriker.balls})`,
  'recent-current': b.overBalls.join(' '),
  'proj-a': String((parseInt(b.proj, 10) || 0) - 2),
  'proj-b': String((parseInt(b.proj, 10) || 0) + 29),
  'proj-c': String((parseInt(b.proj, 10) || 0) + 48),
  'proj-d': String((parseInt(b.proj, 10) || 0) + 66),
});

/** The three ball-chip strips differ in size and in how many balls they show. */
const chipStrip = (bind: string, balls: string[]): string => {
  if (bind === 'over-balls') return ballChips(balls, 32);
  if (bind === 'over-balls-sm') return ballChips(balls, 27);
  return ballChips(balls.slice(1), 28);
};

/** The camera API this stage needs; keeps the renderer free of the StreamFrame import cycle. */
export interface Pl2CameraHost {
  element: HTMLElement;
  attachCameraTo(host: HTMLElement | null): void;
}

/**
 * The Pro Look 2 stage component. `attachVideo` hands over the shared StreamFrame element and
 * `attachCamera` re-homes its CAM 1 monitor into this design's camera window.
 */
export class ProLook2Stage extends OverlayComponent {
  protected override readonly alwaysVisible = true;
  private board: Pl2Board = emptyBoard();
  private builtFor: string | null = null;
  private video: HTMLElement | null = null;
  private camera: Pl2CameraHost | null = null;
  private cameraMode: 'none' | 'one' | 'two' = 'none';
  private photoIds = '';
  private lastScore = '';

  protected build(): HTMLElement {
    const root = document.createElement('div');
    root.className = 'pl2-stage';
    root.dataset.camMode = this.cameraMode;
    return root;
  }

  /**
   * The operator's camera setting decides whether the package draws a camera window at all. With
   * the feed switched off, this design must not leave a monitor, a standby slate or a placeholder
   * on screen — "off" has to look off, in the studio preview, the pop-out and the OBS window.
   */
  setCameraMode(mode: 'none' | 'one' | 'two'): void {
    this.cameraMode = mode;
    if (this.root) this.root.dataset.camMode = mode;
  }

  attachVideo(el: HTMLElement | null): void {
    this.video = el;
    if (el) this.placeVideo();
  }

  attachCamera(frame: Pl2CameraHost | null): void {
    if (this.camera && this.camera !== frame) this.camera.attachCameraTo(null);
    this.camera = frame;
    this.placeCamera();
  }

  override setLook(look: Look): void {
    super.setLook(look);
    this.builtFor = null;
    this.photoIds = '';
    this.paint();
  }

  update(state: MatchState): void {
    this.board = boardFrom(state);
    if (this.builtFor !== this.look?.id) this.paint();
    else this.patch();
  }

  private paint(): void {
    if (!this.root || !this.look || !isProLook2(this.look)) return;
    this.builtFor = this.look.id;
    const vars = pl2Vars(this.look);
    for (const [k, v] of Object.entries(vars)) this.root.style.setProperty(k, v);
    this.root.innerHTML = pl2StageHtml(this.look, this.board);
    // The base stylesheet also declares these tokens, so an inherited value from the wrapper is
    // not enough — every look was quietly painting in the first design's palette. Set them on the
    // canvas itself, where they beat the stylesheet's declarations.
    const canvas = this.root.querySelector<HTMLElement>('.pl2-canvas');
    if (canvas) for (const [k, v] of Object.entries(vars)) canvas.style.setProperty(k, v);
    this.lastScore = `${this.board.runs}-${this.board.wickets}`;
    this.placeVideo();
    this.placeCamera();
    this.photoIds = '';
    this.syncPhotos();
  }

  private placeVideo(): void {
    const slot = this.root?.querySelector<HTMLElement>('[data-pl2-video]');
    if (slot && this.video) slot.append(this.video);
  }

  private placeCamera(): void {
    const host = this.root?.querySelector<HTMLElement>('[data-pl2-cam]') ?? null;
    if (this.camera) this.camera.attachCameraTo(host);
  }

  /**
   * Player photos come from the same asset store the arena cards use. A missing file removes the
   * `<img>` and leaves the drawn cricketer, so an un-uploaded squad still looks like a broadcast.
   */
  private syncPhotos(): void {
    if (!this.root) return;
    const ids = [this.board.striker.playerId, this.board.nonStriker.playerId, this.board.bowler.playerId].join('|');
    if (ids === this.photoIds) return;
    this.photoIds = ids;
    const players: Record<string, { playerId: string; name: string }> = {
      striker: this.board.striker,
      nonstriker: this.board.nonStriker,
      bowler: this.board.bowler,
    };
    for (const host of Array.from(this.root.querySelectorAll<HTMLElement>('[data-photo]'))) {
      const player = players[host.dataset.photo ?? ''];
      host.querySelector('img')?.remove();
      host.classList.remove('has-image');
      if (player) attachPlayerPhoto(host, [player.playerId, slug(player.name)]);
    }
  }

  /** A delivery that changes the score flares the number for three quarters of a second. */
  private flashScore(): void {
    const score = `${this.board.runs}-${this.board.wickets}`;
    if (score === this.lastScore) return;
    this.lastScore = score;
    const canvas = this.root?.querySelector<HTMLElement>('.pl2-canvas');
    if (!canvas) return;
    canvas.classList.remove('is-score-flash');
    void canvas.offsetWidth;
    canvas.classList.add('is-score-flash');
    window.setTimeout(() => canvas.classList.remove('is-score-flash'), 800);
  }

  private patch(): void {
    if (!this.root) return;
    const values = bindingsFor(this.board);
    for (const el of Array.from(this.root.querySelectorAll<HTMLElement>('[data-bind]'))) {
      const key = el.dataset.bind!;
      if (key === 'over-balls' || key === 'over-balls-sm' || key === 'mc-balls') {
        el.innerHTML = chipStrip(key, this.board.overBalls);
        continue;
      }
      const next = values[key];
      if (next !== undefined && el.textContent !== next) el.textContent = next;
    }
    this.syncPhotos();
    this.flashScore();
  }
}
