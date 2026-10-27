import { useCallback, useEffect, useRef, useState } from 'react';
import { APP_VERSION } from '@stumpcast/shared';

export interface UpdateInfo {
  currentVersion?: string;
  latestVersion: string;
  releaseNotes?: string;
  downloadUrl?: string;
  releaseUrl?: string;
}

interface DesktopBridge {
  downloadUpdate?: (url?: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  installUpdate?: () => Promise<boolean>;
  onUpdateProgress?: (
    cb: (p: {
      percent: number;
      transferred: number;
      total: number;
      bytesPerSecond: number;
      status: string;
      error?: string | null;
    }) => void,
  ) => () => void;
}

const bridge = (): DesktopBridge | undefined =>
  (window as unknown as { stumpcast?: DesktopBridge }).stumpcast;

/**
 * Shown instead of the studio whenever the update check finds a newer release. There is no close
 * button and the app tree is not rendered underneath: the only ways out are installing the update
 * or downloading it by hand. The check fails open (no answer = no gate), so a venue without
 * internet is never locked out of a broadcast by a network problem.
 */
export const UpdateRequired = ({ info }: { info: UpdateInfo }) => {
  const [percent, setPercent] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'downloading' | 'installing' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const unsubscribe = useRef<null | (() => void)>(null);

  useEffect(() => () => unsubscribe.current?.(), []);

  const install = useCallback(async () => {
    const api = bridge();
    if (!api?.installUpdate) return;
    setPhase('installing');
    try {
      await api.installUpdate();
    } catch (e) {
      setPhase('error');
      setError(String(e));
    }
  }, []);

  const download = useCallback(async () => {
    const api = bridge();
    setError(null);
    if (!api?.downloadUpdate) {
      // Browser build: let the OS/browser take the installer.
      window.open(info.downloadUrl || info.releaseUrl || '', '_blank');
      return;
    }
    setPhase('downloading');
    setPercent(0);
    unsubscribe.current?.();
    unsubscribe.current =
      api.onUpdateProgress?.((p) => {
        setPercent(Math.min(100, Math.round(p.percent)));
        if (p.status === 'ready' || p.percent >= 100) {
          void install();
        } else if (p.status === 'error') {
          setPhase('error');
          setError(p.error ?? 'The download failed.');
        }
      }) ?? null;
    try {
      const res = await api.downloadUpdate(info.downloadUrl);
      if (res.success) {
        setPercent(100);
        void install();
      } else {
        setPhase('error');
        setError(res.error ?? 'The download failed.');
      }
    } catch (e) {
      setPhase('error');
      setError(String(e));
    }
  }, [info.downloadUrl, info.releaseUrl, install]);

  const current = info.currentVersion || APP_VERSION;
  const busy = phase === 'downloading' || phase === 'installing';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0b101b] p-4 text-slate-100">
      <div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-[#0f172a] p-7 shadow-2xl">
        <div className="mb-1 text-[11px] font-extrabold tracking-[0.22em] text-orange-400">
          STUMPCAST STUDIO
        </div>
        <h1 className="font-heading text-2xl font-bold text-white">Update required</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          A new version is out.{' '}
          <span className="font-semibold text-white">
            v{current} → v{info.latestVersion}
          </span>
          . The studio stays closed until this machine is on the new version, so nothing is
          broadcast on an old engine.
        </p>

        {info.releaseNotes && (
          <div className="mt-4 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg border border-slate-700 bg-[#0b101b] p-3 text-[13px] leading-relaxed text-slate-300">
            {info.releaseNotes}
          </div>
        )}

        {phase === 'downloading' && (
          <div className="mt-5">
            <div className="mb-1 flex justify-between text-xs text-slate-400">
              <span>Downloading v{info.latestVersion}…</span>
              <span>{percent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-orange-500 transition-[width] duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )}
        {phase === 'installing' && (
          <p className="mt-5 text-sm font-semibold text-emerald-400">
            Download complete — installing and restarting…
          </p>
        )}
        {phase === 'error' && (
          <div className="mt-5 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">
            <p className="font-semibold">Update could not be installed automatically.</p>
            {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
            <p className="mt-1 text-xs text-red-300">
              Download the installer and run it — the studio unlocks as soon as the new version
              starts.
            </p>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void download()}
            disabled={busy}
            className="rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-extrabold uppercase tracking-wide text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? 'Updating…' : `Update to v${info.latestVersion}`}
          </button>
          <a
            href={info.releaseUrl || info.downloadUrl || '#'}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-semibold text-slate-300 underline decoration-slate-600 underline-offset-4 hover:text-white"
          >
            Download installer manually
          </a>
        </div>
        <p className="mt-4 text-[11px] text-slate-500">
          The installer keeps your matches, players, licence and settings.
        </p>
      </div>
    </div>
  );
};
