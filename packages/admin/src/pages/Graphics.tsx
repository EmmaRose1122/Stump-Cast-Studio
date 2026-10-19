import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { DEFAULT_DIRECTOR_RULES, type DirectorRule } from '@stumpcast/shared';
import { api } from '../lib/api';
import {
  ALL_CARDS,
  LAYOUTS,
  MODES,
  RULE_EVENTS,
  WIDTHS,
  toggleCarouselCard,
  validateRule,
} from '../lib/graphics';
import { ProLooksModal } from '../shell/ProLooksModal';
import { useAdmin } from '../store';
import { Button, Card, Dialog, Select, Slider, Switch } from '../ui';

interface LookRow {
  id: string;
  name: string;
  plan: 'free' | 'pro';
  builtin: boolean;
  locked: boolean;
  active: boolean;
  swatches: string[];
}

const errText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

const json = async (res: Response) => {
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(body.error ?? `${res.status} ${res.statusText}`);
  return body;
};

interface DirectorState {
  config: {
    mode: 'smart' | 'carousel' | 'manual';
    rules: DirectorRule[];
    carousel: { cards: string[]; intervalSec: number };
  };
  onAir: { cardId: string; source: string } | null;
  queued: string[];
}

export const GraphicsPage = () => {
  const qc = useQueryClient();
  const toast = useAdmin((s) => s.toast);
  const onAir = useAdmin((s) => s.onAirCard);
  const [showProLooks, setShowProLooks] = useState(false);
  const [cardDuration, setCardDuration] = useState('8');
  const [rotationSpeed, setRotationSpeed] = useState('8');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const licenceQuery = useQuery({
    queryKey: ['licence'],
    queryFn: async () => {
      const res = await fetch('/api/licence');
      return res.ok
        ? ((await res.json()) as { licensed: boolean; token: string | null })
        : { licensed: false, token: null };
    },
    refetchInterval: 10000,
  });
  const isLicensed = licenceQuery.data?.licensed ?? false;

  const directorQuery = useQuery({
    queryKey: ['director'],
    queryFn: async () => (await fetch('/api/director').then(json)) as unknown as DirectorState,
    refetchInterval: 3000,
  });

  const putDirector = useMutation({
    mutationFn: async (patch: object) =>
      (await fetch('/api/director', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      }).then(json)) as unknown as DirectorState,
    onSuccess: (d) => {
      qc.setQueryData(['director'], d);
      toast({ title: 'Director updated', kind: 'success' });
    },
    onError: (e) => toast({ title: errText(e), kind: 'error' }),
  });

  const act = (p: Promise<unknown>) =>
    p.catch((e: unknown) => toast({ title: errText(e), kind: 'error' }));

  const handleCardClick = (cardId: string) => {
    if (onAir === cardId) {
      void act(api.hideCard());
    } else {
      void act(api.showCard(cardId, Number(cardDuration)));
    }
  };

  const isDirectorOn = directorQuery.data?.config.mode === 'smart' || directorQuery.data?.config.mode === 'carousel';

  const toggleDirector = () => {
    const nextMode = isDirectorOn ? 'manual' : 'smart';
    putDirector.mutate({ mode: nextMode });
  };

  const resetDirectorDefaults = () => {
    putDirector.mutate({ mode: 'smart', rules: DEFAULT_DIRECTOR_RULES });
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 flex flex-col items-center">
      {/* Pro Look Banner */}
      {isLicensed ? (
        <div className="w-full flex flex-wrap items-center justify-between gap-4 rounded-xl border border-blue-500/40 bg-gradient-to-r from-blue-900/30 via-[#0d1c3e] to-blue-900/20 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="rounded bg-blue-600/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-300 border border-blue-500/50">
              PRO EDITION ACTIVE
            </span>
            <p className="text-xs text-white sm:text-sm">
              <span className="font-bold text-blue-400">All 29 Pro Broadcast Looks Unlocked!</span> Seamlessly theme Arena + Video, Full Screen, TV Strip, and Classic broadcast overlays with your bespoke look.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowProLooks(true)}
              className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-blue-500 shadow-md shadow-blue-950"
            >
              CHOOSE PRO LOOK
            </button>
          </div>
        </div>
      ) : (
        <div className="w-full flex flex-wrap items-center justify-between gap-4 rounded-xl border border-red-500/30 bg-gradient-to-r from-red-950/20 via-[#0c1836] to-blue-950/20 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="rounded bg-red-600/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-400 border border-red-500/40">
              FREE EDITION
            </span>
            <p className="text-xs text-white sm:text-sm">
              You're seeing the <span className="font-bold text-amber-400">basic look</span> — the default look included in the free plan.{' '}
              <span className="text-amber-300 font-medium">Pro channels with a licence key get all 29 broadcast looks</span> with full Arena + Video support.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowProLooks(true)}
              className="rounded-lg bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-black transition hover:bg-amber-400"
            >
              SEE PRO LOOKS
            </button>
            <a
              href="https://wa.me/?text=Hi%20StumpCast%2C%20I%20want%20a%20Pro%20Look"
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-emerald-500/50 bg-emerald-500/20 px-3.5 py-1.5 text-xs font-bold text-emerald-400 transition hover:bg-emerald-500/30"
            >
              GO PRO ON WHATSAPP
            </a>
          </div>
        </div>
      )}

      {/* Auto-Director Cycling Card */}
      <div className="rounded-xl border border-border bg-[#0b1320] p-5 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className={clsx('size-2.5 rounded-full', isDirectorOn ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-muted')} />
              <h2 className="font-heading text-lg font-bold uppercase tracking-wider text-white">
                AUTO-DIRECTOR CYCLING
              </h2>
            </div>
            <p className="mt-1 text-xs text-muted">
              Auto-Director is rotating through cards every {rotationSpeed}s between deliveries.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleDirector}
              className={clsx(
                'flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition uppercase tracking-wider',
                isDirectorOn
                  ? 'bg-emerald-500 text-black shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                  : 'bg-surface-2 text-muted border border-border hover:text-white',
              )}
            >
              <span className={clsx('size-2 rounded-full', isDirectorOn ? 'bg-black' : 'bg-muted')} />
              AUTO-DIRECTOR: {isDirectorOn ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={resetDirectorDefaults}
              className="flex items-center gap-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-muted transition hover:bg-surface hover:text-white"
            >
              <span>↺</span> RESET TO DEFAULTS
            </button>
            {onAir && (
              <button
                onClick={() => void act(api.hideCard())}
                className="rounded-lg bg-red-600/80 px-3 py-1.5 text-xs font-bold text-white shadow transition hover:bg-red-500"
              >
                HIDE CURRENT CARD
              </button>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-4 border-t border-border/50 pt-4 lg:grid-cols-2">
          <div>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">
              🎴 MANUAL CARD DISPLAY DURATION:
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { val: '3', label: '3s Quick Flash' },
                { val: '5', label: '5s Standard' },
                { val: '8', label: '8s Detailed' },
                { val: '15', label: '15s In-Depth' },
                { val: '0', label: '∞ Hold (Sticky)' },
              ].map((item) => (
                <button
                  key={item.val}
                  onClick={() => setCardDuration(item.val)}
                  className={clsx(
                    'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                    cardDuration === item.val
                      ? 'border border-amber-500 bg-amber-500/20 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.25)]'
                      : 'border border-border/80 bg-surface-2 text-muted hover:border-border hover:text-white',
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">
              🔄 AUTO-DIRECTOR ROTATION SPEED:
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { val: '5', label: '5s Interval' },
                { val: '8', label: '8s Interval' },
                { val: '12', label: '12s Interval' },
                { val: '15', label: '15s Interval' },
                { val: '20', label: '20s Interval' },
              ].map((item) => (
                <button
                  key={item.val}
                  onClick={() => {
                    setRotationSpeed(item.val);
                    putDirector.mutate({
                      carousel: {
                        cards: directorQuery.data?.config.carousel.cards ?? ['striker-profile', 'bowler-spell', 'partnership', 'manhattan'],
                        intervalSec: Number(item.val),
                      },
                    });
                  }}
                  className={clsx(
                    'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                    rotationSpeed === item.val
                      ? 'border border-cyan-500 bg-cyan-500/20 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.25)]'
                      : 'border border-border/80 bg-surface-2 text-muted hover:border-border hover:text-white',
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Category 1: PLAYERS & MATCHUPS (HERO CUTOUTS) */}
      <section className="rounded-xl border border-border bg-[#0b1320] p-5 shadow-lg">
        <div className="mb-4 flex items-center justify-between border-b border-border/50 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-purple-400">👤</span>
            <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-purple-400">
              CATEGORY 1: PLAYERS &amp; MATCHUPS (HERO CUTOUTS)
            </h3>
          </div>
          <span className="text-xs font-bold text-muted uppercase tracking-wider">
            5 BROADCAST CARDS
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {/* Card 1: Striker Profile */}
          <div className="flex flex-col justify-between rounded-xl border border-border/80 bg-[#111a28] p-4 transition hover:border-emerald-500/50">
            <div>
              <span className="inline-block rounded bg-surface px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                STRIKER HERO
              </span>
              <h4 className="mt-2 font-heading text-sm font-bold text-white">
                STRIKER PROFILE (HERO)
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Large Striker cutout, runs, balls, strike rate, boundaries, wagon wheel visual &amp; milestone progress bar.
              </p>
            </div>
            <button
              onClick={() => handleCardClick('striker-profile')}
              className={clsx(
                'mt-4 w-full rounded-lg py-2 text-xs font-bold tracking-wider uppercase transition shadow',
                onAir === 'striker-profile'
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-emerald-600 text-white hover:bg-emerald-500',
              )}
            >
              {onAir === 'striker-profile' ? '● ON AIR (HIDE)' : 'SHOW ON STREAM'}
            </button>
          </div>

          {/* Card 2: 360 Wagon Wheel */}
          <div className="flex flex-col justify-between rounded-xl border border-border/80 bg-[#111a28] p-4 transition hover:border-emerald-500/50">
            <div>
              <span className="inline-block rounded bg-surface px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                VISUAL 360°
              </span>
              <h4 className="mt-2 font-heading text-sm font-bold text-white">
                360° WAGON WHEEL
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Visual cricket ground with 8 labeled fielding sectors, color-coded boundaries (4s &amp; 6s), and Off/Leg heatmap.
              </p>
            </div>
            <button
              onClick={() => handleCardClick('wagon-wheel')}
              className={clsx(
                'mt-4 w-full rounded-lg py-2 text-xs font-bold tracking-wider uppercase transition shadow',
                onAir === 'wagon-wheel'
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-emerald-600 text-white hover:bg-emerald-500',
              )}
            >
              {onAir === 'wagon-wheel' ? '● ON AIR (HIDE)' : 'SHOW ON STREAM'}
            </button>
          </div>

          {/* Card 3: Bowler Spell */}
          <div className="flex flex-col justify-between rounded-xl border border-border/80 bg-[#111a28] p-4 transition hover:border-emerald-500/50">
            <div>
              <span className="inline-block rounded bg-surface px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                BOWLER HERO
              </span>
              <h4 className="mt-2 font-heading text-sm font-bold text-white">
                BOWLER SPELL &amp; LENGTHS
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Large Bowler cutout, spell figures (Overs, Maidens, Runs, Wickets), economy, and pitch lengths heatmap.
              </p>
            </div>
            <button
              onClick={() => handleCardClick('bowler-spell')}
              className={clsx(
                'mt-4 w-full rounded-lg py-2 text-xs font-bold tracking-wider uppercase transition shadow',
                onAir === 'bowler-spell'
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-emerald-600 text-white hover:bg-emerald-500',
              )}
            >
              {onAir === 'bowler-spell' ? '● ON AIR (HIDE)' : 'SHOW ON STREAM'}
            </button>
          </div>

          {/* Card 4: Striker vs Bowler */}
          <div className="flex flex-col justify-between rounded-xl border border-border/80 bg-[#111a28] p-4 transition hover:border-emerald-500/50">
            <div>
              <span className="inline-block rounded bg-surface px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                RIVALRY MATRIX
              </span>
              <h4 className="mt-2 font-heading text-sm font-bold text-white">
                STRIKER VS BOWLER CLASH
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Dual player hero matchup! Shows historical career duel: balls faced, runs, strike rate, and dismissals.
              </p>
            </div>
            <button
              onClick={() => handleCardClick('striker-vs-bowler')}
              className={clsx(
                'mt-4 w-full rounded-lg py-2 text-xs font-bold tracking-wider uppercase transition shadow',
                onAir === 'striker-vs-bowler'
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-emerald-600 text-white hover:bg-emerald-500',
              )}
            >
              {onAir === 'striker-vs-bowler' ? '● ON AIR (HIDE)' : 'SHOW ON STREAM'}
            </button>
          </div>

          {/* Card 5: Playing XI Squad */}
          <div className="flex flex-col justify-between rounded-xl border border-border/80 bg-[#111a28] p-4 transition hover:border-emerald-500/50">
            <div>
              <span className="inline-block rounded bg-surface px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                TEAM SHEET
              </span>
              <h4 className="mt-2 font-heading text-sm font-bold text-white">
                PLAYING XI SQUAD
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Official team crest hero graphic, complete Playing XI squad sheet with Captain (c) and Wicketkeeper (wk) tags.
              </p>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => handleCardClick('playing-xi-1')}
                className="w-1/2 rounded-lg bg-emerald-600 py-2 text-xs font-bold uppercase text-white transition hover:bg-emerald-500"
              >
                TEAM 1 XI
              </button>
              <button
                onClick={() => handleCardClick('playing-xi-2')}
                className="w-1/2 rounded-lg bg-emerald-600 py-2 text-xs font-bold uppercase text-white transition hover:bg-emerald-500"
              >
                TEAM 2 XI
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Category 2: MATCH FLOW & SITUATIONS */}
      <section className="rounded-xl border border-border bg-[#0b1320] p-5 shadow-lg">
        <div className="mb-4 flex items-center justify-between border-b border-border/50 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-cyan-400">⚡</span>
            <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-cyan-400">
              CATEGORY 2: MATCH FLOW &amp; SITUATIONS
            </h3>
          </div>
          <span className="text-xs font-bold text-muted uppercase tracking-wider">
            4 BROADCAST CARDS
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Partnership */}
          <div className="flex flex-col justify-between rounded-xl border border-border/80 bg-[#111a28] p-4 transition hover:border-cyan-500/50">
            <div>
              <span className="inline-block rounded bg-surface px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                DUAL HEROES
              </span>
              <h4 className="mt-2 font-heading text-sm font-bold text-white">
                PARTNERSHIP (DUAL HEROES)
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Both striker and non-striker hero cutouts facing inward, stand runs, balls, and animated contribution percentage bar.
              </p>
            </div>
            <button
              onClick={() => handleCardClick('partnership')}
              className={clsx(
                'mt-4 w-full rounded-lg py-2 text-xs font-bold tracking-wider uppercase transition shadow',
                onAir === 'partnership'
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-cyan-600 text-white hover:bg-cyan-500',
              )}
            >
              {onAir === 'partnership' ? '● ON AIR (HIDE)' : 'SHOW ON STREAM'}
            </button>
          </div>

          {/* Card 2: Chase Equation */}
          <div className="flex flex-col justify-between rounded-xl border border-border/80 bg-[#111a28] p-4 transition hover:border-cyan-500/50">
            <div>
              <span className="inline-block rounded bg-surface px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                PRESSURE GAUGE
              </span>
              <h4 className="mt-2 font-heading text-sm font-bold text-white">
                CHASE EQUATION &amp; RRR
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Chase pressure gauge: Required runs from remaining balls, current vs required run rate, target pressure.
              </p>
            </div>
            <button
              onClick={() => handleCardClick('chase-gauge')}
              className={clsx(
                'mt-4 w-full rounded-lg py-2 text-xs font-bold tracking-wider uppercase transition shadow',
                onAir === 'chase-gauge'
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-cyan-600 text-white hover:bg-cyan-500',
              )}
            >
              {onAir === 'chase-gauge' ? '● ON AIR (HIDE)' : 'SHOW ON STREAM'}
            </button>
          </div>

          {/* Card 3: Match Situation */}
          <div className="flex flex-col justify-between rounded-xl border border-border/80 bg-[#111a28] p-4 transition hover:border-cyan-500/50">
            <div>
              <span className="inline-block rounded bg-surface px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                CONTEXT TRACKER
              </span>
              <h4 className="mt-2 font-heading text-sm font-bold text-white">
                MATCH SITUATION &amp; SESSION
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Day/Session tracker, lead/deficit, pitch conditions, projected total, venue and official toss decision.
              </p>
            </div>
            <button
              onClick={() => handleCardClick('match-situation')}
              className={clsx(
                'mt-4 w-full rounded-lg py-2 text-xs font-bold tracking-wider uppercase transition shadow',
                onAir === 'match-situation'
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-cyan-600 text-white hover:bg-cyan-500',
              )}
            >
              {onAir === 'match-situation' ? '● ON AIR (HIDE)' : 'SHOW ON STREAM'}
            </button>
          </div>

          {/* Card 4: Powerplay */}
          <div className="flex flex-col justify-between rounded-xl border border-border/80 bg-[#111a28] p-4 transition hover:border-cyan-500/50">
            <div>
              <span className="inline-block rounded bg-surface px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                OVERS 1-6
              </span>
              <h4 className="mt-2 font-heading text-sm font-bold text-white">
                POWERPLAY &amp; BOUNDARIES
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Overs 1-6 analysis, field restrictions status, boundary count (4s &amp; 6s), and dot-ball percentage breakdown.
              </p>
            </div>
            <button
              onClick={() => handleCardClick('powerplay')}
              className={clsx(
                'mt-4 w-full rounded-lg py-2 text-xs font-bold tracking-wider uppercase transition shadow',
                onAir === 'powerplay'
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-cyan-600 text-white hover:bg-cyan-500',
              )}
            >
              {onAir === 'powerplay' ? '● ON AIR (HIDE)' : 'SHOW ON STREAM'}
            </button>
          </div>
        </div>
      </section>

      {/* Category 3: TELEVISION GRAPHS & ANALYTICS */}
      <section className="rounded-xl border border-border bg-[#0b1320] p-5 shadow-lg">
        <div className="mb-4 flex items-center justify-between border-b border-border/50 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-indigo-400">📊</span>
            <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-indigo-400">
              CATEGORY 3: TELEVISION GRAPHS &amp; ANALYTICS
            </h3>
          </div>
          <span className="text-xs font-bold text-muted uppercase tracking-wider">
            4 BROADCAST CARDS
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Manhattan */}
          <div className="flex flex-col justify-between rounded-xl border border-border/80 bg-[#111a28] p-4 transition hover:border-indigo-500/50">
            <div>
              <span className="inline-block rounded bg-surface px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                BAR CHART
              </span>
              <h4 className="mt-2 font-heading text-sm font-bold text-white">
                INNINGS MANHATTAN GRAPH
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Over-by-over run accumulation bar chart with red wicket markers and current over highlighted in gold.
              </p>
            </div>
            <button
              onClick={() => handleCardClick('manhattan')}
              className={clsx(
                'mt-4 w-full rounded-lg py-2 text-xs font-bold tracking-wider uppercase transition shadow',
                onAir === 'manhattan'
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-indigo-600 text-white hover:bg-indigo-500',
              )}
            >
              {onAir === 'manhattan' ? '● ON AIR (HIDE)' : 'SHOW ON STREAM'}
            </button>
          </div>

          {/* Card 2: Worm */}
          <div className="flex flex-col justify-between rounded-xl border border-border/80 bg-[#111a28] p-4 transition hover:border-indigo-500/50">
            <div>
              <span className="inline-block rounded bg-surface px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                LINE TRAJECTORY
              </span>
              <h4 className="mt-2 font-heading text-sm font-bold text-white">
                COMPARATIVE WORM CHART
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Dual-color innings trajectory curve plotting both teams side-by-side to visualize who is ahead of par.
              </p>
            </div>
            <button
              onClick={() => handleCardClick('worm')}
              className={clsx(
                'mt-4 w-full rounded-lg py-2 text-xs font-bold tracking-wider uppercase transition shadow',
                onAir === 'worm'
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-indigo-600 text-white hover:bg-indigo-500',
              )}
            >
              {onAir === 'worm' ? '● ON AIR (HIDE)' : 'SHOW ON STREAM'}
            </button>
          </div>

          {/* Card 3: Win Predictor */}
          <div className="flex flex-col justify-between rounded-xl border border-border/80 bg-[#111a28] p-4 transition hover:border-indigo-500/50">
            <div>
              <span className="inline-block rounded bg-surface px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                AI PROBABILITY
              </span>
              <h4 className="mt-2 font-heading text-sm font-bold text-white">
                CRICVIZ AI WIN PREDICTOR
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Live win probability percentage bar calculated dynamically from target, wickets, and run rate pressure.
              </p>
            </div>
            <button
              onClick={() => handleCardClick('win-probability')}
              className={clsx(
                'mt-4 w-full rounded-lg py-2 text-xs font-bold tracking-wider uppercase transition shadow',
                onAir === 'win-probability'
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-indigo-600 text-white hover:bg-indigo-500',
              )}
            >
              {onAir === 'win-probability' ? '● ON AIR (HIDE)' : 'SHOW ON STREAM'}
            </button>
          </div>

          {/* Card 4: Fall of Wickets */}
          <div className="flex flex-col justify-between rounded-xl border border-border/80 bg-[#111a28] p-4 transition hover:border-indigo-500/50">
            <div>
              <span className="inline-block rounded bg-surface px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                SCORECARD TIMELINE
              </span>
              <h4 className="mt-2 font-heading text-sm font-bold text-white">
                FALL OF WICKETS TIMELINE
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Scorecard progression timeline of every dismissal, showing score at wicket, over, and partnership broken.
              </p>
            </div>
            <button
              onClick={() => handleCardClick('fall-of-wickets')}
              className={clsx(
                'mt-4 w-full rounded-lg py-2 text-xs font-bold tracking-wider uppercase transition shadow',
                onAir === 'fall-of-wickets'
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-indigo-600 text-white hover:bg-indigo-500',
              )}
            >
              {onAir === 'fall-of-wickets' ? '● ON AIR (HIDE)' : 'SHOW ON STREAM'}
            </button>
          </div>
        </div>
      </section>

      {/* Category 4: REVIEWS, PRESENTATIONS & SCORECARD */}
      <section className="rounded-xl border border-border bg-[#0b1320] p-5 shadow-lg">
        <div className="mb-4 flex items-center justify-between border-b border-border/50 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-amber-400">🏆</span>
            <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-amber-400">
              CATEGORY 4: REVIEWS, PRESENTATIONS &amp; SCORECARD
            </h3>
          </div>
          <span className="text-xs font-bold text-muted uppercase tracking-wider">
            7 BROADCAST CARDS
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Full Scorecard */}
          <div className="flex flex-col justify-between rounded-xl border border-border/80 bg-[#111a28] p-4 transition hover:border-amber-500/50">
            <div>
              <span className="inline-block rounded bg-surface px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                FULL SCORECARD
              </span>
              <h4 className="mt-2 font-heading text-sm font-bold text-white">
                FULL MATCH SCORECARD
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                In-depth innings scorecard table: batter scores, dismissals, strike rates, extras, and lead bowler figures.
              </p>
            </div>
            <button
              onClick={() => handleCardClick('full-scorecard')}
              className={clsx(
                'mt-4 w-full rounded-lg py-2 text-xs font-bold tracking-wider uppercase transition shadow',
                onAir === 'full-scorecard'
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-amber-600 text-white hover:bg-amber-500',
              )}
            >
              {onAir === 'full-scorecard' ? '● ON AIR (HIDE)' : 'SHOW ON STREAM'}
            </button>
          </div>

          {/* Card 2: Coin Toss */}
          <div className="flex flex-col justify-between rounded-xl border border-border/80 bg-[#111a28] p-4 transition hover:border-amber-500/50">
            <div>
              <span className="inline-block rounded bg-surface px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                COIN TOSS
              </span>
              <h4 className="mt-2 font-heading text-sm font-bold text-white">
                COIN TOSS &amp; DECISION
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Official coin toss winner, election to bat/bowl first, pitch report &amp; venue conditions.
              </p>
            </div>
            <button
              onClick={() => handleCardClick('toss')}
              className={clsx(
                'mt-4 w-full rounded-lg py-2 text-xs font-bold tracking-wider uppercase transition shadow',
                onAir === 'toss'
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-amber-600 text-white hover:bg-amber-500',
              )}
            >
              {onAir === 'toss' ? '● ON AIR (HIDE)' : 'SHOW ON STREAM'}
            </button>
          </div>

          {/* Card 3: Fixture Preview */}
          <div className="flex flex-col justify-between rounded-xl border border-border/80 bg-[#111a28] p-4 transition hover:border-amber-500/50">
            <div>
              <span className="inline-block rounded bg-surface px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                FIXTURE PREVIEW
              </span>
              <h4 className="mt-2 font-heading text-sm font-bold text-white">
                UPCOMING FIXTURE PREVIEW
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Dual team spotlight, match series details, tournament badges, venue &amp; schedule.
              </p>
            </div>
            <button
              onClick={() => handleCardClick('fixture-preview')}
              className={clsx(
                'mt-4 w-full rounded-lg py-2 text-xs font-bold tracking-wider uppercase transition shadow',
                onAir === 'fixture-preview'
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-amber-600 text-white hover:bg-amber-500',
              )}
            >
              {onAir === 'fixture-preview' ? '● ON AIR (HIDE)' : 'SHOW ON STREAM'}
            </button>
          </div>

          {/* Card 4: Ball Spotlight */}
          <div className="flex flex-col justify-between rounded-xl border border-border/80 bg-[#111a28] p-4 transition hover:border-amber-500/50">
            <div>
              <span className="inline-block rounded bg-surface px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                DELIVERY RECAP
              </span>
              <h4 className="mt-2 font-heading text-sm font-bold text-white">
                BALL COMMENTARY SPOTLIGHT
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Delivery recap spotlight: bowler to batsman live delivery narrative &amp; outcome badge.
              </p>
            </div>
            <button
              onClick={() => handleCardClick('ball-spotlight')}
              className={clsx(
                'mt-4 w-full rounded-lg py-2 text-xs font-bold tracking-wider uppercase transition shadow',
                onAir === 'ball-spotlight'
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-amber-600 text-white hover:bg-amber-500',
              )}
            >
              {onAir === 'ball-spotlight' ? '● ON AIR (HIDE)' : 'SHOW ON STREAM'}
            </button>
          </div>

          {/* Card 5: Post Match */}
          <div className="flex flex-col justify-between rounded-xl border border-border/80 bg-[#111a28] p-4 transition hover:border-amber-500/50">
            <div>
              <span className="inline-block rounded bg-surface px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                POST MATCH
              </span>
              <h4 className="mt-2 font-heading text-sm font-bold text-white">
                POST-MATCH PRESENTATION
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Official post-match presentation card: final team scores, winner declaration, and Player of the Match trophy.
              </p>
            </div>
            <button
              onClick={() => handleCardClick('post-match')}
              className={clsx(
                'mt-4 w-full rounded-lg py-2 text-xs font-bold tracking-wider uppercase transition shadow',
                onAir === 'post-match'
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-amber-600 text-white hover:bg-amber-500',
              )}
            >
              {onAir === 'post-match' ? '● ON AIR (HIDE)' : 'SHOW ON STREAM'}
            </button>
          </div>

          {/* Card 6: DRS Review */}
          <div className="flex flex-col justify-between rounded-xl border border-border/80 bg-[#111a28] p-4 transition hover:border-amber-500/50">
            <div>
              <span className="inline-block rounded bg-surface px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                TV UMPIRE REVIEW
              </span>
              <h4 className="mt-2 font-heading text-sm font-bold text-white">
                DRS DECISION REVIEW
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Official TV Umpire Decision Review System: Pitching (In-Line), Impact (In-Line), Wickets (Hitting Stumps).
              </p>
            </div>
            <button
              onClick={() => handleCardClick('drs-review')}
              className={clsx(
                'mt-4 w-full rounded-lg py-2 text-xs font-bold tracking-wider uppercase transition shadow',
                onAir === 'drs-review'
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-amber-600 text-white hover:bg-amber-500',
              )}
            >
              {onAir === 'drs-review' ? '● ON AIR (HIDE)' : 'SHOW ON STREAM'}
            </button>
          </div>

          {/* Card 7: Milestone Celebration */}
          <div className="flex flex-col justify-between rounded-xl border border-border/80 bg-[#111a28] p-4 transition hover:border-amber-500/50">
            <div>
              <span className="inline-block rounded bg-surface px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                LANDMARK BANNER
              </span>
              <h4 className="mt-2 font-heading text-sm font-bold text-white">
                MILESTONE CELEBRATION
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Official TV gold celebration feature card celebrating landmark achievements, half-centuries, and centuries.
              </p>
            </div>
            <button
              onClick={() => handleCardClick('milestone')}
              className={clsx(
                'mt-4 w-full rounded-lg py-2 text-xs font-bold tracking-wider uppercase transition shadow',
                onAir === 'milestone'
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-amber-600 text-white hover:bg-amber-500',
              )}
            >
              {onAir === 'milestone' ? '● ON AIR (HIDE)' : 'SHOW ON STREAM'}
            </button>
          </div>
        </div>
      </section>

      {/* Advanced Director & Looks Toggle */}
      <div className="border-t border-border pt-4">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs font-semibold text-muted hover:text-white"
        >
          {showAdvanced ? '▲ Hide Advanced Rule Engine & Look Manager' : '▼ Show Advanced Rule Engine & Look Manager'}
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-6">
            <DirectorSection />
            <LooksSection />
            <LayoutSection />
          </div>
        )}
      </div>

      <ProLooksModal open={showProLooks} onClose={() => setShowProLooks(false)} />
    </div>
  );
};

/* Advanced Subsections for Settings & Tests compatibility ---------------------------------- */

const DirectorSection = () => {
  const qc = useQueryClient();
  const toast = useAdmin((s) => s.toast);
  const q = useQuery({
    queryKey: ['director'],
    queryFn: async () => (await fetch('/api/director').then(json)) as unknown as DirectorState,
    refetchInterval: 4000,
  });

  const [rules, setRules] = useState<DirectorRule[]>([]);
  const [carousel, setCarousel] = useState({ cards: [] as string[], intervalSec: 15 });
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (q.data && !dirty) {
      setRules(q.data.config.rules);
      setCarousel(q.data.config.carousel);
    }
  }, [q.data, dirty]);

  const put = useMutation({
    mutationFn: async (patch: object) =>
      (await fetch('/api/director', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      }).then(json)) as unknown as DirectorState,
    onSuccess: (d) => {
      qc.setQueryData(['director'], d);
      setDirty(false);
      toast({ title: 'Director updated', kind: 'success' });
    },
    onError: (e) => toast({ title: errText(e), kind: 'error' }),
  });

  if (!q.data) return <Card title="Director">Loading…</Card>;
  const mode = q.data.config.mode;

  const updateRule = (i: number, patch: Partial<DirectorRule>) => {
    setRules((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
    setDirty(true);
  };
  const ruleErrors = rules.map(validateRule);
  const invalid = ruleErrors.some(Boolean);
  const cell = 'rounded-[8px] border border-border bg-surface-2 px-2 py-1 text-sm w-20';

  return (
    <Card title="Advanced Director Rules">
      <div role="radiogroup" aria-label="Director mode" className="grid gap-2 sm:grid-cols-3">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={mode === m.value}
            onClick={() => put.mutate({ mode: m.value })}
            className={clsx(
              'rounded-[10px] border p-3 text-left',
              mode === m.value ? 'border-teal bg-surface-2' : 'border-border',
            )}
          >
            <span className="block font-semibold">{m.label}</span>
            <span className="text-sm text-muted">{m.hint}</span>
          </button>
        ))}
      </div>

      {q.data.onAir && (
        <p className="mt-3 text-sm text-muted">
          On air: <b>{q.data.onAir.cardId}</b> ({q.data.onAir.source})
          {q.data.queued.length > 0 ? ` · queued: ${q.data.queued.join(', ')}` : ''}
        </p>
      )}

      {mode === 'smart' && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold">Rules</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted">
                  <th className="pb-1 pr-2">When</th>
                  <th className="pb-1 pr-2">Show</th>
                  <th className="pb-1 pr-2">Seconds</th>
                  <th className="pb-1 pr-2">Cooldown</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rules.map((r, i) => (
                  <tr key={i} className="align-top">
                    <td className="pr-2 py-1">
                      <Select
                        label={`Rule ${i + 1} event`}
                        value={r.on}
                        onValueChange={(v) => updateRule(i, { on: v })}
                        options={RULE_EVENTS}
                      />
                    </td>
                    <td className="pr-2 py-1">
                      <Select
                        label={`Rule ${i + 1} card`}
                        value={r.card}
                        onValueChange={(v) => updateRule(i, { card: v })}
                        options={ALL_CARDS.map((c) => ({ value: c.id, label: c.label }))}
                      />
                    </td>
                    <td className="pr-2 py-1">
                      <input
                        aria-label={`Rule ${i + 1} seconds`}
                        className={cell}
                        inputMode="numeric"
                        value={r.durationSec}
                        onChange={(e) =>
                          updateRule(i, { durationSec: Number(e.target.value.replace(/\D/g, '')) })
                        }
                      />
                    </td>
                    <td className="pr-2 py-1">
                      <input
                        aria-label={`Rule ${i + 1} cooldown`}
                        className={cell}
                        inputMode="numeric"
                        value={r.cooldownSec}
                        onChange={(e) =>
                          updateRule(i, { cooldownSec: Number(e.target.value.replace(/\D/g, '')) })
                        }
                      />
                      {ruleErrors[i] && <p className="text-xs text-error">{ruleErrors[i]}</p>}
                    </td>
                    <td className="py-1">
                      <Button
                        variant="ghost"
                        aria-label={`Remove rule ${i + 1}`}
                        onClick={() => {
                          setRules((rs) => rs.filter((_, idx) => idx !== i));
                          setDirty(true);
                        }}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              onClick={() => {
                setRules((rs) => [
                  ...rs,
                  {
                    on: 'OVER_END',
                    card: 'manhattan',
                    durationSec: 8,
                    cooldownSec: 30,
                    priority: 1,
                  },
                ]);
                setDirty(true);
              }}
            >
              Add rule
            </Button>
            <Button
              onClick={() => {
                setRules(DEFAULT_DIRECTOR_RULES);
                setDirty(true);
              }}
            >
              Reset to defaults
            </Button>
            <Button
              variant="primary"
              disabled={!dirty || invalid || put.isPending}
              onClick={() => put.mutate({ rules })}
            >
              Save rules
            </Button>
          </div>
        </div>
      )}

      {mode === 'carousel' && (
        <div className="mt-4 grid gap-4">
          <Slider
            label="Interval"
            value={carousel.intervalSec}
            min={5}
            max={60}
            format={(v) => `${v} s`}
            onValueChange={(v) => {
              setCarousel((c) => ({ ...c, intervalSec: v }));
              setDirty(true);
            }}
          />
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Cards in the carousel</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ALL_CARDS.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={carousel.cards.includes(c.id)}
                    onChange={() => {
                      setCarousel((cr) => ({ ...cr, cards: toggleCarouselCard(cr.cards, c.id) }));
                      setDirty(true);
                    }}
                  />
                  {c.label}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <Button
              variant="primary"
              disabled={!dirty || put.isPending}
              onClick={() => put.mutate({ carousel })}
            >
              Save carousel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};

const LooksSection = () => {
  const qc = useQueryClient();
  const toast = useAdmin((s) => s.toast);
  const [upgrade, setUpgrade] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [isActivating, setIsActivating] = useState(false);

  const looks = useQuery({
    queryKey: ['looks'],
    queryFn: async () =>
      (await fetch('/api/looks').then(json)) as unknown as { licensed: boolean; looks: LookRow[] },
  });
  const activate = useMutation({
    mutationFn: async (id: string) =>
      json(
        await fetch('/api/looks/activate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id, preview: true }),
        }),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['looks'] });
      void qc.invalidateQueries({ queryKey: ['settings'] });
      toast({ title: 'Look applied to the overlay', kind: 'success' });
    },
    onError: (e) => toast({ title: errText(e), kind: 'error' }),
  });

  const list = looks.data?.looks ?? [];
  return (
    <Card title="Looks">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {list.map((l) => (
          <button
            key={l.id}
            type="button"
            aria-label={`${l.name}${l.locked ? ' (locked, Pro)' : ''}${l.active ? ' (active)' : ''}`}
            aria-pressed={l.active}
            onClick={() => (l.locked ? setUpgrade(true) : activate.mutate(l.id))}
            className={clsx(
              'rounded-[10px] border p-3 text-left',
              l.active ? 'border-teal bg-surface-2' : 'border-border',
            )}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="font-semibold">{l.name}</span>
              <span className="text-xs text-muted">
                {l.locked ? '🔒 Pro' : l.plan === 'pro' ? 'Pro' : 'Free'}
              </span>
            </span>
            <span className="mt-2 flex gap-1" aria-hidden>
              {l.swatches.map((c) => (
                <span
                  key={c}
                  className="size-5 rounded-full border border-border"
                  style={{ background: c }}
                />
              ))}
            </span>
          </button>
        ))}
      </div>
      <Dialog
        open={upgrade}
        onOpenChange={setUpgrade}
        title="Unlock Pro Looks"
        description="This look requires a StumpCast Pro licence. Enter your licence key below to unlock all Pro looks permanently."
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setUpgrade(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={isActivating || !keyInput.trim()}
              onClick={async () => {
                const key = keyInput.trim();
                if (!key) return;
                setIsActivating(true);
                try {
                  const res = await fetch('/api/licence', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ key }),
                  });
                  if (res.ok) {
                    toast({ title: 'Licence activated! All Pro looks unlocked.', kind: 'success' });
                    setUpgrade(false);
                    setKeyInput('');
                    void qc.invalidateQueries({ queryKey: ['looks'] });
                    void qc.invalidateQueries({ queryKey: ['licence'] });
                  } else {
                    const data = await res.json().catch(() => ({}));
                    toast({ title: data.error || 'Failed to activate licence key', kind: 'error' });
                  }
                } catch {
                  toast({ title: 'Network error activating licence key', kind: 'error' });
                } finally {
                  setIsActivating(false);
                }
              }}
            >
              {isActivating ? 'Activating…' : 'Activate Licence'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Enter your StumpCast Pro licence key below to unlock all Pro looks for your broadcast overlay:
          </p>
          <input
            type="text"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="Enter licence key (e.g. SC-PRO-XXXX-XXXX)"
            className="w-full rounded-lg border border-[#223652] bg-[#0c1424] px-4 py-2 font-mono text-sm text-white focus:border-emerald-500 focus:outline-none"
          />
        </div>
      </Dialog>
    </Card>
  );
};

const LayoutSection = () => {
  const qc = useQueryClient();
  const toast = useAdmin((s) => s.toast);
  const settings = useQuery({ queryKey: ['settings'], queryFn: api.settings });
  const [scale, setScale] = useState(1);
  const [sideScale, setSideScale] = useState(1);

  useEffect(() => {
    if (settings.data) {
      setScale(settings.data.cardScale);
      setSideScale(settings.data.sideCardScale ?? 1);
    }
  }, [settings.data]);

  const save = useMutation({
    mutationFn: api.saveSettings,
    onSuccess: (s) => qc.setQueryData(['settings'], s),
    onError: (e) => toast({ title: errText(e), kind: 'error' }),
  });
  const s = settings.data;
  if (!s) return <Card title="Layout">Loading…</Card>;

  return (
    <Card title="Layout and size">
      <div className="grid gap-5">
        <div
          role="radiogroup"
          aria-label="Layout"
          className="grid grid-cols-2 gap-2 sm:grid-cols-4"
        >
          {LAYOUTS.map((l) => (
            <button
              key={l.value}
              type="button"
              role="radio"
              aria-checked={s.layout === l.value}
              onClick={() => save.mutate({ ...s, layout: l.value })}
              className={clsx(
                'rounded-[10px] border p-3 font-medium',
                s.layout === l.value ? 'border-teal bg-surface-2' : 'border-border',
              )}
            >
              {l.label}
            </button>
          ))}
        </div>
        <Slider
          label="Middle card size"
          value={scale}
          min={0.8}
          max={2}
          step={0.1}
          format={(v) => `${v.toFixed(1)}×`}
          onValueChange={setScale}
          onValueCommit={(v) => save.mutate({ ...s, cardScale: Math.round(v * 10) / 10 })}
        />
        <Slider
          label="Side score cards size"
          value={sideScale}
          min={0.8}
          max={2}
          step={0.05}
          format={(v) => `${v.toFixed(2)}×`}
          onValueChange={setSideScale}
          onValueCommit={(v) => save.mutate({ ...s, sideCardScale: Math.round(v * 100) / 100 })}
        />
        <div role="radiogroup" aria-label="Card width" className="flex flex-wrap gap-2">
          {WIDTHS.map((w) => (
            <Button
              key={w.value}
              role="radio"
              aria-checked={s.cardWidth === w.value}
              variant={s.cardWidth === w.value ? 'primary' : 'secondary'}
              onClick={() => save.mutate({ ...s, cardWidth: w.value })}
            >
              {w.label}
            </Button>
          ))}
        </div>
        <Switch
          id="gfx-badge"
          checked={s.dataDelayedBadge}
          onCheckedChange={(v) => save.mutate({ ...s, dataDelayedBadge: v })}
          label='Show a "Data delayed" badge on the overlay'
        />
      </div>
    </Card>
  );
};
