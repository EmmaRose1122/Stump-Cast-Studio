import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getLook } from '@stumpcast/shared';
import { useAdmin } from '../store';

export interface ProLookItem {
  id: string;
  name: string;
  badge: string;
  themeColor: string;
  tags: string[];
  gradient: string;
}

export const PRO_LOOKS_CATALOG: ProLookItem[] = [
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
    id: 'k15',
    name: 'Orange & Blue Broadcast',
    badge: 'K15',
    themeColor: '#f97316',
    tags: ['slide entrances', 'scores on top', 'flat score bar', 'mirrored player cards'],
    gradient: 'from-orange-600 via-amber-500 to-blue-600',
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

interface ProLookMiniPreviewProps {
  lookItem: ProLookItem;
  isActive: boolean;
}

export const ProLookMiniPreview: React.FC<ProLookMiniPreviewProps> = ({ lookItem, isActive }) => {
  const lookDef = getLook(lookItem.id);
  const accent = lookDef?.tokens.colors.accent ?? lookItem.themeColor;
  const accent2 = lookDef?.tokens.colors.accent2 ?? '#d97706';
  const surface = lookDef?.tokens.colors.surface ?? '#0f172a';
  const scoreShape = lookDef?.tokens.scoreBarShape ?? 'pill';
  const scorePos =
    lookDef?.layoutVariant?.scorePosition ??
    (lookItem.tags.some((t) => t.includes('bottom')) ? 'bottom' : 'top');
  const gradient =
    lookDef?.tokens.gradients?.accent ?? `linear-gradient(90deg, ${accent}, ${accent2})`;

  const barShapeStyle: React.CSSProperties = {
    background: surface,
    border: `1.5px solid ${accent}`,
    boxShadow: `0 4px 14px rgba(0,0,0,0.85), 0 0 12px ${accent}40`,
  };

  let barShapeClass = 'rounded-md';
  if (scoreShape === 'pill') {
    barShapeClass = 'rounded-full px-3';
  } else if (scoreShape === 'arrow') {
    barShapeClass = 'rounded-none pr-4';
    barShapeStyle.clipPath =
      'polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%)';
  } else if (scoreShape === 'slanted') {
    barShapeClass = 'rounded-none pr-3';
    barShapeStyle.clipPath = 'polygon(0 0, 100% 0, calc(100% - 12px) 100%, 0 100%)';
  } else if (scoreShape === 'notched') {
    barShapeClass = 'rounded-none';
    barShapeStyle.clipPath = 'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)';
  } else if (scoreShape === 'floating') {
    barShapeClass = 'rounded-lg';
    barShapeStyle.boxShadow = `0 8px 20px rgba(0,0,0,0.85), 0 0 14px ${accent}66`;
    barShapeStyle.border = `1.5px solid ${accent}`;
  } else if (scoreShape === 'glass') {
    barShapeClass = 'rounded-lg backdrop-blur-md';
    barShapeStyle.background = `${surface}cc`;
    barShapeStyle.border = '1.5px solid rgba(255,255,255,0.35)';
  } else if (scoreShape === 'flat') {
    barShapeClass = 'rounded-none border-l-4';
    barShapeStyle.borderLeftColor = accent;
  }

  const renderScoreBar = () => (
    <div
      className={`relative z-20 flex items-center justify-between py-1 px-2.5 transition-all text-[10px] w-full ${barShapeClass}`}
      style={barShapeStyle}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <span
          className="flex size-4.5 shrink-0 items-center justify-center rounded-sm text-[8px] font-black text-white font-mono shadow-sm border border-white/30"
          style={{ background: gradient }}
        >
          MUM
        </span>
        <span className="font-heading font-black tracking-wider text-white text-[10px] truncate">MUMBAI</span>
        <span
          className="font-mono font-black text-[12px] tracking-tight ml-0.5"
          style={{ color: accent }}
        >
          187-7
        </span>
        <span className="rounded bg-black/60 px-1 py-0.2 text-[8px] font-bold text-emerald-300 font-mono">
          40.5 OV
        </span>
      </div>

      <div className="flex items-center gap-1 text-[8px] font-semibold text-slate-300">
        <span className="text-amber-400 font-black">YET TO BAT</span>
        <span className="flex size-4.5 shrink-0 items-center justify-center rounded-sm text-[7px] font-black text-white bg-red-700 border border-white/30 ml-0.5">
          OMN
        </span>
      </div>

      <div className="flex items-center gap-1">
        <span className="size-1.5 rounded-full bg-red-500 animate-pulse" />
        <span className="text-[8px] font-black uppercase tracking-wider text-red-400 font-heading">LIVE</span>
      </div>
    </div>
  );

  const renderPlayerStrip = () => (
    <div className="relative z-20 flex items-center justify-between gap-1 text-[8px] w-full px-1">
      {/* Striker */}
      <div
        className="flex items-center gap-1.5 rounded bg-black/90 px-1.5 py-0.5 border shadow-md flex-1 min-w-0"
        style={{ borderColor: `${accent}70` }}
      >
        <div
          className="size-5 rounded-full border flex items-center justify-center text-[7px] font-black text-white shrink-0 shadow"
          style={{ borderColor: accent, background: gradient }}
        >
          VG
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-white truncate text-[8px]">V. GORE*</div>
          <div className="font-mono font-black text-[9px] leading-tight" style={{ color: accent }}>
            14 (18)
          </div>
        </div>
      </div>

      {/* Bowler */}
      <div
        className="flex items-center gap-1.5 rounded bg-black/90 px-1.5 py-0.5 border shadow-md flex-1 min-w-0"
        style={{ borderColor: `${accent2}70` }}
      >
        <div
          className="size-5 rounded-full border flex items-center justify-center text-[7px] font-black text-white shrink-0 shadow bg-slate-800"
          style={{ borderColor: accent2 }}
        >
          AK
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-white truncate text-[8px]">A.K. KHAN</div>
          <div className="font-mono font-black text-[9px] leading-tight text-emerald-400">
            2-26 (6.0)
          </div>
        </div>
      </div>

      {/* Non-Striker */}
      <div className="hidden xs:flex items-center gap-1.5 rounded bg-black/90 px-1.5 py-0.5 border shadow-md flex-1 min-w-0 border-white/20">
        <div className="size-5 rounded-full border border-white/30 flex items-center justify-center text-[7px] font-black text-white shrink-0 bg-slate-800">
          KS
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-slate-200 truncate text-[8px]">K. SHAJI</div>
          <div className="font-mono font-bold text-[9px] text-slate-300 leading-tight">
            18 (41)
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="relative flex h-52 w-full flex-col justify-between overflow-hidden rounded-xl border border-white/10 group-hover:border-cyan-400/50 transition-all duration-300 select-none bg-[#020b08] p-2"
      style={{
        backgroundImage: `
          radial-gradient(ellipse at 50% 60%, rgba(13, 76, 42, 0.45) 0%, rgba(2, 11, 8, 0.95) 75%),
          linear-gradient(180deg, rgba(10, 14, 23, 0.9) 0%, rgba(5, 8, 16, 0.6) 50%, rgba(10, 14, 23, 0.9) 100%)
        `,
      }}
    >
      {/* Background cricket pitch markings & floodlights */}
      <div className="absolute inset-0 pointer-events-none opacity-25">
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-48 h-12 rounded-full border border-emerald-400/40" />
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-32 h-6 border-b border-white/30" />
      </div>

      {/* Top Section */}
      {scorePos === 'top' ? renderScoreBar() : renderPlayerStrip()}

      {/* Center Simulated Match Video Frame */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[58%] h-[56%] rounded-lg overflow-hidden border shadow-xl flex items-center justify-center"
        style={{
          borderColor: accent,
          boxShadow: `0 0 16px ${accent}40, 0 8px 24px rgba(0,0,0,0.85)`,
          background: 'linear-gradient(135deg, #021a10 0%, #064e3b 40%, #022c22 100%)',
        }}
      >
        {/* Pitch lines & floodlight glow */}
        <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_50%_40%,rgba(255,255,255,0.4)_0%,transparent_60%)]" />
        <div className="absolute bottom-1 w-24 h-6 border-t border-white/40 rounded-t-full" />
        <div className="absolute top-1 right-1 px-1 py-0.2 rounded bg-black/80 text-[6px] font-mono text-cyan-300 border border-cyan-500/30">
          CAM 1
        </div>
        <div className="absolute top-1 left-1 flex items-center gap-0.5 rounded bg-black/85 px-1 py-0.2 text-[6px] font-bold text-white border border-white/20">
          <span className="size-1 rounded-full bg-red-500 animate-pulse" />
          <span className="text-red-400 font-black">LIVE</span>
          <span className="text-[5px] text-slate-300 ml-0.5">MUM v OMN</span>
        </div>
        <div className="text-[7px] font-heading font-black tracking-widest text-white/50 uppercase">
          STUMPCAST LIVE
        </div>
      </div>

      {/* Left Rail: This Ball & Quick Stats */}
      <div className="absolute left-1.5 top-1/2 -translate-y-1/2 flex flex-col gap-1 w-[20%] z-10 pointer-events-none">
        <div className="rounded bg-black/85 p-1 border border-white/15 text-center shadow-md">
          <div className="text-[6px] font-bold uppercase tracking-wider text-amber-400">THIS BALL</div>
          <div className="font-mono font-black text-[13px] leading-tight" style={{ color: accent }}>
            1
          </div>
          <div className="text-[6px] font-bold text-slate-300">RUN</div>
          <div className="mt-0.5 flex justify-center gap-0.5">
            {['0', '1', '4', '1', '0', '1'].map((b, i) => (
              <span
                key={i}
                className={`size-2.5 rounded-full flex items-center justify-center font-mono text-[5px] font-bold ${
                  b === '4' ? 'bg-amber-400 text-black' : 'bg-white/20 text-white'
                }`}
              >
                {b}
              </span>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-0.5">
          <div className="bg-black/80 rounded p-0.5 border border-white/10 text-center">
            <div className="text-[5px] text-slate-400 font-bold">CRR</div>
            <div className="text-[7px] font-mono font-black text-white">4.62</div>
          </div>
          <div className="bg-black/80 rounded p-0.5 border border-white/10 text-center">
            <div className="text-[5px] text-slate-400 font-bold">P'SHIP</div>
            <div className="text-[7px] font-mono font-black" style={{ color: accent }}>
              26(48)
            </div>
          </div>
        </div>
      </div>

      {/* Right Rail: Match Centre & Win Prob */}
      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex flex-col gap-1 w-[20%] z-10 pointer-events-none">
        <div className="rounded bg-black/85 p-1 border border-white/15 shadow-md text-left">
          <div className="text-[6px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-0.5">
            <span className="size-1 rounded-full bg-emerald-400" /> CENTRE
          </div>
          <div className="mt-0.5 text-[6px] font-bold text-white truncate">Oman vs Mum</div>
          <div className="text-[5px] text-slate-400">Yet to bat</div>
          <div className="mt-1 flex items-center justify-between text-[6px] font-mono">
            <span className="text-emerald-400 font-bold">MUM 68%</span>
            <span className="text-amber-400 font-bold">32%</span>
          </div>
          <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden flex mt-0.5">
            <div className="h-full bg-emerald-500 w-[68%]" />
            <div className="h-full bg-amber-500 w-[32%]" />
          </div>
        </div>
        <div className="h-5 rounded bg-slate-900/90 border border-cyan-500/40 flex items-center justify-center text-[6px] font-mono text-cyan-400 shadow">
          STREAMER
        </div>
      </div>

      {/* Bottom Section */}
      {scorePos === 'bottom' ? renderScoreBar() : renderPlayerStrip()}

      {/* Badge Pill in corner */}
      <div className="absolute top-2 left-2 z-30 flex items-center gap-1 pointer-events-none">
        <span
          className="rounded bg-black/90 px-1.5 py-0.5 font-mono text-[9px] font-black tracking-wider text-white border shadow"
          style={{ borderColor: `${accent}` }}
        >
          {lookItem.badge}
        </span>
        {isActive && (
          <span className="flex items-center gap-1 rounded bg-emerald-500 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-black shadow">
            <span className="size-1.5 rounded-full bg-black animate-ping" />
            ON AIR
          </span>
        )}
      </div>
    </div>
  );
};

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
        ? ((await res.json()) as { licensed: boolean; token: string | null })
        : { licensed: false, token: null };
    },
    refetchInterval: 10000,
  });
  const isLicensed = licenceQuery.data?.licensed ?? false;

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
          title: 'Licence key activated! All 29 Pro Looks are now unlocked.',
          kind: 'success',
        });
        setKeyInput('');
        setShowKeyInput(false);
        void qc.invalidateQueries({ queryKey: ['licence'] });
        void qc.invalidateQueries({ queryKey: ['looks'] });
      } else {
        const d = await res.json().catch(() => ({}));
        toast({ title: d.error || 'Failed to activate licence key', kind: 'error' });
      }
    } catch {
      toast({ title: 'Network error activating licence key', kind: 'error' });
    } finally {
      setIsActivatingKey(false);
    }
  };

  const openWhatsApp = (lookBadge: string) => {
    const text = encodeURIComponent(
      `Hi, I want to upgrade to Pro Look ${lookBadge} in StumpCast Studio!`,
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const applyLook = async (lookId: string, badge?: string) => {
    setPreviewingId(lookId);
    try {
      const res = await fetch('/api/looks/activate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: lookId, preview: !isLicensed }),
      });
      if (res.ok) {
        setActiveLookId(lookId);
        void qc.invalidateQueries({ queryKey: ['looks'] });
        void qc.invalidateQueries({ queryKey: ['settings'] });
        toast({
          title: isLicensed
            ? `Look ${badge || lookId.toUpperCase()} activated live on stream!`
            : `Look ${badge || lookId.toUpperCase()} preview activated on stream!`,
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
                <b>Pro Licence Verified:</b> All 29 Pro Broadcast Looks are fully unlocked and ready to activate permanently on your broadcast overlay.
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-2 rounded-lg bg-orange-50/60 border border-orange-200 p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-orange-900">
                  <span className="text-base">🔑</span>
                  <span>
                    <b>Free Plan:</b> By default you have access to the default look (Ink &amp; Gold). Pro users with a licence key unlock all 29 bespoke looks permanently on-air.
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
                <div className="mt-1 flex flex-wrap items-center gap-2 rounded-lg bg-white p-2 border border-orange-300">
                  <input
                    type="text"
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    placeholder="Enter Pro Licence Key (e.g. SC-PRO-XXXX-XXXX)"
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
              )}
            </div>
          )}
        </div>

        {/* Scrollable Look Grid */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PRO_LOOKS_CATALOG.map((look) => {
              const _isScoreBottom = look.tags.some((t) => t.includes('scores at the bottom'));
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
                  {/* Authentic Broadcast Pro Look Mini Preview */}
                  <ProLookMiniPreview lookItem={look} isActive={isActive} />

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
                      {look.tags.map((tag) => (
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
                    <button
                      type="button"
                      disabled={isApplying}
                      onClick={() => applyLook(look.id, look.badge)}
                      className={`w-full rounded-lg py-1.5 text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                        isActive
                          ? 'bg-orange-500 text-white shadow-sm cursor-default'
                          : isLicensed
                            ? 'bg-orange-500 text-white hover:bg-orange-600 shadow-sm'
                            : 'bg-white text-blue-900 hover:bg-blue-50 border border-blue-300'
                      }`}
                    >
                      {isActive
                        ? '✓ Active on Stream'
                        : isApplying
                          ? 'Applying...'
                          : isLicensed
                            ? '⚡ Activate on Stream'
                            : '⚡ Preview on Stream'}
                    </button>
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
