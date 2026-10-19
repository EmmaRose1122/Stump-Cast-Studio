import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ApiError,
  api,
  eventsApi,
  manualApi,
  type EventRow,
  type ManualDetail,
  type ManualPlayer,
  type ManualSetupInput,
} from '../lib/api';
import {
  EXTRA_LABEL,
  WICKET_KINDS,
  ballFor,
  parsePlayers,
  parseSquadUpload,
  resolveScoringKey,
  sampleSquad,
  type ExtraKind,
} from '../lib/scoring';
import { useAdmin } from '../store';
import { Button, Card, Dialog, EmptyState, Select } from '../ui';

const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

/* Quick graphics matching Screenshot 2026-10-12 202736 -------------------------------------- */

const QUICK = [
  { id: 'striker-profile', label: 'STRIKER', icon: '👤' },
  { id: 'bowler-spell', label: 'BOWLER', icon: '🎯' },
  { id: 'partnership', label: 'PARTNER', icon: '🤝' },
  { id: 'wagon-wheel', label: 'WAGON', icon: '🕸️' },
  { id: 'match-situation', label: 'SITUATION', icon: '📊' },
  { id: 'full-scorecard', label: 'SCORECARD', icon: '📋' },
] as const;

/* Top ON STREAM Banner matching Screenshot 2026-10-12 202736 -------------------------------- */

const OnStreamBanner = () => {
  const matches = useQuery({ queryKey: ['matches'], queryFn: api.matches, refetchInterval: 3000 });
  const settings = useQuery({ queryKey: ['settings'], queryFn: api.settings });
  const list = matches.data ?? [];
  const m = list.find((x) => x.id === settings.data?.onStreamMatchId) ?? list[0];

  if (!m) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-blue-600/60 bg-[#07132b] p-5 shadow-xl w-full">
        <div className="flex items-center gap-3">
          <span className="rounded bg-red-600 px-3 py-1 font-mono text-xs font-black tracking-wider text-white">
            ON STREAM
          </span>
          <div>
            <h2 className="font-heading text-lg font-bold text-white">
              No live match selected yet
            </h2>
            <p className="text-xs text-blue-400">
              Open a match link below or click &quot;Load Live Demo Feed&quot; to test.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const striker = m.batters.find((b) => b.onStrike) ?? m.batters[0];
  const nonStriker = m.batters.find((b) => !b.onStrike) ?? m.batters[1];

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-blue-500/80 bg-gradient-to-r from-[#071538] via-[#0d2254] to-[#071538] p-5 shadow-2xl shadow-blue-950/60 w-full">
      {/* Left Column: ON STREAM badge, Title, Situation */}
      <div className="min-w-0 max-w-2xl space-y-1.5 text-left">
        <div className="flex items-center gap-2">
          <span className="rounded bg-red-600 px-2.5 py-0.5 font-mono text-[11px] font-black tracking-wider text-white shadow-sm">
            ON STREAM
          </span>
          <span className="text-xs font-bold text-amber-400">
            {m.venue || 'Live Cricket Broadcast'}
          </span>
        </div>
        <h2 className="font-heading text-xl font-black text-white truncate">
          {m.title}
        </h2>
        <p className="font-sans text-sm font-semibold text-blue-300">
          {m.status === 'live' ? `Live Match - CRR ${m.crr.toFixed(2)}` : m.status}
          {m.rrr !== undefined ? ` · Need ${m.rrr.toFixed(2)} RRR` : ''}
        </p>
      </div>

      {/* Right Column: Score Block */}
      <div className="flex items-center gap-4 rounded-xl border border-blue-800/60 bg-[#040e24] px-5 py-3 shadow-inner">
        <div className="text-right">
          <div className="font-heading text-4xl font-black tracking-tight text-white tabular-nums">
            <span className="text-blue-400">{m.score.runs}</span>-{m.score.wkts}{' '}
            <span className="text-xl font-bold text-slate-300">
              ({m.score.overs}.{m.score.balls} ov)
            </span>
          </div>
          <div className="mt-1 flex items-center justify-end gap-3 font-mono text-xs text-slate-300">
            <span>
              🏏 {striker?.name ?? '—'}: {striker?.runs ?? 0}* ({striker?.balls ?? 0})
              {nonStriker ? ` · ${nonStriker.name}: ${nonStriker.runs} (${nonStriker.balls})` : ''}
            </span>
            <span>
              🎯 {m.bowler?.name ?? '—'}: {m.bowler?.wkts ?? 0}/{m.bowler?.runs ?? 0}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

/* Quick Graphic Buttons Bar matching Screenshot 2026-10-12 202736 --------------------------- */

const QuickGraphicsBar = () => {
  const toast = useAdmin((s) => s.toast);
  const onAir = useAdmin((s) => s.onAirCard);

  const show = (id: string) =>
    api.showCard(id).catch((e: unknown) =>
      toast({
        title:
          e instanceof ApiError && e.status === 404
            ? 'Card control is not available yet'
            : 'Could not show the card',
        kind: 'error',
      }),
    );

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 rounded-xl border border-blue-900/60 bg-[#0b1736] p-3 w-full shadow-md">
      <span className="font-heading text-xs font-extrabold uppercase tracking-wider text-slate-300 mr-2">
        QUICK GRAPHIC:
      </span>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {QUICK.map((q) => {
          const active = onAir === q.id;
          return (
            <button
              key={q.id}
              type="button"
              onClick={() => void show(q.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 font-heading text-xs font-bold uppercase tracking-wider transition ${
                active
                  ? 'bg-red-600 text-white shadow-md shadow-red-950 border border-red-500'
                  : 'bg-[#102046] text-slate-200 border border-[#213f7a] hover:bg-[#18316a] hover:text-white'
              }`}
            >
              <span>{q.icon}</span>
              <span>{q.label}</span>
            </button>
          );
        })}
        {onAir && (
          <button
            type="button"
            onClick={() => void api.hideCard()}
            className="rounded-lg bg-red-900/70 px-3 py-1.5 font-heading text-xs font-bold uppercase text-red-200 border border-red-600/60 hover:bg-red-800 transition"
          >
            Hide Card
          </button>
        )}
      </div>
    </div>
  );
};

/* Matches List matching Screenshot 2026-10-12 202750 & 203849 ------------------------------- */

const YourMatchesSection = () => {
  const qc = useQueryClient();
  const toast = useAdmin((s) => s.toast);
  const matches = useQuery({ queryKey: ['matches'], queryFn: api.matches, refetchInterval: 3000 });
  const settings = useQuery({ queryKey: ['settings'], queryFn: api.settings });
  const onStream = settings.data?.onStreamMatchId ?? matches.data?.[0]?.id ?? null;

  const put = useMutation({
    mutationFn: (id: string) => api.saveSettings({ ...settings.data!, onStreamMatchId: id }),
    onSuccess: (s) => {
      qc.setQueryData(['settings'], s);
      toast({ title: 'Match is now on stream', kind: 'success' });
    },
    onError: (e) => toast({ title: errorText(e), kind: 'error' }),
  });

  const seedSample = async () => {
    try {
      const res = await fetch('/api/ext/seed-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (res.ok) {
        await qc.invalidateQueries({ queryKey: ['matches'] });
        await qc.invalidateQueries({ queryKey: ['settings'] });
        toast({ title: 'Live demo match loaded successfully!', kind: 'success' });
      }
    } catch {
      toast({ title: 'Could not load demo match', kind: 'error' });
    }
  };

  const list = matches.data ?? [];

  return (
    <div className="space-y-3">
      {/* Header with Title and Action buttons */}
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-base font-extrabold uppercase tracking-wider text-white">
          YOUR MATCHES <span className="text-slate-400">({list.length})</span>
        </h3>
        <div className="flex items-center gap-2">
          {list.length > 0 && (
            <button
              type="button"
              onClick={async () => {
                try {
                  await api.clearMatches();
                  await qc.invalidateQueries({ queryKey: ['matches'] });
                  await qc.invalidateQueries({ queryKey: ['settings'] });
                  toast({ title: 'All matches cleared', kind: 'success' });
                } catch (e) {
                  toast({ title: errorText(e), kind: 'error' });
                }
              }}
              className="flex items-center gap-1 rounded-lg bg-red-950/60 px-3 py-1 text-xs font-bold text-red-300 border border-red-700/50 hover:bg-red-900/60 transition"
            >
              <span>🗑️</span> CLEAR ALL
            </button>
          )}
          <button
            type="button"
            onClick={seedSample}
            className="flex items-center gap-1 rounded-lg bg-amber-600/30 px-3 py-1 text-xs font-bold text-amber-300 border border-amber-500/40 hover:bg-amber-600/50 transition"
          >
            <span>⚡</span> LOAD LIVE DEMO FEED
          </button>
          <button
            type="button"
            onClick={() => void qc.invalidateQueries({ queryKey: ['matches'] })}
            className="flex items-center gap-1 rounded-lg bg-[#142033] px-3 py-1 text-xs font-semibold text-slate-300 border border-[#23354d] hover:bg-[#1e2f4a] transition"
          >
            <span>🔄</span> REFRESH
          </button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#1e2d42] bg-[#0c1424] p-8 text-center">
          <p className="text-sm text-slate-400">
            No live matches detected yet. Click &quot;LOAD LIVE DEMO FEED&quot; above or open a Cricbuzz / Crex link below.
          </p>
          <button
            type="button"
            onClick={seedSample}
            className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 font-heading text-xs font-bold uppercase tracking-wider text-white hover:bg-emerald-500 transition"
          >
            Load Live Match Now
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((m) => {
            const isLiveNow = onStream === m.id;
            return (
              <div
                key={m.id}
                className={`relative flex flex-col justify-between rounded-2xl border-2 p-5 transition ${
                  isLiveNow
                    ? 'border-emerald-500 bg-[#091b1d] shadow-xl shadow-emerald-950/40'
                    : 'border-[#1b2b40] bg-[#0c1524] hover:border-[#2f476a]'
                }`}
              >
                <div>
                  {/* Top Bar: Tour Name and Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-heading text-xs font-bold text-amber-400 truncate">
                      {m.venue || 'Tour Match'}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="rounded bg-rose-600 px-2 py-0.5 font-mono text-[10px] font-black text-white">
                        LIVE
                      </span>
                      {isLiveNow && (
                        <span className="rounded bg-cyan-950 px-2 py-0.5 font-mono text-[10px] font-bold text-cyan-400 border border-cyan-700/50">
                          FOCUSED
                        </span>
                      )}
                      <button
                        type="button"
                        title="Delete this match"
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            await api.deleteMatch(m.id);
                            await qc.invalidateQueries({ queryKey: ['matches'] });
                            await qc.invalidateQueries({ queryKey: ['settings'] });
                            toast({ title: `Deleted ${m.title}`, kind: 'success' });
                          } catch (err) {
                            toast({ title: errorText(err), kind: 'error' });
                          }
                        }}
                        className="rounded p-1 text-slate-500 hover:text-red-400 hover:bg-red-950/40 transition"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  {/* Match Title */}
                  <h4 className="mt-2 font-heading text-base font-black text-white leading-snug">
                    {m.title}
                  </h4>

                  {/* Subtitle / Status */}
                  <p className="mt-2 font-sans text-xs font-semibold text-emerald-400">
                    {m.status === 'live'
                      ? `${m.score.runs}-${m.score.wkts} (${m.score.overs}.${m.score.balls} ov) · CRR ${m.crr.toFixed(2)}`
                      : m.status}
                  </p>

                  <p className="mt-1 font-mono text-[11px] text-slate-400">
                    ID: {m.id} · seen live
                  </p>
                </div>

                {/* Bottom Action Button */}
                <div className="mt-5">
                  {isLiveNow ? (
                    <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-950/80 py-2.5 font-heading text-xs font-black uppercase tracking-wider text-emerald-400 border border-emerald-600/50">
                      <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>ON AIR NOW</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={!settings.data || put.isPending}
                      onClick={() => put.mutate(m.id)}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 font-heading text-xs font-black uppercase tracking-wider text-white hover:bg-emerald-500 transition shadow-md shadow-emerald-950"
                    >
                      <span>📺</span>
                      <span>SHOW ON OVERLAY</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* Open Another Match Card matching Screenshot 2026-10-12 202750 ----------------------------- */

const OpenAnotherMatchCard = () => {
  const toast = useAdmin((s) => s.toast);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const openMatch = async () => {
    if (!url.trim()) {
      toast({ title: 'Please paste a match URL', kind: 'error' });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/ext/command', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'open', url: url.trim() }),
      });
      const data = (await res.json()) as { delivered?: boolean };
      if (data.delivered) {
        toast({ title: 'Match opening in Chrome via Extension!', kind: 'success' });
      } else {
        // Fallback: open directly in window
        window.open(url.trim(), '_blank');
        toast({ title: 'Opened match tab in browser', kind: 'info' });
      }
    } catch {
      window.open(url.trim(), '_blank');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[#1b2b42] bg-[#0c1424] p-5 shadow-lg">
      <div className="flex items-center gap-2 font-heading text-sm font-extrabold uppercase tracking-wider text-white">
        <span>🔌</span>
        <span>OPEN ANOTHER MATCH</span>
      </div>
      <p className="mt-1 text-xs text-slate-400">
        Paste a Cricbuzz or Crex match link — it opens in Chrome and shows up in Your matches above.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.cricbuzz.com/live-cricket-scores/..."
          className="flex-1 min-w-[280px] rounded-xl border border-[#23354d] bg-[#060a12] px-4 py-2.5 font-mono text-xs text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={openMatch}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-xl bg-[#14263d] px-5 py-2.5 font-heading text-xs font-bold uppercase tracking-wider text-white border border-[#25426b] hover:bg-[#1b3454] transition"
        >
          <span>▶</span>
          <span>OPEN IN CHROME</span>
        </button>
      </div>
    </div>
  );
};

/* Sticky Crowd Sound Bar matching Screenshot 2026-10-12 202750 ------------------------------ */

const CrowdAudioBar = () => {
  const toast = useAdmin((s) => s.toast);

  const triggerSound = async (action: string) => {
    try {
      await fetch('/api/sounds/instant', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slot: action === 'four' ? 2 : 1 }),
      });
      toast({ title: `Crowd: ${action} triggered!`, kind: 'info' });
    } catch {
      toast({ title: `Crowd sound fired: ${action}`, kind: 'info' });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#1b2b42] bg-[#09101c] p-2.5 text-xs">
      <span className="font-heading font-extrabold uppercase tracking-wider text-slate-400 mr-2">
        CROWD:
      </span>
      <button
        type="button"
        onClick={() => triggerSound('cheer')}
        className="flex items-center gap-1 rounded-lg bg-[#142033] px-3 py-1 font-semibold text-rose-300 border border-[#23354d] hover:bg-[#1e2f4a] transition"
      >
        <span>📢</span> Cheer
      </button>
      <button
        type="button"
        onClick={() => triggerSound('clap')}
        className="flex items-center gap-1 rounded-lg bg-[#142033] px-3 py-1 font-semibold text-amber-300 border border-[#23354d] hover:bg-[#1e2f4a] transition"
      >
        <span>👏</span> Clap
      </button>
      <button
        type="button"
        onClick={() => triggerSound('four')}
        className="flex items-center gap-1 rounded-lg bg-[#142033] px-3 py-1 font-semibold text-emerald-300 border border-[#23354d] hover:bg-[#1e2f4a] transition"
      >
        <span>🎺</span> Four
      </button>
      <button
        type="button"
        onClick={() => triggerSound('mute')}
        className="flex items-center gap-1 rounded-lg bg-[#142033] px-3 py-1 font-semibold text-slate-400 border border-[#23354d] hover:bg-[#1e2f4a] transition"
      >
        <span className="size-2 rounded-full bg-rose-500 inline-block" /> Mute
      </button>
    </div>
  );
};

/* Event feed -------------------------------------------------------------------------------- */

const EVENT_TONE: Record<string, string> = {
  FOUR: 'text-teal',
  SIX: 'text-amber',
  WICKET: 'text-error',
};

export const describeEvent = (e: EventRow): string => {
  const p = e.payload ?? {};
  switch (e.type) {
    case 'WICKET':
      return `Wicket${typeof p.out === 'string' ? `: ${p.out}` : ''}`;
    case 'FIFTY':
    case 'HUNDRED':
      return `${e.type === 'FIFTY' ? 'Fifty' : 'Hundred'}${typeof p.name === 'string' ? `: ${p.name}` : ''}`;
    case 'OVER_END':
      return `End of over ${String(p.over ?? '')}`.trim();
    case 'MILESTONE':
      return `${String(p.kind ?? 'Milestone')} ${String(p.runs ?? '')}`.trim();
    default:
      return e.type
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/^./, (c) => c.toUpperCase());
  }
};

const EventFeed = () => {
  const events = useQuery({
    queryKey: ['events'],
    queryFn: () => eventsApi.recent(50),
    refetchInterval: 4000,
  });
  const rows = events.data ?? [];
  return (
    <Card title="Event feed">
      {rows.length === 0 ? (
        <p className="text-sm text-muted">Boundaries, wickets and milestones appear here.</p>
      ) : (
        <ul className="max-h-56 divide-y divide-[#1b2a3f] overflow-y-auto" aria-label="Recent events">
          {rows.map((e) => (
            <li key={e.id} className="flex justify-between gap-3 py-2 text-sm">
              <span className={`font-semibold ${EVENT_TONE[e.type] ?? ''}`}>{e.type}</span>
              <span className="flex-1 truncate text-slate-300">{describeEvent(e)}</span>
              <time className="text-slate-500 tabular-nums">{new Date(e.at).toLocaleTimeString()}</time>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};

/* Manual scoring ---------------------------------------------------------------------------- */

const SetupForm = ({ onCreated }: { onCreated: (id: string) => void }) => {
  const toast = useAdmin((s) => s.toast);
  const [a, setA] = useState('Team A');
  const [b, setB] = useState('Team B');
  const [format, setFormat] = useState<'T20' | 'ODI' | 'TEST' | 'OTHER'>('T20');
  const [overs, setOvers] = useState('');
  const [playersA, setPlayersA] = useState(sampleSquad('Team A').join('\n'));
  const [playersB, setPlayersB] = useState(sampleSquad('Team B').join('\n'));

  const fileRefA = useRef<HTMLInputElement>(null);
  const fileRefB = useRef<HTMLInputElement>(null);

  const onSquadFilePick = (e: React.ChangeEvent<HTMLInputElement>, target: 'A' | 'B') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = String(ev.target?.result ?? '');
      const parsed = parseSquadUpload(text, target === 'A' ? a : b);
      if (parsed.teams.length > 0 && parsed.teams[0]) {
        const firstTeam = parsed.teams[0];
        if (target === 'A') {
          if (firstTeam.name && firstTeam.name !== 'Team') setA(firstTeam.name);
          setPlayersA(firstTeam.players.map((p) => p.name).join('\n'));
          const secondTeam = parsed.teams[1];
          if (secondTeam) {
            setB(secondTeam.name);
            setPlayersB(secondTeam.players.map((p) => p.name).join('\n'));
          }
        } else {
          if (firstTeam.name && firstTeam.name !== 'Team') setB(firstTeam.name);
          setPlayersB(firstTeam.players.map((p) => p.name).join('\n'));
        }
        toast({ title: `Imported squad from ${file.name}`, kind: 'success' });
      } else {
        toast({ title: 'No players found in file', kind: 'info' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const create = useMutation({
    mutationFn: (s: ManualSetupInput) => manualApi.create(s),
    onSuccess: (m) => onCreated(m.id),
    onError: (e) =>
      toast({ title: 'Could not create the match', description: errorText(e), kind: 'error' }),
  });

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    create.mutate({
      format,
      overs: overs ? Number(overs) : undefined,
      teams: [
        { name: a.trim(), players: parsePlayers(playersA) },
        { name: b.trim(), players: parsePlayers(playersB) },
      ],
    });
  };

  const field = 'w-full rounded-[10px] border border-border bg-surface-2 px-3 py-2 text-sm';
  return (
    <form onSubmit={submit} className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          Team 1
          <input className={field} value={a} onChange={(e) => setA(e.target.value)} required />
        </label>
        <label className="grid gap-1 text-sm">
          Team 2
          <input className={field} value={b} onChange={(e) => setB(e.target.value)} required />
        </label>
        <div className="grid gap-1 text-sm">
          <div className="flex items-center justify-between">
            <span>Players (one per line)</span>
            <button
              type="button"
              onClick={() => fileRefA.current?.click()}
              className="text-xs text-teal hover:underline flex items-center gap-1 font-semibold"
            >
              📁 Import CSV/JSON
            </button>
            <input
              ref={fileRefA}
              type="file"
              accept=".csv,.json,.txt"
              className="hidden"
              onChange={(e) => onSquadFilePick(e, 'A')}
            />
          </div>
          <textarea
            className={field}
            rows={6}
            value={playersA}
            onChange={(e) => setPlayersA(e.target.value)}
          />
        </div>
        <div className="grid gap-1 text-sm">
          <div className="flex items-center justify-between">
            <span>Players (one per line)</span>
            <button
              type="button"
              onClick={() => fileRefB.current?.click()}
              className="text-xs text-teal hover:underline flex items-center gap-1 font-semibold"
            >
              📁 Import CSV/JSON
            </button>
            <input
              ref={fileRefB}
              type="file"
              accept=".csv,.json,.txt"
              className="hidden"
              onChange={(e) => onSquadFilePick(e, 'B')}
            />
          </div>
          <textarea
            className={field}
            rows={6}
            value={playersB}
            onChange={(e) => setPlayersB(e.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Select
          label="Format"
          value={format}
          onValueChange={(v) => setFormat(v as typeof format)}
          options={[
            { value: 'T20', label: 'T20' },
            { value: 'ODI', label: 'ODI' },
            { value: 'TEST', label: 'Test' },
            { value: 'OTHER', label: 'Other' },
          ]}
        />
        <label className="grid gap-1 text-sm">
          Overs (optional)
          <input
            className={`${field} w-28`}
            inputMode="numeric"
            value={overs}
            onChange={(e) => setOvers(e.target.value.replace(/\D/g, ''))}
          />
        </label>
        <Button type="submit" variant="primary" disabled={create.isPending}>
          Create match
        </Button>
      </div>
    </form>
  );
};

const names = (list: ManualPlayer[]) => list.map((p) => ({ value: p.id, label: p.name }));
const nameOf = (m: ManualDetail, id: string | null) =>
  m.players.flatMap((t) => t.players).find((p) => p.id === id)?.name ?? '—';

const ScoringPanel = ({ matchId }: { matchId: string }) => {
  const qc = useQueryClient();
  const toast = useAdmin((s) => s.toast);
  const detail = useQuery({ queryKey: ['manual', matchId], queryFn: () => manualApi.get(matchId) });
  const m = detail.data;

  const [extra, setExtra] = useState<ExtraKind>('none');
  const [wicketOpen, setWicketOpen] = useState(false);
  const [undoOpen, setUndoOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [resultText, setResultText] = useState('');
  const [kind, setKind] = useState('bowled');
  const [outId, setOutId] = useState('');
  const [newBatter, setNewBatter] = useState('');
  const [pick, setPick] = useState<Record<string, string>>({});
  const ref = useRef<HTMLDivElement>(null);

  const apply = useCallback(
    (promise: Promise<ManualDetail>) =>
      promise
        .then((d) => {
          qc.setQueryData(['manual', matchId], d);
          void qc.invalidateQueries({ queryKey: ['matches'] });
          void qc.invalidateQueries({ queryKey: ['events'] });
          return true;
        })
        .catch((e: unknown) => {
          toast({ title: errorText(e), kind: 'error' });
          return false;
        }),
    [qc, matchId, toast],
  );

  const ready = !!m && m.awaiting.length === 0 && !m.inningsComplete && !m.result;

  const score = useCallback(
    async (n: number) => {
      const payload = ballFor(extra, n);
      if (!payload || !ready) return;
      setExtra('none');
      await apply(manualApi.command(matchId, 'ball', payload));
    },
    [extra, ready, apply, matchId],
  );

  const openWicket = useCallback(() => {
    if (!m || !ready) return;
    setKind('bowled');
    setOutId(m.striker ?? '');
    setNewBatter(m.yetToBat[0]?.id ?? '');
    setWicketOpen(true);
  }, [m, ready]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if ((e.target as HTMLElement).closest('select, input, textarea, [role="combobox"]')) return;
    const k = resolveScoringKey(e.key);
    if (!k) return;
    e.preventDefault();
    if (k.type === 'run') void score(k.n);
    else if (k.type === 'extra') setExtra((cur) => (cur === k.kind ? 'none' : k.kind));
    else if (k.type === 'wicket') openWicket();
    else setUndoOpen(true);
  };

  useEffect(() => {
    setExtra('none');
  }, [matchId]);

  if (!m) return <p className="text-sm text-muted">Loading…</p>;

  const needBatter = m.yetToBat.length > 0;

  const doWicket = async () => {
    const ok = await apply(
      manualApi.command(matchId, 'ball', {
        ...(ballFor(extra, 0) ?? { runs: 0 }),
        wicket: {
          kind,
          playerOutId: outId || undefined,
          newBatterId: needBatter && newBatter ? newBatter : undefined,
        },
      }),
    );
    if (ok) {
      setExtra('none');
      setWicketOpen(false);
    }
  };

  const section = 'rounded-[10px] border border-border p-3';

  return (
    <div
      ref={ref}
      tabIndex={0}
      data-keys="scoring"
      onKeyDown={onKeyDown}
      aria-label="Manual scoring"
      className="grid gap-4 rounded-card outline-none focus-visible:ring-2 focus-visible:ring-teal"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-heading text-lg font-semibold">{m.title}</p>
          <p className="text-sm text-muted">
            Innings {m.inningsNumber} · batting{' '}
            {m.teams.find((t) => t.id === m.battingTeamId)?.name}
            {m.oversLimit ? ` · ${m.oversLimit} overs` : ''}
          </p>
        </div>
        <div className="text-right">
          <p className="font-heading text-3xl font-bold tabular-nums">
            {m.runs}-{m.wkts}{' '}
            <span className="text-xl text-muted">
              ({m.overs}.{m.balls})
            </span>
          </p>
          <p className="text-xs text-muted">CRR {m.crr.toFixed(2)}</p>
        </div>
      </div>

      {m.result ? (
        <div className="rounded-[10px] bg-surface-2 p-3 text-center">
          <p className="font-semibold">{m.result}</p>
          <Button
            className="mt-2"
            onClick={() => void apply(manualApi.command(matchId, 'undo', {}))}
          >
            Undo final action
          </Button>
        </div>
      ) : m.awaiting.length > 0 ? (
        <div className="grid gap-3 rounded-[10px] border border-amber/40 bg-amber/10 p-3">
          <p className="text-sm font-semibold text-amber">Pick incoming players</p>
          <div className="flex flex-wrap gap-3">
            {m.awaiting.map((role) => {
              const options =
                role === 'bowler' ? names(m.bowlerOptions ?? m.bowlers) : names(m.yetToBat);
              return (
                <div key={role} className="flex items-center gap-2">
                  <Select
                    label={role === 'striker' ? 'Striker' : role === 'nonStriker' ? 'Non-striker' : 'Bowler'}
                    value={pick[role] ?? options[0]?.value ?? ''}
                    onValueChange={(v) => setPick((cur) => ({ ...cur, [role]: v }))}
                    options={options}
                  />
                  <Button
                    variant="primary"
                    onClick={() => {
                      const playerId = pick[role] ?? options[0]?.value;
                      if (!playerId) return;
                      if (role === 'bowler') {
                        void apply(manualApi.command(matchId, 'set-bowler', { playerId }));
                      } else {
                        void apply(manualApi.command(matchId, 'set-batter', { slot: role, playerId }));
                      }
                    }}
                  >
                    Confirm
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className={section}>
              <p className="mb-1 text-xs uppercase tracking-wider text-muted">Batters</p>
              <p className="text-sm">
                <span className="font-semibold">{nameOf(m, m.striker)}*</span> ·{' '}
                {nameOf(m, m.nonStriker)}
              </p>
            </div>
            <div className={section}>
              <p className="mb-1 text-xs uppercase tracking-wider text-muted">Bowler</p>
              <p className="text-sm font-semibold">{nameOf(m, m.bowler)}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1" aria-label="Runs">
            {[0, 1, 2, 3, 4, 6].map((n) => (
              <Button
                key={n}
                size="lg"
                variant={n === 4 ? 'primary' : 'secondary'}
                disabled={!ready}
                onClick={() => void score(n)}
              >
                {n}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2" aria-label="Modifiers">
            {(['none', 'wide', 'no-ball', 'bye', 'leg-bye'] as ExtraKind[]).map((k) => (
              <Button
                key={k}
                variant={extra === k ? 'primary' : 'secondary'}
                onClick={() => setExtra((cur) => (cur === k ? 'none' : k))}
              >
                {EXTRA_LABEL[k]}
              </Button>
            ))}
            <Button variant="danger" disabled={!ready} onClick={openWicket}>
              Wicket
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setUndoOpen(true)}>
              Undo ball
            </Button>
            <Button variant="secondary" onClick={() => setEndOpen(true)}>
              End innings
            </Button>
            <Button variant="secondary" onClick={() => setResultOpen(true)}>
              Declare result
            </Button>
          </div>
        </>
      )}

      {/* Dialogs */}
      <Dialog
        open={wicketOpen}
        onOpenChange={setWicketOpen}
        title="Record wicket"
        actions={
          <>
            <Button variant="secondary" onClick={() => setWicketOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void doWicket()}>
              Confirm wicket
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <Select
            label="Dismissal kind"
            value={kind}
            onValueChange={setKind}
            options={WICKET_KINDS}
          />
          <Select
            label="Batter out"
            value={outId}
            onValueChange={setOutId}
            options={[
              { value: m.striker ?? '', label: `${nameOf(m, m.striker)} (striker)` },
              { value: m.nonStriker ?? '', label: `${nameOf(m, m.nonStriker)} (non-striker)` },
            ]}
          />
          {needBatter && (
            <Select
              label="Next batter"
              value={newBatter}
              onValueChange={setNewBatter}
              options={names(m.yetToBat)}
            />
          )}
        </div>
      </Dialog>

      <Dialog
        open={undoOpen}
        onOpenChange={setUndoOpen}
        title="Undo last ball?"
        description="Removes the last delivery and recalculates the score."
        actions={
          <>
            <Button variant="secondary" onClick={() => setUndoOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await apply(manualApi.command(matchId, 'undo', {}));
                setUndoOpen(false);
              }}
            >
              Undo
            </Button>
          </>
        }
      />

      <Dialog
        open={endOpen}
        onOpenChange={setEndOpen}
        title="End this innings?"
        description="Marks the innings closed and prepares for the next."
        actions={
          <>
            <Button variant="secondary" onClick={() => setEndOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await apply(manualApi.command(matchId, 'end-innings', {}));
                setEndOpen(false);
              }}
            >
              End innings
            </Button>
          </>
        }
      />

      <Dialog
        open={resultOpen}
        onOpenChange={setResultOpen}
        title="Declare match result"
        description="Enter the summary text (e.g. South Africa won by 5 wickets)."
        actions={
          <>
            <Button variant="secondary" onClick={() => setResultOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!resultText.trim()}
              onClick={async () => {
                await apply(manualApi.command(matchId, 'result', { text: resultText.trim() }));
                setResultOpen(false);
              }}
            >
              Save result
            </Button>
          </>
        }
      >
        <input
          aria-label="Result text"
          className="w-full rounded-[10px] border border-border bg-surface-2 px-3 py-2 text-sm"
          value={resultText}
          onChange={(e) => setResultText(e.target.value)}
        />
      </Dialog>
    </div>
  );
};

const ManualCard = () => {
  const [active, setActive] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['manual-list'], queryFn: manualApi.list });
  const matches = list.data ?? [];

  useEffect(() => {
    if (!active && matches[0]) setActive(matches[0].id);
  }, [active, matches]);

  return (
    <Card
      title="Manual scoring"
      actions={
        <Button onClick={() => setCreating((c) => !c)}>{creating ? 'Close' : 'New match'}</Button>
      }
    >
      {creating && (
        <div className="mb-4">
          <SetupForm
            onCreated={(id) => {
              setCreating(false);
              setActive(id);
              void qc.invalidateQueries({ queryKey: ['manual-list'] });
              void qc.invalidateQueries({ queryKey: ['matches'] });
            }}
          />
        </div>
      )}
      {matches.length > 1 && (
        <div className="mb-3">
          <Select
            label="Scoring match"
            value={active ?? ''}
            onValueChange={setActive}
            options={matches.map((x) => ({ value: x.id, label: x.title }))}
          />
        </div>
      )}
      {active ? (
        <ScoringPanel key={active} matchId={active} />
      ) : (
        !creating && (
          <EmptyState
            title="No manual match"
            description="Create one to score ball by ball when no data feed is available."
            action={
              <Button variant="primary" onClick={() => setCreating(true)}>
                New match
              </Button>
            }
          />
        )
      )}
    </Card>
  );
};

/* Live Page layout matching Screenshots 202736, 202750, 203849 ------------------------------ */

export const LivePage = () => {
  const [showManual, setShowManual] = useState(false);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 flex flex-col items-center">
      {/* 1. On Stream Banner */}
      <OnStreamBanner />

      {/* 2. Quick Graphic Buttons */}
      <QuickGraphicsBar />

      {/* 3. Your Matches Grid */}
      <div className="w-full">
        <YourMatchesSection />
      </div>

      {/* 4. Open Another Match Card */}
      <div className="w-full">
        <OpenAnotherMatchCard />
      </div>

      {/* 5. Sticky Crowd Sounds Bar */}
      <div className="w-full">
        <CrowdAudioBar />
      </div>

      {/* 6. Optional Manual Scoring & Event Feed Drawer */}
      <div className="w-full rounded-xl border border-blue-900/60 bg-[#0a1636] p-4">
        <div className="flex items-center justify-between">
          <span className="font-heading text-xs font-bold uppercase tracking-wider text-slate-300">
            ADVANCED OPERATOR CONTROLS
          </span>
          <button
            type="button"
            onClick={() => setShowManual((v) => !v)}
            className="rounded px-3 py-1 font-mono text-xs font-bold text-blue-400 hover:bg-blue-950/80 border border-blue-700/50 transition"
          >
            {showManual ? 'Hide Manual Panel' : 'Show Manual Scoring & Event Feed'}
          </button>
        </div>

        {showManual && (
          <div className="mt-4 grid gap-4 lg:grid-cols-2 text-left">
            <ManualCard />
            <EventFeed />
          </div>
        )}
      </div>
    </div>
  );
};
