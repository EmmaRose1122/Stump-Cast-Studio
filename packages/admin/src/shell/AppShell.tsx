import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ALL_PRO_LOOKS, whatsappUrl } from '@stumpcast/shared';
import clsx from 'clsx';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, useServerOrigin } from '../lib/api';
import { ROUTES, navigate } from '../lib/router';
import { deriveChips, type Chip, type ChipState } from '../lib/status';
import { useAdmin } from '../store';
import { Banner, Button, Dialog, IconButton, Tooltip } from '../ui';
import { ProLooksModal } from './ProLooksModal';
import { ResolutionTester } from '../pages/ResolutionTester';
import { StumpCastIcon } from './StumpCastIcon';

const ICONS: Record<string, string> = {
  '/live': 'M5 3l14 9-14 9z',
  '/graphics': 'M3 4h8v8H3zM13 4h8v5h-8zM13 11h8v9h-8zM3 14h8v6H3z',
  '/video': 'M3 6h13v12H3zM16 10l5-3v10l-5-3z',
  '/sounds': 'M4 9v6h4l5 4V5L8 9zM16 8a5 5 0 010 8',
  '/players': 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0',
  '/settings': 'M12 8a4 4 0 100 8 4 4 0 000-8zM3 12h3M18 12h3M12 3v3M12 18v3',
  '/help': 'M12 21a9 9 0 100-18 9 9 0 000 18zM9.5 9a2.5 2.5 0 115 0c0 1.5-2.5 2-2.5 4M12 17h.01',
};

export const Icon = ({ path, className }: { path: string; className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    className={className}
  >
    <path d={path} />
  </svg>
);

const DOT: Record<ChipState, string> = {
  ok: 'bg-emerald-400',
  warn: 'bg-amber-400',
  error: 'bg-rose-500',
  neutral: 'bg-slate-400',
};

export const StatusChip = ({ chip }: { chip: Chip }) => (
  <div
    className="flex min-w-0 items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-1 text-xs shadow-xs"
    data-state={chip.state}
    data-chip={chip.id}
  >
    <span className={clsx('size-2 shrink-0 rounded-full', DOT[chip.state])} aria-hidden />
    <span className="text-blue-900 font-medium">{chip.label}:</span>
    <span className="truncate font-bold text-slate-800" title={chip.value}>
      {chip.value}
    </span>
    <span className="sr-only">{`status ${chip.state}`}</span>
  </div>
);

export const OnAirIndicator = ({ card }: { card: string | null }) => {
  const { t } = useTranslation();
  const live = card !== null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={clsx(
        'rounded-md px-3 py-1 font-heading text-xs font-bold tracking-widest',
        live ? 'onair-live bg-rose-600 text-white' : 'border border-[#1e2a3a] text-slate-400',
      )}
    >
      {live ? `${t('status.onAir')} · ${card}` : t('status.offAir')}
    </div>
  );
};

export const AlarmBanner = () => {
  const { t } = useTranslation();
  const alarm = useAdmin((s) => s.alarm);
  const setAlarm = useAdmin((s) => s.setAlarm);
  if (!alarm || alarm.level === 'ok') return null;

  const toggle = async () => {
    setAlarm(alarm.muted ? await api.unmuteAlarm() : await api.muteAlarm(15));
  };
  return (
    <Banner
      tone={alarm.level === 'error' ? 'error' : 'warn'}
      title={alarm.level === 'error' ? 'Live data problem' : 'Live data warning'}
      actions={
        <Button variant="secondary" onClick={() => void toggle()}>
          {alarm.muted ? t('alarm.unmute') : t('alarm.mute')}
        </Button>
      }
    >
      {alarm.message}
      {alarm.muted ? ` (${t('alarm.muted')})` : ''}
    </Banner>
  );
};

export const formatBytes = (bytes: number): string => {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

export const AppShell = ({ route, children }: { route: string; children: React.ReactNode }) => {
  const { t } = useTranslation();

  const theme = useAdmin((s) => s.theme);
  const setTheme = useAdmin((s) => s.setTheme);
  const alarm = useAdmin((s) => s.alarm);
  const onAir = useAdmin((s) => s.onAirCard);
  const toast = useAdmin((s) => s.toast);
  const qc = useQueryClient();

  const [proModalOpen, setProModalOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewMatchId, setPreviewMatchId] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [licenceOpen, setLicenceOpen] = useState(false);
  const [licenceInput, setLicenceInput] = useState('');
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [updateProgress, setUpdateProgress] = useState<{
    percent: number;
    transferred: number;
    total: number;
    bytesPerSecond: number;
    status: string;
    error?: string | null;
  } | null>(null);

  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopProgressPolling = useCallback(() => {
    if (progressTimer.current !== null) {
      clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
  }, []);
  // The 150 ms progress poll used to outlive the download, the dialog and the component.
  useEffect(() => {
    if (!updateModalOpen) stopProgressPolling();
  }, [updateModalOpen, stopProgressPolling]);
  useEffect(() => () => stopProgressPolling(), [stopProgressPolling]);

  const provider = useQuery({
    queryKey: ['provider'],
    queryFn: api.providerStatus,
    refetchInterval: 3000,
  });
  const obs = useQuery({ queryKey: ['obs-status'], queryFn: api.obsStatus, refetchInterval: 5000 });
  const matches = useQuery({ queryKey: ['matches'], queryFn: api.matches, refetchInterval: 3000 });
  const settings = useQuery({ queryKey: ['settings'], queryFn: api.settings });
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

  // The version the engine is actually running. The header chip used to print a literal "v1.0.7"
  // regardless of the build, which is why an app on 1.0.9 told the operator it was on 1.0.7.
  const versionQuery = useQuery({
    queryKey: ['app-version'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/app/version');
        if (res.ok) {
          const body = (await res.json()) as { currentVersion?: string };
          if (body.currentVersion) return body.currentVersion;
        }
      } catch {
        /* offline; fall back to the update check below */
      }
      return '1.1.0';
    },
    staleTime: 60_000,
  });

  const updateQuery = useQuery({
    queryKey: ['app-update'],
    queryFn: async () => {
      if (
        typeof window !== 'undefined' &&
        (window as unknown as { stumpcast?: { checkUpdate?: () => Promise<{ updateAvailable: boolean; latestVersion?: string; version?: string; releaseNotes?: string; downloadUrl?: string }> } }).stumpcast?.checkUpdate
      ) {
        try {
          const res = await (window as unknown as { stumpcast: { checkUpdate: () => Promise<{ updateAvailable: boolean; latestVersion?: string; version?: string; currentVersion?: string; releaseNotes?: string; downloadUrl?: string }> } }).stumpcast.checkUpdate();
          if (res?.updateAvailable) {
            return {
              updateAvailable: true,
              latestVersion: res.latestVersion ?? res.version ?? '1.1.0',
              currentVersion: res.currentVersion ?? '1.1.0',
              releaseNotes:
                res.releaseNotes ||
                '• Direct In-App Desktop Updater with live transfer progress bar\n• Fast Cricbuzz & Crex match state scrapers\n• Red, White & Blue studio broadcast overlays\n• Center-aligned operator control room layout',
              downloadUrl: res.downloadUrl ?? '',
            };
          }
        } catch {
          // ignore
        }
      }
      try {
        const clientVer = versionQuery.data || (typeof window !== 'undefined' && (window as unknown as { stumpcast?: { version?: string } }).stumpcast?.version) || '';
        const url = clientVer ? `/api/app/update-check?current=${encodeURIComponent(clientVer)}` : '/api/app/update-check';
        const res = await fetch(url);
        if (res.ok) {
          const data = (await res.json()) as {
            updateAvailable: boolean;
            latestVersion: string;
            currentVersion: string;
            releaseNotes: string;
            downloadUrl: string;
          };
          const cur = clientVer || data.currentVersion || '1.1.0';
          const isNewer = (lat: string, curVer: string) => {
            const pa = lat.replace(/^v/, '').split('.').map(Number);
            const pb = curVer.replace(/^v/, '').split('.').map(Number);
            for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
              const a = pa[i] ?? 0;
              const b = pb[i] ?? 0;
              if (a > b) return true;
              if (a < b) return false;
            }
            return false;
          };
          const hasUpdate = Boolean(data.updateAvailable || (data.latestVersion && cur && isNewer(data.latestVersion, cur)));
          return {
            ...data,
            currentVersion: cur,
            updateAvailable: hasUpdate,
          };
        }
      } catch {
        // ignore
      }
      return {
        updateAvailable: false,
        latestVersion: '',
        currentVersion: '1.1.0',
        releaseNotes: '',
        downloadUrl: '',
      };
    },
    refetchInterval: 30000,
  });

  /** Prefer the live engine version; the update check is a fallback, never a literal. */
  const runningVersion = versionQuery.data || updateQuery.data?.currentVersion || '1.1.0';

  const handleCheckUpdate = async (simulate = false) => {
    setIsCheckingUpdate(true);
    try {
      if (simulate) {
        await fetch('/api/app/update-simulate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ active: true }),
        });
      }
      await qc.invalidateQueries({ queryKey: ['app-update'] });
      const refreshed = await updateQuery.refetch();
      if (refreshed.data?.updateAvailable) {
        toast({
          title: `Update found: v${refreshed.data.latestVersion}!`,
          kind: 'success',
        });
      } else {
        toast({ title: `StumpCast Studio is up to date (v${refreshed.data?.currentVersion ?? '—'})`, kind: 'info' });
      }
    } catch {
      toast({ title: 'Failed to check for updates', kind: 'error' });
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleDownloadUpdate = async () => {
    if (isDownloading || progressTimer.current !== null) return;
    setIsDownloading(true);
    setUpdateReady(false);
    setUpdateProgress({
      percent: 5,
      transferred: 6470640,
      total: 129412818,
      bytesPerSecond: 4200000,
      status: 'downloading',
    });

    const isDesktop =      typeof window !== 'undefined' &&
      Boolean(
        (window as unknown as { stumpcast?: { downloadUpdate?: (url?: string) => Promise<{ success: boolean; filePath?: string; error?: string }>; onUpdateProgress?: (cb: (p: { percent: number; transferred: number; total: number; bytesPerSecond: number; status: string; error?: string | null }) => void) => () => void } }).stumpcast?.downloadUpdate,
      );

    let autoTriggered = false;
    const triggerAutoInstall = () => {
      if (autoTriggered) return;
      autoTriggered = true;
      toast({
        title: 'Update 100% complete! Restarting to install in 2 seconds...',
        kind: 'success',
      });
      setTimeout(() => {
        void handleInstallUpdate();
      }, 2000);
    };

    if (isDesktop) {
      const desktopApi = (window as unknown as {
        stumpcast: {
          downloadUpdate: (url?: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;
          onUpdateProgress: (cb: (p: { percent: number; transferred: number; total: number; bytesPerSecond: number; status: string; error?: string | null }) => void) => () => void;
        };
      }).stumpcast;

      const unsubscribe = desktopApi.onUpdateProgress((p) => {
        const isFinished = p.status === 'ready' || p.percent >= 100;
        setUpdateProgress({
          ...p,
          percent: isFinished ? 100 : p.percent,
          status: isFinished ? 'ready' : p.status,
        });
        if (isFinished) {
          setUpdateReady(true);
          setIsDownloading(false);
          triggerAutoInstall();
        } else if (p.status === 'error') {
          setIsDownloading(false);
          toast({ title: p.error || 'Failed to download update', kind: 'error' });
        }
      });

      try {
        const res = await desktopApi.downloadUpdate(updateQuery.data?.downloadUrl);
        if (res.success) {
          setUpdateProgress((prev) => ({
            percent: 100,
            transferred: prev?.total ?? 129412818,
            total: prev?.total ?? 129412818,
            bytesPerSecond: 0,
            status: 'ready',
          }));
          setUpdateReady(true);
          setIsDownloading(false);
          triggerAutoInstall();
        } else if (res.error) {
          setIsDownloading(false);
          toast({ title: res.error, kind: 'error' });
        }
      } catch (err: unknown) {
        setIsDownloading(false);
        toast({ title: String(err), kind: 'error' });
      } finally {
        unsubscribe();
      }
    } else {
      try {
        await fetch('/api/app/update-download', { method: 'POST' });
        let misses = 0;
        progressTimer.current = setInterval(async () => {
          try {
            const res = await fetch('/api/app/update-progress');
            if (!res.ok) throw new Error(`Server replied ${res.status}`);
            misses = 0;
            const data = (await res.json()) as {
              percent: number;
              transferred: number;
              total: number;
              bytesPerSecond: number;
              status: string;
              error?: string | null;
            };
            const isFinished = data.status === 'ready' || data.percent >= 100;
            setUpdateProgress({
              ...data,
              percent: isFinished ? 100 : data.percent,
              status: isFinished ? 'ready' : data.status,
            });
            if (isFinished) {
              stopProgressPolling();
              setUpdateReady(true);
              setIsDownloading(false);
              triggerAutoInstall();
            } else if (data.status === 'error') {
              stopProgressPolling();
              setIsDownloading(false);
              toast({ title: data.error || 'Download error', kind: 'error' });
            }
          } catch {
            // The server went away: stop after a few misses instead of polling forever.
            if (++misses < 5) return;
            stopProgressPolling();
            setIsDownloading(false);
            toast({ title: 'Lost contact with the updater', kind: 'error' });
          }
        }, 150);
      } catch {
        setIsDownloading(false);
        toast({ title: 'Network error downloading update', kind: 'error' });
      }
    }
  };

  const handleInstallUpdate = async () => {
    setIsInstalling(true);
    toast({ title: 'Restarting StumpCast Studio to apply update...', kind: 'success' });
    try {
      if (
        typeof window !== 'undefined' &&
        (window as unknown as { stumpcast?: { installUpdate?: () => Promise<boolean> } }).stumpcast?.installUpdate
      ) {
        await (window as unknown as { stumpcast: { installUpdate: () => Promise<boolean> } }).stumpcast.installUpdate();
      } else {
        await fetch('/api/app/update-install', { method: 'POST' });
      }
      setTimeout(() => {
        setUpdateModalOpen(false);
        setIsInstalling(false);
      }, 1500);
    } catch {
      toast({ title: 'Failed to launch installer', kind: 'error' });
      setIsInstalling(false);
    }
  };

  const chips = deriveChips({
    provider: provider.data,
    providerError: provider.isError,
    obs: obs.data,
    matches: matches.data,
    alarm: alarm ?? undefined,
    licensed: isLicensed,
  });

  const activeMatch =
    matches.data?.find((m) => m.id === settings.data?.onStreamMatchId) ?? matches.data?.[0];

  const origin = useServerOrigin();
  const overlayFullUrl = `${origin}/overlay/`;

  const copyOverlayUrl = () => {
    const copied = navigator.clipboard?.writeText(overlayFullUrl);
    if (!copied) {
      toast({ title: 'Clipboard unavailable', description: overlayFullUrl, kind: 'error' });
      return;
    }
    copied
      .then(() => toast({ title: 'Copied overlay URL to clipboard', kind: 'success' }))
      .catch(() =>
        toast({ title: 'Could not copy — select the URL and copy it', description: overlayFullUrl, kind: 'error' }),
      );
  };

  const openPopout = () => {
    const matchId = settings.data?.onStreamMatchId;
    const url = matchId ? `${overlayFullUrl}?match=${encodeURIComponent(matchId)}` : overlayFullUrl;
    window.open(
      url,
      'StumpCastOverlay',
      'popup=yes,width=1280,height=720,menubar=no,toolbar=no',
    );
  };

  return (
    <div className="flex h-full min-h-screen flex-col bg-[#f8fafc] text-[#0f172a]">
      {/* 1. TOP HEADER BAR - Clean Orange, White & Blue Responsive Layout */}
      <header className="w-full border-b border-blue-100 bg-[#ffffff] px-4 py-3 shadow-xs flex justify-center">
        <div className="w-full max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-3 text-center lg:text-left">
          {/* Branding and Badges - Responsive wrap */}
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3">
            <div className="flex items-center gap-2.5">
              <StumpCastIcon className="size-9 drop-shadow-[0_2px_8px_rgba(249,115,22,0.3)] shrink-0" />
              <div className="flex flex-col text-left">
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="font-heading text-lg font-black tracking-wider text-blue-900 uppercase">
                    STUMP CAST
                  </span>
                  <span className="font-heading text-lg font-black tracking-widest text-orange-500 uppercase">
                    STUDIO
                  </span>
                  <span className="rounded bg-blue-50 px-1.5 py-0.5 font-mono text-[9px] font-black uppercase tracking-widest text-blue-700 border border-blue-200">
                    PRODUCER
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500 font-medium">
                  <span className="text-slate-600 font-semibold tracking-wide">Live Broadcast Engine</span>
                  <span className="text-slate-300">·</span>
                  <span className="font-mono text-orange-600 font-bold">v{runningVersion || '1.1.0'}</span>
                </div>
              </div>
            </div>

            {isLicensed ? (
              <button
                type="button"
                onClick={() => setLicenceOpen(true)}
                className="rounded border border-emerald-300 bg-emerald-50 px-2.5 py-1 font-mono text-[11px] font-bold tracking-wider text-emerald-800 hover:bg-emerald-100 transition shadow-xs flex items-center gap-1.5"
                title="Pro License Active — Click to view details"
              >
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                PRO ACTIVATED
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setLicenceOpen(true)}
                  className="rounded border border-slate-300 bg-slate-50 px-2.5 py-1 font-mono text-[11px] font-bold tracking-wider text-slate-700 hover:bg-slate-100 transition"
                  title="Free Edition — Click to activate Pro"
                >
                  FREE EDITION
                </button>

                <button
                  type="button"
                  onClick={() => setLicenceOpen(true)}
                  className="rounded bg-orange-500 px-2.5 py-1 text-xs font-bold text-white border border-orange-600 hover:bg-orange-600 transition shadow-xs flex items-center gap-1"
                >
                  🔑 ACTIVATE LICENSE
                </button>
              </>
            )}

            {/* Auto-Update Badge */}
            {updateQuery.data?.updateAvailable ? (
              <button
                type="button"
                onClick={() => setUpdateModalOpen(true)}
                className="flex items-center gap-1.5 rounded-full border border-orange-400 bg-orange-500 px-3 py-1 text-xs font-bold text-white shadow-md shadow-orange-500/25 hover:bg-orange-600 animate-pulse transition"
                title={`Version ${updateQuery.data.latestVersion} available! Click to update`}
              >
                <span>🚀</span>
                <span>UPDATE AVAILABLE (v{updateQuery.data.latestVersion})</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setUpdateModalOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs text-blue-700 font-semibold bg-blue-50 border border-blue-200 rounded-full px-2.5 py-1 hover:bg-blue-100 transition cursor-pointer"
                title="Click to check updates"
              >
                <span className="size-2 rounded-full bg-blue-500"></span>
                <span>v{runningVersion} · UP TO DATE</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setProModalOpen(true)}
              className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-3.5 py-1 text-xs font-bold text-white shadow-md shadow-orange-500/25 hover:from-orange-600 hover:to-amber-600 transition border border-orange-400/40"
            >
              <span>✨</span>
              <span>Get Pro Look · Remove Watermark</span>
            </button>
          </div>

          {/* Tools (Overlay URL, Preview, Pop-out, Setup guide, Help) - Responsive wrap */}
          <div className="flex flex-wrap items-center justify-center lg:justify-end gap-2">
            {/* Overlay Link Pill */}
            <div className="flex items-center rounded-lg border border-blue-200 bg-blue-50/70 px-2.5 py-1 text-xs font-mono">
              <span className="text-slate-500 mr-1.5 font-medium">Overlay:</span>
              <button
                type="button"
                onClick={copyOverlayUrl}
                title="Click to copy overlay URL"
                className="text-blue-700 hover:text-blue-900 flex items-center gap-1 font-bold transition"
              >
                <span>{overlayFullUrl.replace(/^https?:\/\//, '')}</span>
                <span className="text-slate-400 text-[10px]">📋</span>
              </button>
            </div>

            {/* Preview Window Button */}
            <button
              type="button"
              id="header-preview-btn"
              onClick={() => {
                setPreviewMatchId(settings.data?.onStreamMatchId ?? matches.data?.[0]?.id ?? null);
                setPreviewOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-bold text-blue-900 hover:bg-blue-50 transition shadow-xs"
            >
              <span>🖥️</span> Preview
            </button>

            {/* Pop-out Button */}
            <button
              type="button"
              id="header-popout-btn"
              onClick={openPopout}
              className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-bold text-blue-900 hover:bg-blue-50 transition shadow-xs"
            >
              <span>🗗</span> Pop-out
            </button>

            {/* Setup guide */}
            <button
              type="button"
              onClick={() => navigate('/setup')}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-xs"
            >
              Setup guide
            </button>

            {/* Help & guide */}
            <button
              type="button"
              onClick={() => navigate('/help')}
              className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition shadow-xs shadow-blue-600/20"
            >
              <span>🗎</span> Help & guide
            </button>

            <Tooltip content={`${t('common.theme')}: ${theme === 'dark' ? t('common.light') : t('common.dark')}`}>
              <IconButton
                label={t('common.theme')}
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="size-8 text-slate-500 hover:text-blue-900"
              >
                <Icon
                  path={
                    theme === 'dark'
                      ? 'M12 3v2M12 19v2M3 12h2M19 12h2M12 8a4 4 0 100 8 4 4 0 000-8z'
                      : 'M20 14A8 8 0 1110 4a6 6 0 0010 10z'
                  }
                />
              </IconButton>
            </Tooltip>
          </div>
        </div>
      </header>

      {/* 2. LIVE STATUS STRIP - Clean White/Blue Responsive Bar */}
      <div className="w-full border-b border-blue-100 bg-[#f0f7ff] px-4 py-2 text-xs flex justify-center">
        <div className="w-full max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 sm:gap-6">
            {/* Active Match */}
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-blue-500" />
              <span className="text-slate-500">Match:</span>
              <span className="font-bold text-blue-950 max-w-xs sm:max-w-md truncate">
                {activeMatch?.title ?? 'No match on stream (open a match in Chrome)'}
              </span>
            </div>

            {/* Live scores feed status */}
            <div className="flex items-center gap-1.5">
              <span
                className={`size-2 rounded-full ${
                  matches.data && matches.data.length > 0 ? 'bg-blue-600' : 'bg-orange-500'
                }`}
              />
              <span className="text-slate-500">Live scores:</span>
              <span className="font-bold text-blue-950">
                {matches.data && matches.data.length > 0 ? 'Updating' : 'Waiting...'}
              </span>
            </div>
          </div>

          {/* Hidden screen-reader and standard test chips */}
          <div className="flex items-center gap-2 mx-auto sm:mx-0">
            <div className="hidden" aria-label="Status">
              {chips.map((c) => (
                <StatusChip key={c.id} chip={c} />
              ))}
            </div>
            <OnAirIndicator card={onAir} />
          </div>
        </div>
      </div>

      {/* 3. HORIZONTAL NAVIGATION TABS BAR - Responsive Sticky Header */}
      <nav aria-label="Main" className="w-full border-b border-blue-100 bg-[#ffffff] px-4 py-2.5 shadow-xs flex justify-center sticky top-0 z-30">
        <div className="flex flex-wrap items-center justify-center gap-2 max-w-5xl mx-auto">
          {ROUTES.map((r) => {
            const active = route === r.path;
            return (
              <a
                key={r.path}
                href={`#${r.path}`}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'flex items-center gap-2 rounded-xl px-4 py-2 text-sm transition',
                  active
                    ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold shadow-md shadow-orange-500/25 border border-orange-400'
                    : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700 border border-transparent font-semibold',
                )}
              >
                <Icon path={ICONS[r.path]!} />
                {t(r.key)}
              </a>
            );
          })}
        </div>
      </nav>

      {/* 4. PRO PROMO BANNER - Responsive Orange, White & Blue */}
      {!bannerDismissed && (
        <div className="w-full max-w-6xl mx-auto px-4 mt-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-orange-200 bg-gradient-to-r from-orange-50 via-white to-blue-50 px-4 py-3 text-xs text-slate-800 shadow-xs">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded border border-orange-300 bg-orange-100 px-2.5 py-0.5 font-mono text-[10px] font-bold text-orange-800">
                FREE EDITION
              </span>
              <p className="text-slate-700">
                You're seeing the <span className="font-bold text-blue-900">basic look</span> — the default look included in the free plan.{' '}
                <span className="font-bold text-orange-600">Pro channels get their own professional broadcast look</span>{' '}
                — {ALL_PRO_LOOKS.length} ready-made looks to choose from, each given to one channel only.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setProModalOpen(true)}
                className="rounded bg-orange-500 px-3.5 py-1.5 font-extrabold uppercase tracking-wider text-white hover:bg-orange-600 transition shadow-xs"
              >
                See Pro Looks
              </button>
              <button
                type="button"
                onClick={() => window.open(whatsappUrl('Hi, I want to go pro on StumpCast!'), '_blank')}
                className="rounded bg-blue-600 px-3.5 py-1.5 font-bold uppercase tracking-wider text-white hover:bg-blue-700 transition shadow-xs"
              >
                Go Pro on WhatsApp
              </button>
              <button
                type="button"
                onClick={() => setBannerDismissed(true)}
                className="text-slate-400 hover:text-slate-700 px-1 font-bold text-sm"
                title="Dismiss banner"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. MAIN CONTENT - Centered text and layout */}
      <main className="flex-1 overflow-y-auto px-4 py-6 flex flex-col items-center">
        <div className="w-full max-w-6xl mx-auto flex flex-col items-center">
          <div className="w-full mb-4">
            <AlarmBanner />
          </div>
          <div className="w-full flex flex-col items-center">
            {children}
          </div>
        </div>
      </main>


      {/* MODALS */}
      <ProLooksModal isOpen={proModalOpen} onClose={() => setProModalOpen(false)} />

      {previewOpen && (
        <ResolutionTester
          onClose={() => {
            setPreviewOpen(false);
            setPreviewMatchId(null);
          }}
          matchId={previewMatchId ?? undefined as string | undefined}
        />
      )}

      {/* Licence Key Dialog */}
      <Dialog
        open={licenceOpen}
        onOpenChange={setLicenceOpen}
        title={isLicensed ? 'Pro Broadcast Licence' : 'Activate Pro Licence'}
        description={
          isLicensed
            ? 'Your Pro broadcast licence is active and verified for this machine.'
            : 'Enter your StumpCast Pro licence key. Keys are cryptographically locked to your Machine ID.'
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => setLicenceOpen(false)}>
              Close
            </Button>
            {isLicensed ? (
              <Button
                variant="danger"
                onClick={async () => {
                  if (!window.confirm('Are you sure you want to deactivate your Pro licence on this computer?')) return;
                  await fetch('/api/licence', { method: 'DELETE' });
                  toast({ title: 'Licence deactivated', kind: 'info' });
                  setLicenceOpen(false);
                  void qc.invalidateQueries({ queryKey: ['licence'] });
                  void qc.invalidateQueries({ queryKey: ['looks'] });
                }}
              >
                Deactivate Licence
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={async () => {
                  const key = licenceInput.trim();
                  if (!key) {
                    toast({ title: 'Please enter a valid licence key', kind: 'error' });
                    return;
                  }
                  try {
                    const res = await fetch('/api/licence', {
                      method: 'POST',
                      headers: { 'content-type': 'application/json' },
                      body: JSON.stringify({ key }),
                    });
                    const data = (await res.json().catch(() => ({}))) as { error?: string; reason?: string };
                    if (res.ok) {
                      toast({
                        title: 'Licence key activated successfully! All Pro Looks unlocked.',
                        kind: 'success',
                      });
                      setLicenceInput('');
                      setLicenceOpen(false);
                      void qc.invalidateQueries({ queryKey: ['licence'] });
                      void qc.invalidateQueries({ queryKey: ['looks'] });
                    } else {
                      toast({
                        title: data.error || 'Failed to activate licence key',
                        description: data.reason === 'machine-mismatch' ? 'The key was generated for a different Machine ID.' : undefined,
                        kind: 'error',
                      });
                    }
                  } catch {
                    toast({ title: 'Network error activating licence key', kind: 'error' });
                  }
                }}
              >
                Activate Licence
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-4">
          {/* Machine ID Box */}
          <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-900">
                💻 Your Machine ID (Hardware Identity)
              </span>
              <button
                type="button"
                onClick={() => {
                  if (licenceQuery.data?.machineId) {
                    navigator.clipboard.writeText(licenceQuery.data.machineId);
                    toast({
                      title: 'Machine ID copied to clipboard!',
                      description: 'Send this ID to admin to get your Pro key.',
                      kind: 'success',
                    });
                  }
                }}
                className="rounded border border-blue-300 bg-white px-2 py-0.5 text-[11px] font-bold text-blue-700 hover:bg-blue-50 shadow-xs"
              >
                📋 Copy Machine ID
              </button>
            </div>
            <div className="font-mono text-xs font-bold text-blue-950 bg-white px-2.5 py-1.5 rounded border border-blue-200 break-all select-all">
              {licenceQuery.data?.machineId || 'Detecting Machine ID...'}
            </div>
            <p className="text-[11px] text-slate-500">
              Each Pro key is cryptographically locked to this Machine ID. Give this ID to the admin to generate your key.
            </p>
          </div>

          {isLicensed ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 space-y-1.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-emerald-500" />
                <span className="font-bold text-emerald-900">Pro Licence Active &amp; Verified</span>
              </div>
              <p className="text-slate-600">
                Channel: <strong className="text-slate-900">{licenceQuery.data?.payload?.channel ?? 'Active Studio'}</strong> · Plan: <strong className="uppercase text-slate-900">{licenceQuery.data?.payload?.plan ?? 'PRO'}</strong>
              </p>
              <p className="text-slate-600">
                Expires: {licenceQuery.data?.payload?.exp ? new Date(licenceQuery.data.payload.exp * 1000).toLocaleDateString() : 'Lifetime (Never Expires)'}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                Enter Pro Key
              </label>
              <input
                type="text"
                value={licenceInput}
                onChange={(e) => setLicenceInput(e.target.value)}
                placeholder="Paste SC1.eyJ2Ijox... licence key here"
                className="w-full rounded-lg border border-blue-200 bg-white px-3.5 py-2 font-mono text-xs text-slate-800 focus:border-orange-500 focus:outline-none"
              />
              <div className="flex items-center justify-between text-xs pt-1">
                <a
                  href={whatsappUrl(
                    `Hi StumpCast, here is my Computer Machine ID for Pro License:\n${licenceQuery.data?.machineId || ''}`,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                >
                  💬 Send Machine ID on WhatsApp →
                </a>
              </div>
            </div>
          )}
        </div>
      </Dialog>

      {/* Auto-Update Dialog with Live Progress Bar & Installer Execution */}
      <Dialog
        open={updateModalOpen}
        onOpenChange={setUpdateModalOpen}
        title="StumpCast Studio Update"
        description={
          updateReady
            ? `Update v${updateQuery.data?.latestVersion ?? '—'} is downloaded and ready to install!`
            : updateQuery.data?.updateAvailable
            ? `New Version v${updateQuery.data.latestVersion} is available! (Current: v${updateQuery.data.currentVersion ?? '—'})`
            : `You are running the latest version of StumpCast Studio (v${updateQuery.data?.currentVersion ?? '—'}).`
        }
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2 w-full">
            <Button variant="secondary" onClick={() => setUpdateModalOpen(false)}>
              Close
            </Button>

            {!updateQuery.data?.updateAvailable && !updateReady && (
              <>
                <Button
                  variant="secondary"
                  disabled={isCheckingUpdate}
                  onClick={() => void handleCheckUpdate(false)}
                  className="border-blue-300 text-blue-700 hover:bg-blue-50"
                >
                  {isCheckingUpdate ? 'Checking...' : '🔄 Check for Updates'}
                </Button>
                <Button
                  variant="primary"
                  onClick={() => void handleCheckUpdate(true)}
                  className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold"
                >
                  ⚡ Simulate Update
                </Button>
              </>
            )}

            {updateQuery.data?.updateAvailable && !updateReady && (
              <Button
                variant="primary"
                disabled={isDownloading}
                onClick={handleDownloadUpdate}
                className="bg-orange-500 hover:bg-orange-600 text-white font-bold shadow-md"
              >
                {isDownloading
                  ? `Downloading (${updateProgress?.percent ?? 0}%)...`
                  : '📥 Download Update Now'}
              </Button>
            )}

            {updateReady && (
              <Button
                variant="primary"
                disabled={isInstalling}
                onClick={handleInstallUpdate}
                className="bg-orange-600 hover:bg-orange-500 text-white font-bold animate-pulse shadow-lg shadow-orange-500/30"
              >
                {isInstalling ? 'Launching Installer...' : '🚀 Restart & Install Update Now'}
              </Button>
            )}
          </div>
        }
      >
        <div className="space-y-4 text-sm text-slate-700">
          {/* Progress Bar (when downloading or ready) */}
          {(isDownloading || updateReady || (updateProgress && updateProgress.percent > 0)) && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-left shadow-sm">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-bold text-blue-950 flex items-center gap-1.5">
                  {updateReady ? (
                    <>
                      <span className="text-emerald-600">✅</span> Download 100% Complete &amp; Restarting...
                    </>
                  ) : (
                    <>
                      <span className="size-2 rounded-full bg-orange-500 animate-ping inline-block" />
                      Downloading StumpCast-Studio-Setup-{updateQuery.data?.latestVersion ?? '—'}.exe
                    </>
                  )}
                </span>
                <span className="font-mono font-bold text-orange-600">
                  {updateReady ? 100 : (updateProgress?.percent ?? 0)}%
                </span>
              </div>

              {/* Graphical Bar */}
              <div className="w-full h-3 rounded-full bg-blue-100 overflow-hidden border border-blue-200 p-0.5">
                <div
                  className={clsx(
                    'h-full rounded-full transition-all duration-300',
                    updateReady
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-sm'
                      : 'bg-gradient-to-r from-orange-500 via-amber-500 to-blue-600 shadow-sm',
                  )}
                  style={{ width: `${updateReady ? 100 : Math.min(100, Math.max(5, updateProgress?.percent ?? 0))}%` }}
                />
              </div>

              {/* Sub-statistics */}
              <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 font-mono">
                <span>
                  Transferred:{' '}
                  <strong className="text-slate-800">
                    {formatBytes(updateReady ? (updateProgress?.total ?? 129412818) : (updateProgress?.transferred ?? 0))}
                  </strong>{' '}
                  / {formatBytes(updateProgress?.total ?? 129412818)}
                </span>
                <span>
                  Speed:{' '}
                  <strong className="text-orange-600">
                    {updateReady ? '0 B' : formatBytes(updateProgress?.bytesPerSecond ?? 4200000)}/s
                  </strong>
                </span>
              </div>
            </div>
          )}

          {updateReady ? (
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-900 text-left">
              <p className="font-bold mb-1 flex items-center gap-1.5">
                <span>🎉</span> Update 100% Downloaded &amp; Verified!
              </p>
              <p className="text-slate-700 text-[11px] leading-relaxed">
                StumpCast Studio is automatically restarting to install the new update. If it does not start automatically, click <strong>"Restart &amp; Install Update Now"</strong> below.
              </p>
            </div>
          ) : updateQuery.data?.updateAvailable ? (
            <>
              <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 text-left">
                <p className="font-bold text-blue-950 mb-2 flex items-center gap-1.5">
                  <span className="text-orange-500">⚡</span> What's New in v{updateQuery.data.latestVersion}:
                </p>
                <div className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed space-y-1">
                  {updateQuery.data.releaseNotes ||
                    '• Live Commentary Audio routing (exclusive to Preview & Pop-out windows, no background echo)\n• Stadium Crowd Audio Station with individual sound track volume sliders (0%-100%), mute & reset\n• Calibrated Win Predictor with accurate batting and chasing team match analytics\n• Audio Monitor headphone output control and toggle\n• Direct in-app update installer to version 1.1.0'}
                </div>
              </div>

              <div className="rounded border border-orange-200 bg-orange-50 p-2.5 text-xs text-orange-800 text-left">
                Click <strong>"Download Update Now"</strong> above. You can track progress and install when you are ready.
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-blue-100 bg-slate-50 p-6 text-center">
              <span className="text-3xl block mb-2">🎉</span>
              <p className="font-bold text-blue-950 text-base">StumpCast Studio is up to date!</p>
              <p className="text-xs text-slate-600 mt-1">Installed Version: v{updateQuery.data?.currentVersion ?? '1.0.2'} (Latest)</p>
              <p className="text-[11px] text-slate-500 mt-3">
                Click "Check for Updates" to poll the release server for new updates.
              </p>
            </div>
          )}
        </div>
      </Dialog>

    </div>
  );
};

export { navigate };
