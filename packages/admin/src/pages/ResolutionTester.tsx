import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { ProLooksModal } from '../shell/ProLooksModal';

export const ResolutionTester = ({ onClose, matchId }: { onClose?: () => void; matchId?: string }) => {
  const qc = useQueryClient();
  const [mode, setMode] = useState<'fit' | 'actual'>('fit');
  const [reload, setReload] = useState(0);
  const [commMute, setCommMute] = useState(false);
  const [showProLooks, setShowProLooks] = useState(false);
  const settings = useQuery({ queryKey: ['settings'], queryFn: api.settings });
  const currentLayout = settings.data?.layout ?? 'arena';
  const onStreamMatchId = settings.data?.onStreamMatchId;
  const effectiveMatchId = matchId ?? onStreamMatchId;

  const saveSettings = useMutation({
    mutationFn: api.saveSettings,
    onSuccess: (saved) => qc.setQueryData(['settings'], saved),
  });

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      window.history.back();
    }
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const overlayBase = window.location.port === '5175' ? 'http://127.0.0.1:5174/' : `${window.location.origin}/overlay/`;
  const overlayUrl = effectiveMatchId
    ? `${overlayBase}?match=${encodeURIComponent(effectiveMatchId)}&layout=${currentLayout}&preview=1&resolution=1&reload=${reload}${commMute ? '&commMute=1' : ''}`
    : `${overlayBase}?fixture=test&layout=${currentLayout}&preview=1&resolution=1&reload=${reload}${commMute ? '&commMute=1' : ''}`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-100 text-slate-800">
      {/* Broadcast Tester Header */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-200 bg-white px-6 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-xl">🖥️</span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-heading text-lg font-extrabold uppercase tracking-wider text-slate-900">
                1920×1080 OBS Broadcast Resolution Tester
              </h1>
              <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-blue-800 border border-blue-200">
                FULL HD 16:9
              </span>
            </div>
            <p className="font-mono text-xs text-slate-500">
              Inspect exact 1080p TV broadcast scale, giant Teko typography, and real-time layout &amp; themes.
            </p>
          </div>
        </div>

        {/* Live Layout Switcher in Header */}
        <div className="flex items-center gap-1 rounded-lg border border-blue-200 bg-slate-50 p-1">
          {[
            { id: 'arena', label: 'ARENA + VIDEO' },
            { id: 'fullscreen', label: 'FULL SCREEN' },
            { id: 'ticker', label: 'TV STRIP' },
            { id: 'classic', label: 'CLASSIC' },
          ].map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => {
                if (settings.data) {
                  saveSettings.mutate({ ...settings.data, layout: l.id as typeof currentLayout });
                }
              }}
              className={`rounded px-2.5 py-1 text-[11px] font-bold uppercase transition cursor-pointer ${
                currentLayout === l.id
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>

        {/* Side Cards Scale Customizer in Header for Arena & Fullscreen */}
        {(currentLayout === 'arena' || currentLayout === 'fullscreen') && (
          <div className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-slate-50 px-2.5 py-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600">
              SIDE CARDS:
            </span>
            {[
              { scale: 0.85, label: '0.85x' },
              { scale: 1.0, label: '1.0x' },
              { scale: 1.15, label: '1.15x' },
              { scale: 1.3, label: '1.3x' },
              { scale: 1.5, label: '1.5x (Large)' },
            ].map((p) => {
              const active = Math.abs((settings.data?.sideCardScale ?? 1) - p.scale) < 0.04;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    if (settings.data) {
                      saveSettings.mutate({ ...settings.data, sideCardScale: p.scale });
                    }
                  }}
                  className={`rounded px-2 py-0.5 text-[10px] font-bold transition cursor-pointer ${
                    active
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setMode('fit')}
            className={`rounded px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
              mode === 'fit'
                ? 'bg-orange-500 text-white shadow-sm'
                : 'bg-white text-slate-700 hover:bg-blue-50 border border-blue-200'
            }`}
          >
            Fit 16:9 Screen
          </button>
          <button
            type="button"
            onClick={() => setMode('actual')}
            className={`rounded px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
              mode === 'actual'
                ? 'bg-orange-500 text-white shadow-sm'
                : 'bg-white text-slate-700 hover:bg-blue-50 border border-blue-200'
            }`}
          >
            100% (1:1 1080P)
          </button>
          <button
            type="button"
            onClick={() => setCommMute(!commMute)}
            className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
              commMute
                ? 'bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100'
            }`}
            title={commMute ? 'Commentary audio is muted in preview window' : 'Commentary audio is active in preview window'}
          >
            <span>{commMute ? '🔇' : '🎙️'}</span>
            <span>{commMute ? 'Commentary: Muted' : 'Commentary: Active'}</span>
          </button>
          <button
            type="button"
            onClick={() => setReload((v) => v + 1)}
            className="flex items-center gap-1.5 rounded bg-white px-3 py-1.5 text-xs font-medium text-slate-700 border border-blue-200 hover:bg-blue-50 transition cursor-pointer"
          >
            <span>🔄</span> Reload
          </button>
          <button
            type="button"
            onClick={() => setShowProLooks(true)}
            className="flex items-center gap-1.5 rounded bg-orange-500 px-3.5 py-1.5 text-xs font-black uppercase tracking-wider text-white hover:bg-orange-600 transition shadow-sm cursor-pointer"
          >
            <span>✨</span> PRO LOOKS
          </button>
          <button
            type="button"
            onClick={() =>
              window.open(
                '/overlay/',
                'DedicatedOverlay',
                'popup=yes,width=1920,height=1080,menubar=no,toolbar=no',
              )
            }
            className="flex items-center gap-1.5 rounded bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-900 border border-blue-200 hover:bg-blue-100 transition cursor-pointer"
          >
            <span>🗗</span> Dedicated Window
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="flex items-center gap-1 rounded bg-rose-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-rose-500 transition shadow-sm cursor-pointer"
          >
            <span>✖</span> Close (Esc)
          </button>
        </div>
      </header>

      {/* Main Preview Canvas Frame */}
      <main
        className={`flex flex-1 items-center justify-center p-4 ${
          mode === 'actual' ? 'overflow-auto' : 'overflow-hidden'
        }`}
      >
        <div
          className={`relative border-2 border-blue-300 shadow-2xl rounded-lg overflow-hidden bg-black ${
            mode === 'actual'
              ? 'h-[1080px] w-[1920px] shrink-0'
              : 'aspect-video w-full max-w-[min(100%,calc((100dvh-120px)*16/9))]'
          }`}
          style={mode === 'fit' ? { maxHeight: 'calc(100dvh - 120px)' } : undefined}
        >
          <iframe
            key={reload}
            title="1920x1080 OBS Live Broadcast Preview"
            src={overlayUrl}
            className="h-full w-full border-0"
            allow="autoplay"
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="flex items-center justify-between border-t border-blue-200 bg-white px-6 py-2 text-xs font-mono text-slate-600">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>
            OBS Studio Canvas: 1920 × 1080 px | Aspect Ratio: 16:9 | Target: YouTube Live 1080p60
          </span>
        </div>
        <div>Press Esc anytime to exit</div>
      </footer>
      <ProLooksModal open={showProLooks} onClose={() => setShowProLooks(false)} />
    </div>
  );
};