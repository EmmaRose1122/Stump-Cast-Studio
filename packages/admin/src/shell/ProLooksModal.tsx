import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ALL_PRO_LOOKS, getLook, whatsappUrl } from '@stumpcast/shared';
import { useAdmin } from '../store';
import { useServerOrigin } from '../lib/api';
import { LookPreview } from './LookPreview';

export interface ProLookItem {
  id: string;
  name: string;
  badge: string;
  themeColor: string;
  tags: string[];
  gradient: string;
}

const BROADCAST_LOOKS: ProLookItem[] = [
  {
    id: 'k01',
    name: 'Stadium Gold',
    badge: 'K01',
    themeColor: '#eab308',
    tags: ['slide entrances', 'scores on top', 'cut-out player photos', 'split-bar 4/6 graphic'],
    gradient: 'from-amber-600 via-yellow-500 to-amber-700',
  },
  {
    id: 'k02',
    name: 'Stadium Emerald',
    badge: 'K02',
    themeColor: '#10b981',
    tags: ['rise entrances', 'scores at the bottom', 'floating score cards', 'photo badges on the right'],
    gradient: 'from-emerald-700 via-teal-600 to-emerald-900',
  },
  {
    id: 'k03',
    name: 'Neon Cyan',
    badge: 'K03',
    themeColor: '#06b6d4',
    tags: ['glitch entrances', 'scores at the bottom', 'round photo badges', 'split-bar 4/6 graphic'],
    gradient: 'from-cyan-600 via-sky-500 to-blue-800',
  },
  {
    id: 'k04',
    name: 'Neon Magenta',
    badge: 'K04',
    themeColor: '#ec4899',
    tags: ['iris entrances', 'scores on top', 'arrow score bar', 'mirrored player cards'],
    gradient: 'from-pink-600 via-fuchsia-500 to-purple-800',
  },
  {
    id: 'k05',
    name: 'Neon Lime',
    badge: 'K05',
    themeColor: '#84cc16',
    tags: ['blinds entrances', 'scores on top', 'floating score cards', 'photo badges on the right'],
    gradient: 'from-lime-600 via-green-500 to-emerald-800',
  },
  {
    id: 'k08',
    name: 'Broadcast Teal',
    badge: 'K08',
    themeColor: '#14b8a6',
    tags: ['curtain entrances', 'scores at the bottom', 'floating score cards', 'cut-out player photos'],
    gradient: 'from-teal-600 via-cyan-600 to-slate-900',
  },
  {
    id: 'k09',
    name: 'Retro Amber LED',
    badge: 'K09',
    themeColor: '#f59e0b',
    tags: ['flip entrances', 'scores at the bottom', 'flat score bar', 'mirrored player cards'],
    gradient: 'from-amber-700 via-orange-600 to-stone-900',
  },
  {
    id: 'k10',
    name: 'Retro Green LED',
    badge: 'K10',
    themeColor: '#22c55e',
    tags: ['unfold entrances', 'scores on top', 'slanted score bar', 'cut-out player photos'],
    gradient: 'from-green-700 via-emerald-600 to-teal-950',
  },
  {
    id: 'k11',
    name: 'Street Blaze',
    badge: 'K11',
    themeColor: '#f97316',
    tags: ['skew entrances', 'scores at the bottom', 'arrow score bar', 'mirrored player cards'],
    gradient: 'from-orange-600 via-red-500 to-amber-900',
  },
  {
    id: 'k12',
    name: 'Street Pink',
    badge: 'K12',
    themeColor: '#f43f5e',
    tags: ['pop entrances', 'scores at the bottom', 'arrow score bar', 'photo badges on the right'],
    gradient: 'from-rose-600 via-pink-500 to-purple-900',
  },
  {
    id: 'k13',
    name: 'Street Yellow',
    badge: 'K13',
    themeColor: '#eab308',
    tags: ['drop entrances', 'scores on top', 'arrow score bar', 'mirrored player cards'],
    gradient: 'from-yellow-600 via-amber-500 to-orange-900',
  },
  {
    id: 'k14',
    name: 'Royal Gold',
    badge: 'K14',
    themeColor: '#d97706',
    tags: ['fade entrances', 'scores on top', 'round photo badges', 'sweeping 4/6 banner'],
    gradient: 'from-yellow-700 via-amber-600 to-slate-900',
  },
  {
    id: 'k15',
    name: 'Royal Silver',
    badge: 'K15',
    themeColor: '#94a3b8',
    tags: ['swing entrances', 'scores at the bottom', 'notched score bar', 'round photo badges'],
    gradient: 'from-slate-600 via-gray-400 to-slate-900',
  },
  {
    id: 'k16',
    name: 'Glass Sky',
    badge: 'K16',
    themeColor: '#38bdf8',
    tags: ['blur entrances', 'scores on top', 'flat score bar', 'cut-out player photos'],
    gradient: 'from-sky-600 via-cyan-500 to-indigo-900',
  },
  {
    id: 'k17',
    name: 'Glass Rose',
    badge: 'K17',
    themeColor: '#fb7185',
    tags: ['zoom-out entrances', 'scores at the bottom', 'round photo badges', 'corner 4/6 tag'],
    gradient: 'from-rose-500 via-pink-600 to-rose-950',
  },
  {
    id: 'k18',
    name: 'Glass Mint',
    badge: 'K18',
    themeColor: '#34d399',
    tags: ['slide-right entrances', 'scores on top', 'notched score bar', 'mirrored player cards'],
    gradient: 'from-emerald-500 via-teal-400 to-emerald-950',
  },
  {
    id: 'k19',
    name: 'Carbon Red',
    badge: 'K19',
    themeColor: '#ef4444',
    tags: ['stretch entrances', 'scores at the bottom', 'slanted score bar', 'cut-out player photos'],
    gradient: 'from-red-700 via-rose-600 to-zinc-900',
  },
  {
    id: 'k20',
    name: 'Carbon Orange',
    badge: 'K20',
    themeColor: '#f97316',
    tags: ['diamond entrances', 'scores on top', 'slanted score bar', 'round photo badges'],
    gradient: 'from-orange-600 via-amber-600 to-stone-900',
  },
  {
    id: 'k21',
    name: 'Mono Gold',
    badge: 'K21',
    themeColor: '#ca8a04',
    tags: ['zoom entrances', 'scores at the bottom', 'slanted score bar', 'cut-out player photos'],
    gradient: 'from-yellow-700 via-stone-800 to-black',
  },
  {
    id: 'k22',
    name: 'Mono Ice',
    badge: 'K22',
    themeColor: '#7dd3fc',
    tags: ['spin entrances', 'scores at the bottom', 'notched score bar', 'photo badges on the right'],
    gradient: 'from-cyan-700 via-slate-800 to-blue-950',
  },
  {
    id: 'k23',
    name: 'Festival Sunset',
    badge: 'K23',
    themeColor: '#fb923c',
    tags: ['drop entrances', 'scores at the bottom', 'notched score bar', 'photo badges on the right'],
    gradient: 'from-orange-500 via-pink-600 to-purple-900',
  },
  {
    id: 'k24',
    name: 'Festival Aurora',
    badge: 'K24',
    themeColor: '#a855f7',
    tags: ['zoom entrances', 'scores on top', 'flat score bar', 'photo badges on the right'],
    gradient: 'from-purple-600 via-teal-500 to-indigo-950',
  },
  {
    id: 'k25',
    name: 'Mono Mint',
    badge: 'K25',
    themeColor: '#2dd4bf',
    tags: ['pop entrances', 'scores on top', 'notched score bar', 'round photo badges'],
    gradient: 'from-teal-600 via-emerald-700 to-zinc-950',
  },
  {
    id: 'sc-monsoon-night',
    name: 'Monsoon Night',
    badge: 'SC01',
    themeColor: '#4d7cff',
    tags: ['blur entrances', 'scores at the bottom', 'glass score bar', 'mirrored player cards'],
    gradient: 'from-indigo-700 via-blue-600 to-cyan-500',
  },
  {
    id: 'sc-desert-dusk',
    name: 'Desert Dusk',
    badge: 'SC02',
    themeColor: '#ff8a3d',
    tags: ['skew entrances', 'scores on top', 'slanted score bar', 'photo badges'],
    gradient: 'from-orange-700 via-orange-500 to-teal-500',
  },
  {
    id: 'sc-paper-scoreboard',
    name: 'Paper Scoreboard',
    badge: 'SC03',
    themeColor: '#d6432b',
    tags: ['rise entrances', 'scores at the bottom', 'flat light score bar', 'photo badges on the right'],
    gradient: 'from-stone-200 via-orange-300 to-red-600',
  },
  {
    id: 'sc-royal-maroon',
    name: 'Royal Maroon',
    badge: 'SC04',
    themeColor: '#c9a24b',
    tags: ['curtain entrances', 'scores on top', 'notched score bar', 'cut-out player photos'],
    gradient: 'from-red-950 via-rose-900 to-amber-600',
  },
  {
    id: 'sc-arctic-mint',
    name: 'Arctic Mint',
    badge: 'SC05',
    themeColor: '#5eead4',
    tags: ['fade entrances', 'scores on top', 'line score bar', 'round photo badges'],
    gradient: 'from-slate-800 via-teal-500 to-cyan-200',
  },
  {
    id: 'sc-volt-carbon',
    name: 'Volt Carbon',
    badge: 'SC06',
    themeColor: '#d4ff2a',
    tags: ['glitch entrances', 'scores at the bottom', 'arrow score bar', 'photo badges'],
    gradient: 'from-zinc-950 via-lime-400 to-pink-600',
  },
];

const broadcastLookIds = new Set(BROADCAST_LOOKS.map((look) => look.id));
export const PRO_LOOKS_CATALOG: ProLookItem[] = [
  ...BROADCAST_LOOKS,
  ...ALL_PRO_LOOKS.filter((look) => !broadcastLookIds.has(look.id)).map((look) => ({
    id: look.id,
    name: look.name,
    badge: look.id.toUpperCase(),
    themeColor: look.tokens.colors.accent ?? '#2563eb',
    tags: look.tags ?? [],
    gradient: '',
  })),
];

export const ProLooksModal = ({
  isOpen,
  open,
  onClose,
}: {
  isOpen?: boolean;
  open?: boolean;
  onClose: () => void;
}) => {
  const qc = useQueryClient();
  const origin = useServerOrigin();
  const visible = isOpen ?? open ?? false;
  const [activeLookId, setActiveLookId] = React.useState<string>('ink-gold');
  const [previewingId, setPreviewingId] = React.useState<string | null>(null);
  const [showKeyInput, setShowKeyInput] = React.useState(false);
  const [keyInput, setKeyInput] = React.useState('');
  const [isActivatingKey, setIsActivatingKey] = React.useState(false);
  const toast = useAdmin((s) => s.toast);

  const licenceQuery = useQuery({
    queryKey: ['licence'],
    queryFn: async () => {
      const res = await fetch('/api/licence');
      return res.ok
        ? ((await res.json()) as {
            licensed: boolean;
            token: string | null;
            machineId?: string;
            payload?: { channel?: string; plan?: string; exp?: number; mid?: string } | null;
            error?: string | null;
          })
        : { licensed: false, token: null };
    },
    refetchInterval: 10000,
  });
  const isLicensed = licenceQuery.data?.licensed ?? false;
  const machineId = licenceQuery.data?.machineId ?? '';

  React.useEffect(() => {
    if (!visible) return;
    fetch('/api/looks/active')
      .then((r) => r.json())
      .then((data: { id?: string }) => {
        if (data?.id) setActiveLookId(data.id);
      })
      .catch(() => undefined);
  }, [visible]);

  if (!visible) return null;

  const handleActivateLicence = async () => {
    const key = keyInput.trim();
    if (!key) {
      toast({ title: 'Please enter a licence key', kind: 'error' });
      return;
    }
    setIsActivatingKey(true);
    try {
      const res = await fetch('/api/licence', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key }),
      });
      if (res.ok) {
        toast({
          title: `Licence key activated! All ${PRO_LOOKS_CATALOG.length} Pro Looks are now unlocked.`,
          kind: 'success',
        });
        setKeyInput('');
        setShowKeyInput(false);
        void qc.invalidateQueries({ queryKey: ['licence'] });
        void qc.invalidateQueries({ queryKey: ['looks'] });
      } else {
        const d = (await res.json().catch(() => ({}))) as { error?: string; reason?: string };
        toast({
          title: d.error || 'Failed to activate licence key',
          description: d.reason === 'machine-mismatch' ? 'The key was generated for a different Machine ID.' : undefined,
          kind: 'error',
        });
      }
    } catch {
      toast({ title: 'Network error activating licence key', kind: 'error' });
    } finally {
      setIsActivatingKey(false);
    }
  };

  const openWhatsApp = (lookBadge: string) => {
    window.open(
      whatsappUrl(`Hi, I want to upgrade to Pro Look ${lookBadge} in StumpCast Studio!`),
      '_blank',
    );
  };

  const applyLook = async (lookId: string, badge?: string) => {
    // A Pro look is view-only until a licence is active. The server refuses these now; refusing
    // here too means the operator gets the key box instead of a failed request.
    if (!isLicensed) {
      setShowKeyInput(true);
      toast({
        title: 'Pro licence required',
        description: `Look ${badge || lookId.toUpperCase()} can be previewed but not selected until a licence key is active.`,
        kind: 'info',
      });
      return;
    }
    setPreviewingId(lookId);
    try {
      const res = await fetch('/api/looks/activate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: lookId }),
      });
      if (res.ok) {
        setActiveLookId(lookId);
        void qc.invalidateQueries({ queryKey: ['looks'] });
        void qc.invalidateQueries({ queryKey: ['settings'] });
        toast({
          title: `Look ${badge || lookId.toUpperCase()} activated live on stream!`,
          kind: 'success',
        });
      } else {
        const d = await res.json().catch(() => ({}));
        toast({ title: d.error || 'Failed to apply look', kind: 'error' });
      }
    } catch {
      toast({ title: 'Network error applying look', kind: 'error' });
    } finally {
      setPreviewingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[92vh] w-full max-w-6xl flex-col rounded-2xl border border-blue-200 bg-white text-slate-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex flex-col gap-3 border-b border-blue-100 p-6 pb-4 bg-slate-50">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="font-heading text-2xl font-black uppercase tracking-wider text-slate-900">
                  CHOOSE YOUR PRO LOOK
                </h2>
                {isLicensed ? (
                  <span className="rounded bg-emerald-50 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-emerald-700 border border-emerald-300">
                    PRO LICENCE ACTIVE
                  </span>
                ) : (
                  <span className="rounded bg-orange-50 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-orange-700 border border-orange-300">
                    FREE PLAN
                  </span>
                )}
              </div>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600">
                Each look has its own style, score position, player cards, animations, 4/6/wicket graphics
                and auto-producer. Seamlessly integrates with Arena + Video, Full Screen, Strip, and Classic layouts.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 border border-blue-200 hover:bg-blue-50 transition cursor-pointer shadow-sm"
            >
              Close ✕
            </button>
          </div>

          {/* Licence Status Banner */}
          {isLicensed ? (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3.5 py-2 text-xs font-medium text-emerald-800">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>
                <b>Pro Licence Verified:</b> All {PRO_LOOKS_CATALOG.length} Pro Broadcast Looks are fully unlocked and ready to activate permanently on your broadcast overlay.
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-2 rounded-lg bg-orange-50/60 border border-orange-200 p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-orange-900">
                  <span className="text-base">🔑</span>
                  <span>
                    <b>Free Plan:</b> By default you have access to the default look (Ink &amp; Gold). Pro users with a licence key unlock all {PRO_LOOKS_CATALOG.length} bespoke looks permanently on-air.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowKeyInput(!showKeyInput)}
                    className="rounded bg-orange-500 px-3 py-1 font-bold text-white hover:bg-orange-600 transition shadow-sm cursor-pointer"
                  >
                    {showKeyInput ? 'Hide Key Input' : 'Enter Licence Key'}
                  </button>
                </div>
              </div>

              {showKeyInput && (
                <div className="mt-2 space-y-2 rounded-lg bg-white p-3 border border-orange-300">
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-orange-50/70 p-2 rounded border border-orange-200 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-orange-950 uppercase text-[10px]">Your Machine ID:</span>
                      <code className="font-mono font-bold text-blue-900 bg-white px-1.5 py-0.5 rounded border border-orange-200 select-all">
                        {machineId || 'Detecting Machine ID...'}
                      </code>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (machineId) {
                          navigator.clipboard.writeText(machineId);
                          toast({ title: 'Machine ID copied to clipboard!', description: 'Send this ID to admin to get your Pro key.', kind: 'success' });
                        }
                      }}
                      className="text-[11px] font-bold text-orange-800 bg-white px-2 py-0.5 rounded border border-orange-300 hover:bg-orange-100 transition shadow-2xs"
                    >
                      📋 Copy ID
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={keyInput}
                      onChange={(e) => setKeyInput(e.target.value)}
                      placeholder="Enter Pro Licence Key (SC1.eyJ2Ijox...)"
                      className="flex-1 min-w-[200px] rounded border border-blue-200 bg-white px-3 py-1.5 font-mono text-xs text-slate-900 focus:border-orange-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={isActivatingKey || !keyInput.trim()}
                      onClick={handleActivateLicence}
                      className="rounded bg-orange-500 px-4 py-1.5 text-xs font-bold uppercase text-white hover:bg-orange-600 transition disabled:opacity-50 shadow-sm cursor-pointer"
                    >
                      {isActivatingKey ? 'Activating…' : 'Activate Licence'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Scrollable Look Grid */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PRO_LOOKS_CATALOG.map((look) => {
              // Prefer the tags carried by the look itself. The list below is the fallback for a
              // look whose JSON has not been regenerated, and it has already been caught claiming
              // a "flat score bar" for a look that declares `glass`.
              const tags = getLook(look.id)?.tags ?? look.tags;
              const isActive = activeLookId === look.id;
              const isApplying = previewingId === look.id;

              return (
                <div
                  key={look.id}
                  className={`group flex flex-col rounded-xl border p-3 transition shadow-sm ${
                    isActive
                      ? 'border-2 border-orange-500 bg-orange-50/50 shadow-md ring-1 ring-orange-400'
                      : 'border-blue-200 bg-white hover:border-blue-400 hover:shadow-md'
                  }`}
                >
                  {/* A real render of the look: the same overlay OBS loads, scaled into the card.
                      The old hand-drawn thumbnail was a second source of truth and it drifted —
                      it showed shapes the look never actually rendered. */}
                  <div className="relative">
                    <LookPreview
                      id={look.id}
                      origin={origin}
                      className="rounded-lg border border-blue-200"
                    />
                    {isActive && isLicensed && (
                      <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded bg-emerald-500 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-black shadow">
                        <span className="size-1.5 rounded-full bg-black animate-ping" />
                        ON AIR
                      </span>
                    )}
                    {!isLicensed && (
                      // The render stays: seeing the look is the advertisement. Selecting it is not.
                      <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-slate-900/45">
                        <span className="rounded-full bg-slate-900/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                          🔒 Pro · view only
                        </span>
                      </span>
                    )}
                  </div>

                  {/* Title & Tags */}
                  <div className="mt-3 flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-heading text-base font-bold text-slate-900 group-hover:text-blue-600 transition">
                        {look.name}
                      </h3>
                      <span
                        className="size-3 rounded-full border border-slate-300"
                        style={{ backgroundColor: look.themeColor }}
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-900 border border-blue-200"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-4 flex flex-col gap-1.5">
                    {isLicensed ? (
                      <button
                        type="button"
                        disabled={isApplying}
                        onClick={() => applyLook(look.id, look.badge)}
                        className={`w-full rounded-lg py-1.5 text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                          isActive
                            ? 'bg-orange-500 text-white shadow-sm cursor-default'
                            : 'bg-orange-500 text-white hover:bg-orange-600 shadow-sm'
                        }`}
                      >
                        {isActive ? '✓ Active on Stream' : isApplying ? 'Applying...' : '⚡ Activate on Stream'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled
                        title="A Pro licence is required to select this look"
                        className="w-full cursor-not-allowed rounded-lg border border-slate-300 bg-slate-100 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-500"
                      >
                        🔒 Unlock to select
                      </button>
                    )}
                    {!isLicensed && (
                      <button
                        type="button"
                        onClick={() => openWhatsApp(look.badge)}
                        className="w-full rounded-lg bg-emerald-600 py-1.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-emerald-500 transition shadow-sm cursor-pointer"
                      >
                        Choose {look.badge} on WhatsApp
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
