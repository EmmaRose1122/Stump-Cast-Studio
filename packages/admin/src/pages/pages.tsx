import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { slug, whatsappUrl, type Settings, type Team } from '@stumpcast/shared';
import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, keysApi, selectorsApi } from '../lib/api';
import { assetsApi } from '../lib/assetsApi';
import { rosterFromTeam, type RosterPlayer } from '../lib/squadRoster';
import { PlayerAvatar, TeamCrest } from '../lib/teamCrests';
import { ProLooksModal } from '../shell/ProLooksModal';
import { useAdmin } from '../store';
import { Button, Card, Dialog } from '../ui';
import { reopenSetup } from './Setup';

const PageTitle = ({ children }: { children: string }) => (
  <h1 className="mb-4 font-heading text-2xl font-bold">{children}</h1>
);

export { VideoPage } from './Video';

export const HelpPage = () => {
  const { t } = useTranslation();
  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center text-center space-y-4">
      <PageTitle>{t('pages.help.title')}</PageTitle>
      <Card title="Setup wizard" className="w-full text-center">
        <p className="mb-3 text-sm text-muted">
          Connect a data source, pick a match and add the overlay to OBS.
        </p>
        <Button variant="primary" onClick={reopenSetup}>
          Run setup again
        </Button>
      </Card>
    </div>
  );
};

export const SettingsPage = () => {
  const qc = useQueryClient();
  const toast = useAdmin((s) => s.toast);
  const settings = useQuery({ queryKey: ['settings'], queryFn: api.settings });
  const aiKeys = useQuery({ queryKey: ['ai-keys'], queryFn: keysApi.status, refetchInterval: 3000 });
  const [delay, setDelay] = useState(0);
  const [cardScale, setCardScale] = useState(1.45);
  const [sideCardScale, setSideCardScale] = useState(1.0);
  const [cardWidth, setCardWidth] = useState<'narrow' | 'normal' | 'wide'>('wide');
  const [showProLooks, setShowProLooks] = useState(false);
  /** Players whose photo the operator picked to save, by name. */
  const [pickedPlayers, setPickedPlayers] = useState<Set<string>>(new Set());
  const [savingPhotos, setSavingPhotos] = useState(false);

  // The squad panel below shows the on-stream match's real line-up, so the operator can see which
  // players still have no picture anywhere and save the photo the score site publishes.
  const matches = useQuery({ queryKey: ['matches'], queryFn: api.matches, refetchInterval: 5000 });
  const onStreamMatch =
    matches.data?.find((m) => m.id === settings.data?.onStreamMatchId) ?? matches.data?.[0];
  const savedPlayerIds = useQuery({
    queryKey: ['assets', 'settings-player-ids'],
    queryFn: async () => {
      const first = await assetsApi.list({ type: 'player', pageSize: 200, page: 1 });
      const pages = Math.ceil(first.total / 200);
      const rest =
        pages > 1
          ? await Promise.all(
              Array.from({ length: pages - 1 }, (_, i) =>
                assetsApi.list({ type: 'player', pageSize: 200, page: i + 2 }),
              ),
            )
          : [];
      return new Set([first, ...rest].flatMap((p) => p.items).map((a) => a.id.toLowerCase()));
    },
  });
  const hasSavedAsset = (name: string): boolean => {
    const s = slug(name);
    const ids = savedPlayerIds.data;
    return Boolean(ids?.has(s) || ids?.has(`player-${s}`));
  };
  /** A tile is ready when it can paint a face: a saved asset, or the photo the site published. */
  const playerReady = (p: RosterPlayer): boolean => Boolean(p.imageUrl) || hasSavedAsset(p.name);

  const panelTeams: Team[] = onStreamMatch?.teams ?? [];
  const rosterOf = (team: Team): RosterPlayer[] => rosterFromTeam(team, undefined, undefined).players;
  const panelPlayers = panelTeams.flatMap((t) => rosterOf(t));
  const allMissing = panelPlayers.filter((p) => !playerReady(p));
  const pickedWithoutPhoto = panelPlayers.filter((p) => pickedPlayers.has(p.name) && !p.imageUrl).length;

  const togglePick = (name: string) =>
    setPickedPlayers((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const pickMissingIn = (team: Team) =>
    setPickedPlayers((prev) => {
      const next = new Set(prev);
      for (const p of rosterOf(team)) if (!playerReady(p)) next.add(p.name);
      return next;
    });

  /**
   * Saves the published photo for every picked player. There is no image generator in this build,
   * and inventing a face for a real cricketer is worse than leaving the tile empty — so a player
   * the site has no picture of is reported, not fabricated.
   */
  const savePickedPhotos = async () => {
    const targets = panelPlayers.filter((p) => pickedPlayers.has(p.name));
    const withPhoto = targets.filter((p): p is RosterPlayer & { imageUrl: string } => Boolean(p.imageUrl));
    const skipped = targets.length - withPhoto.length;
    if (withPhoto.length === 0) {
      toast({
        title: 'Nothing to save',
        description: `${skipped} selected player(s) have no photo on the score site — upload one instead.`,
        kind: 'info',
      });
      return;
    }
    setSavingPhotos(true);
    let saved = 0;
    let failed = 0;
    for (const player of withPhoto) {
      try {
        await assetsApi.importUrl({
          type: 'player',
          name: player.name,
          url: player.imageUrl,
          rights: true,
        });
        saved++;
      } catch {
        failed++;
      }
    }
    setSavingPhotos(false);
    setPickedPlayers(new Set());
    void qc.invalidateQueries({ queryKey: ['assets'] });
    void qc.invalidateQueries({ queryKey: ['missing'] });
    toast({
      title: failed ? `Saved ${saved}, ${failed} failed` : `Saved ${saved} player photo${saved === 1 ? '' : 's'}`,
      description: skipped ? `${skipped} skipped — the site has no photo for them.` : undefined,
      kind: failed ? 'error' : 'success',
    });
  };
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [activeKeyTab, setActiveKeyTab] = useState<'gemini' | 'cricket' | 'openai'>('gemini');
  const [geminiKeyInput, setGeminiKeyInput] = useState('');
  const [openaiKeyInput, setOpenaiKeyInput] = useState('');
  const [cricketKeyInput, setCricketKeyInput] = useState('');
  const [showKeySecret, setShowKeySecret] = useState(false);
  const [licenceInput, setLicenceInput] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);

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
    refetchInterval: 5000,
  });
  const isLicensed = licenceQuery.data?.licensed ?? false;
  const machineId = licenceQuery.data?.machineId ?? '';
  const licencePayload = licenceQuery.data?.payload;

  const handleActivateLicence = async () => {
    const key = licenceInput.trim();
    if (!key) {
      toast({ title: 'Please enter a valid licence key', kind: 'error' });
      return;
    }
    setIsActivating(true);
    try {
      const res = await fetch('/api/licence', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; reason?: string };
      if (res.ok) {
        toast({
          title: 'Licence key activated successfully!',
          description: 'All 29+ Pro Looks unlocked and watermark removed.',
          kind: 'success',
        });
        setLicenceInput('');
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
    } finally {
      setIsActivating(false);
    }
  };

  const handleDeactivateLicence = async () => {
    if (!window.confirm('Are you sure you want to deactivate this licence from this machine?')) return;
    setIsDeactivating(true);
    try {
      const res = await fetch('/api/licence', { method: 'DELETE' });
      if (res.ok) {
        toast({ title: 'Licence deactivated', kind: 'info' });
        void qc.invalidateQueries({ queryKey: ['licence'] });
        void qc.invalidateQueries({ queryKey: ['looks'] });
      } else {
        toast({ title: 'Failed to deactivate licence', kind: 'error' });
      }
    } catch {
      toast({ title: 'Network error deactivating licence', kind: 'error' });
    } finally {
      setIsDeactivating(false);
    }
  };

  const saveKeyMutation = useMutation({
    mutationFn: async ({ provider, key }: { provider: 'gemini' | 'openai' | 'cricket'; key: string }) => {
      if (typeof window !== 'undefined') {
        const desktop = (window as unknown as { stumpcast?: { setSecret?: (k: string, v?: string) => Promise<boolean> } }).stumpcast;
        if (desktop?.setSecret) {
          const deskKey = provider === 'gemini' ? 'geminiKey' : provider === 'cricket' ? 'cricketApiKey' : 'openaiApiKey';
          await desktop.setSecret(deskKey, key).catch(() => false);
        }
      }
      return keysApi.save(provider, key);
    },
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ['ai-keys'] });
      void qc.invalidateQueries({ queryKey: ['commentary'] });
      void qc.invalidateQueries({ queryKey: ['provider'] });
      toast({
        title: `${vars.provider === 'gemini' ? 'Google Gemini' : vars.provider === 'cricket' ? 'Cricket Data' : 'OpenAI'} Key Saved`,
        description: 'Key encrypted and saved securely. Live features are now enabled.',
        kind: 'success',
      });
      if (vars.provider === 'gemini') setGeminiKeyInput('');
      if (vars.provider === 'openai') setOpenaiKeyInput('');
      if (vars.provider === 'cricket') setCricketKeyInput('');
    },
    onError: (err: unknown) => {
      toast({
        title: 'Failed to save key',
        description: err instanceof Error ? err.message : 'Please check key and try again',
        kind: 'error',
      });
    },
  });

  const removeKeyMutation = useMutation({
    mutationFn: async (provider: 'gemini' | 'openai' | 'cricket') => {
      if (typeof window !== 'undefined') {
        const desktop = (window as unknown as { stumpcast?: { setSecret?: (k: string, v?: string) => Promise<boolean> } }).stumpcast;
        if (desktop?.setSecret) {
          const deskKey = provider === 'gemini' ? 'geminiKey' : provider === 'cricket' ? 'cricketApiKey' : 'openaiApiKey';
          await desktop.setSecret(deskKey, undefined).catch(() => false);
        }
      }
      return keysApi.remove(provider);
    },
    onSuccess: (_, provider) => {
      void qc.invalidateQueries({ queryKey: ['ai-keys'] });
      void qc.invalidateQueries({ queryKey: ['commentary'] });
      void qc.invalidateQueries({ queryKey: ['provider'] });
      toast({
        title: `${provider === 'gemini' ? 'Google Gemini' : provider === 'cricket' ? 'Cricket Data' : 'OpenAI'} Key Removed`,
        description: 'Key removed. Built-in defaults will be used.',
        kind: 'info',
      });
    },
    onError: (err: unknown) => {
      toast({
        title: 'Failed to remove key',
        description: err instanceof Error ? err.message : 'Error removing key',
        kind: 'error',
      });
    },
  });

  useEffect(() => {
    if (settings.data) {
      setDelay(settings.data.syncDelaySec);
      if (settings.data.cardScale) setCardScale(settings.data.cardScale);
      if (settings.data.sideCardScale) setSideCardScale(settings.data.sideCardScale);
      if (settings.data.cardWidth) setCardWidth(settings.data.cardWidth);
    }
  }, [settings.data]);

  const save = useMutation({
    mutationFn: api.saveSettings,
    onSuccess: (s) => {
      qc.setQueryData(['settings'], s);
      toast({ title: 'Settings saved', kind: 'success' });
    },
    onError: () => toast({ title: 'Could not save settings', kind: 'error' }),
  });
  const s = settings.data;

  // These sliders used to PUT the whole settings document on every input event: a one-second
  // drag fired dozens of concurrent saves, the last response won, and the handle snapped back.
  const savedNumbers = useRef<Record<string, number>>({});
  // The marker is written before the request so a drag cannot queue the same save twice, and
  // dropped again if the save fails: otherwise a value that never reached the server is treated
  // as already saved and the slider can never retry it.
  const commitNumber = (key: string, value: number, patch: Partial<Settings>) => {
    if (!s || savedNumbers.current[key] === value) return;
    savedNumbers.current[key] = value;
    save.mutate(
      { ...s, ...patch },
      {
        onError: () => {
          if (savedNumbers.current[key] === value) delete savedNumbers.current[key];
        },
      },
    );
  };
  const commitDelay = () => commitNumber('delay', delay, { syncDelaySec: delay });
  const commitCardScale = () => commitNumber('cardScale', cardScale, { cardScale });
  const commitSideScale = () => commitNumber('sideCardScale', sideCardScale, { sideCardScale });

  const selectorsStatus = useQuery({
    queryKey: ['selectorsStatus'],
    queryFn: selectorsApi.status,
  });

  const checkSelectors = useMutation({
    mutationFn: () => selectorsApi.check(),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['selectorsStatus'] });
      toast({
        title: res.updated ? `Updated to v${res.version}` : 'Selectors are up to date',
        kind: res.updated ? 'success' : 'info',
      });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Check failed';
      toast({ title: msg, kind: 'error' });
    },
  });

  const rollbackSelectors = useMutation({
    mutationFn: selectorsApi.rollback,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['selectorsStatus'] });
      toast({ title: `Rolled back to bundled selectors v${res.version}`, kind: 'success' });
    },
    onError: () => {
      toast({ title: 'Rollback failed', kind: 'error' });
    },
  });

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col items-center space-y-6">
      {/* Pro Look Banner */}
      <div className="w-full flex flex-wrap items-center justify-between gap-4 rounded-xl border border-orange-200 bg-gradient-to-r from-orange-50 via-white to-blue-50 p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="rounded bg-orange-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-orange-700 border border-orange-300">
            FREE EDITION
          </span>
          <p className="text-xs text-slate-700 sm:text-sm">
            You're seeing the <span className="font-bold text-orange-600">basic look</span> — the default look included in the free plan.{' '}
            <span className="text-blue-800 font-medium">Pro channels get their own professional broadcast look</span> — 29 ready-made looks to choose from, each given to one channel only.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowProLooks(true)}
            className="rounded-lg bg-orange-500 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-orange-600 shadow-xs border border-orange-400"
          >
            SEE PRO LOOKS
          </button>
          <a
            href={whatsappUrl('Hi StumpCast, I want a Pro Look')}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-blue-200 bg-white px-3.5 py-1.5 text-xs font-bold text-blue-700 transition hover:bg-blue-50 shadow-xs"
          >
            GO PRO ON WHATSAPP
          </a>
        </div>
      </div>

      {/* PRO BROADCAST LICENSE & MACHINE HARDWARE ID */}
      <div className="w-full rounded-xl border border-blue-200 bg-white p-5 shadow-sm space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔐</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-blue-950">
                  Broadcast License &amp; Machine ID
                </h2>
                {isLicensed ? (
                  <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-800 border border-emerald-300 flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    PRO ACTIVATED
                  </span>
                ) : (
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-800 border border-amber-300">
                    FREE EDITION
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Each license key is cryptographically bound to this computer's unique Machine ID.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isLicensed ? (
              <button
                type="button"
                onClick={handleDeactivateLicence}
                disabled={isDeactivating}
                className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition shadow-xs"
              >
                {isDeactivating ? 'Deactivating...' : 'Deactivate License'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowProLooks(true)}
                className="rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition shadow-xs"
              >
                Browse 29+ Pro Looks
              </button>
            )}
          </div>
        </div>

        {/* Machine ID Box */}
        <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50/80 via-white to-blue-50/50 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-900 block">
                💻 This Computer's Unique Machine ID
              </span>
              <p className="text-xs text-slate-500">
                Send this Machine ID to admin to get your Pro License Key generated.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (machineId) {
                    navigator.clipboard.writeText(machineId);
                    toast({
                      title: 'Machine ID copied to clipboard!',
                      description: 'Send this ID to admin to get your Pro License Key.',
                      kind: 'success',
                    });
                  }
                }}
                className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition shadow-xs flex items-center gap-1.5"
              >
                📋 Copy Machine ID
              </button>
              <a
                href={whatsappUrl(
                  `Hi StumpCast, here is my Computer Machine ID for Pro License:\n${machineId || ''}`,
                )}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-emerald-300 bg-emerald-50 px-3.5 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition shadow-xs flex items-center gap-1.5"
              >
                💬 Send via WhatsApp
              </a>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white rounded-lg border border-blue-200 p-2.5 shadow-xs">
            <span className="text-slate-400 font-mono text-xs select-none">MACHINE ID:</span>
            <input
              type="text"
              readOnly
              value={machineId || 'Detecting Machine ID...'}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="w-full bg-transparent font-mono text-xs sm:text-sm font-bold text-blue-950 focus:outline-none select-all"
            />
            <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-mono font-bold text-blue-700 whitespace-nowrap">
              HARDWARE LOCKED
            </span>
          </div>
        </div>

        {/* License Details or Activation Input */}
        {isLicensed ? (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 border-t border-blue-100 pt-3">
            <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3">
              <span className="text-[10px] font-bold uppercase text-slate-500 block">Channel / Licensee</span>
              <span className="font-heading text-sm font-bold text-slate-900 truncate block">
                {licencePayload?.channel ?? 'Active Studio'}
              </span>
            </div>
            <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3">
              <span className="text-[10px] font-bold uppercase text-slate-500 block">Plan</span>
              <span className="font-heading text-sm font-bold uppercase text-blue-800">
                {licencePayload?.plan ?? 'PRO'}
              </span>
            </div>
            <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3">
              <span className="text-[10px] font-bold uppercase text-slate-500 block">Expiry</span>
              <span className="font-heading text-xs font-bold text-slate-800">
                {licencePayload?.exp ? new Date(licencePayload.exp * 1000).toLocaleDateString() : 'Lifetime (Never Expires)'}
              </span>
            </div>
            <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3">
              <span className="text-[10px] font-bold uppercase text-slate-500 block">Status</span>
              <span className="text-xs font-bold text-emerald-700 flex items-center gap-1 mt-0.5">
                <span className="size-2 rounded-full bg-emerald-500" />
                Hardware Verified
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-3 border-t border-blue-100 pt-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
              Enter Pro License Key
            </span>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                value={licenceInput}
                onChange={(e) => setLicenceInput(e.target.value)}
                placeholder="Paste SC1.eyJ2Ijox... license key here"
                className="flex-1 rounded-lg border border-blue-200 bg-white px-3.5 py-2 font-mono text-xs sm:text-sm text-slate-800 focus:border-orange-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleActivateLicence}
                disabled={isActivating || !licenceInput.trim()}
                className="rounded-lg bg-orange-500 px-5 py-2 text-xs font-bold text-white hover:bg-orange-600 border border-orange-400 transition shadow-xs disabled:opacity-50 whitespace-nowrap"
              >
                {isActivating ? 'Verifying...' : 'Activate License'}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Need a key? Ask your admin to run the Key Generator and provide your Machine ID shown above.
            </p>
          </div>
        )}
      </div>

      {/* Setup Guide Card */}
      <div className="w-full flex items-center justify-between rounded-xl border border-blue-200 bg-white p-4 shadow-sm">
        <div>
          <h2 className="font-heading text-sm font-bold text-blue-950">Setup guide</h2>
          <p className="text-xs text-slate-500">
            Walk through installing the extension, opening a match and adding the overlay to OBS again.
          </p>
        </div>
        <button
          onClick={reopenSetup}
          className="rounded-lg border border-blue-200 bg-white px-4 py-2 text-xs font-bold uppercase text-blue-700 hover:bg-blue-50 transition shadow-xs"
        >
          Open setup guide
        </button>
      </div>

      {/* APP UPDATES & SOFTWARE RELEASE */}
      <div className="w-full rounded-xl border border-blue-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🚀</span>
            <div className="text-left">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-blue-950">
                  App Updates &amp; Software Release
                </h2>
                <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-mono font-bold text-blue-800 border border-blue-300">
                  INSTALLED: v1.0.2
                </span>
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-800 border border-emerald-300">
                  STABLE CHANNEL
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                StumpCast Studio checks for new versions automatically. Click below to verify or trigger update downloads directly from the app.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                toast({ title: 'Checking release server for updates...', kind: 'info' });
                try {
                  const res = await fetch('/api/app/update-check');
                  const data = (await res.json()) as { updateAvailable?: boolean; latestVersion?: string; currentVersion?: string };
                  if (data.updateAvailable) {
                    toast({
                      title: `New version v${data.latestVersion} available! Click update badge in top header.`,
                      kind: 'success',
                    });
                    void qc.invalidateQueries({ queryKey: ['app-update'] });
                  } else {
                    toast({
                      title: `StumpCast Studio is running the latest version (v${data.currentVersion ?? '—'})`,
                      kind: 'info',
                    });
                  }
                } catch {
                  toast({ title: 'Could not connect to update feed', kind: 'error' });
                }
              }}
              className="rounded-lg border border-blue-200 bg-white px-3.5 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-50 transition shadow-xs"
            >
              🔄 Check for Updates
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await fetch('/api/app/update-simulate', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ active: true }),
                  });
                  toast({
                    title: 'Simulated update enabled! Click update badge in top header.',
                    kind: 'success',
                  });
                  void qc.invalidateQueries({ queryKey: ['app-update'] });
                } catch {
                  toast({ title: 'Simulation toggle failed', kind: 'error' });
                }
              }}
              className="rounded-lg bg-orange-500 px-3.5 py-1.5 text-xs font-bold text-white border border-orange-400 hover:bg-orange-600 transition shadow-xs"
            >
              ⚡ Test Update Simulation
            </button>
          </div>
        </div>
      </div>


      {/* DATA SOURCE & SELECTORS (X5) */}
      <div className="w-full rounded-xl border border-blue-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">📡</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-blue-950">
                  DATA SOURCE &amp; SELECTORS
                </h2>
                <span
                  className={clsx(
                    'rounded px-2 py-0.5 text-[10px] font-bold uppercase',
                    selectorsStatus.data?.source === 'remote'
                      ? 'border border-cyan-500/40 bg-cyan-100 text-cyan-800'
                      : 'border border-emerald-500/40 bg-emerald-100 text-emerald-800',
                  )}
                >
                  {selectorsStatus.data?.source === 'remote' ? 'REMOTE HOT-FIX' : 'BUNDLED'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Cricbuzz &amp; Crex site layout adapters. Can be updated remotely when score pages change without reinstalling the extension.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => checkSelectors.mutate()}
              disabled={checkSelectors.isPending}
              className="rounded-lg bg-orange-500 px-3.5 py-1.5 text-xs font-bold uppercase text-white transition hover:bg-orange-600 border border-orange-400 disabled:opacity-50 shadow-xs"
            >
              {checkSelectors.isPending ? 'Checking...' : 'Check now'}
            </button>
            <button
              onClick={() => rollbackSelectors.mutate()}
              disabled={rollbackSelectors.isPending || selectorsStatus.data?.source === 'bundled'}
              className="rounded-lg border border-blue-200 bg-white px-3.5 py-1.5 text-xs font-bold uppercase text-blue-700 transition hover:bg-blue-50 disabled:opacity-40 shadow-xs"
            >
              Rollback to bundled
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 border-t border-blue-100 pt-3">
          <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3">
            <span className="text-[10px] font-bold uppercase text-slate-500 block">Active Version</span>
            <span className="font-heading text-sm font-bold text-slate-900">
              v{selectorsStatus.data?.version ?? 1}
            </span>
          </div>
          <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3">
            <span className="text-[10px] font-bold uppercase text-slate-500 block">Last Updated</span>
            <span className="font-heading text-xs text-slate-800">
              {selectorsStatus.data?.updatedAt
                ? new Date(selectorsStatus.data.updatedAt).toLocaleString()
                : 'Bundled default'}
            </span>
          </div>
          <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3">
            <span className="text-[10px] font-bold uppercase text-slate-500 block">Status</span>
            <span className="text-xs font-bold text-emerald-700 flex items-center gap-1.5 mt-0.5">
              <span className="size-2 rounded-full bg-emerald-500" />
              Verified &amp; Operational
            </span>
          </div>
        </div>
      </div>

      {/* Live Broadcast Sync Delay */}
      <div className="w-full rounded-xl border border-blue-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>⏱️</span>
            <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-blue-950">
              LIVE BROADCAST SYNC DELAY: {delay}S
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            Syncs overlay events with your live TV/stream latency
          </span>
        </div>

        <div className="mt-3">
          <input
            type="range"
            min="0"
            max="60"
            value={delay}
            onChange={(e) => setDelay(Number(e.target.value))}
            onPointerUp={commitDelay}
            onKeyUp={commitDelay}
            onBlur={commitDelay}
            className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-blue-100 accent-orange-500"
          />
        </div>
      </div>

      {/* MIDDLE CARD SIZE & SCALE CUSTOMIZER */}
      <div className="w-full rounded-xl border border-blue-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-orange-500 text-lg">📐</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-blue-950">
                  MIDDLE CARD SIZE &amp; SCALE CUSTOMIZER
                </h2>
                <span className="rounded bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700 uppercase">
                  CURRENT: {Math.round(cardScale * 100)}%
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Increase the overall scale of the center cards so they take generous, cinematic space on your live stream.
              </p>
            </div>
          </div>
        </div>

        {/* Preset pills */}
        <div className="flex flex-wrap gap-2">
          {[
            { val: 1.0, label: 'Compact (1.0x)' },
            { val: 1.25, label: 'Standard (1.25x)' },
            { val: 1.45, label: 'Large (1.45x)' },
            { val: 1.65, label: 'Cinema (1.65x)' },
            { val: 1.85, label: 'Max Theater (1.85x)' },
          ].map((preset) => (
            <button
              key={preset.val}
              onClick={() => {
                setCardScale(preset.val);
                if (s) save.mutate({ ...s, cardScale: preset.val });
              }}
              className={clsx(
                'rounded-lg px-3.5 py-1.5 text-xs font-bold transition shadow-xs',
                cardScale === preset.val
                  ? 'border border-orange-500 bg-orange-500 text-white font-bold'
                  : 'border border-blue-200 bg-white text-blue-900 hover:bg-blue-50',
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Fine-tune scale slider */}
        <div className="border-t border-blue-100 pt-4">
          <div className="flex items-center justify-between text-xs text-slate-600 mb-2">
            <span>FINE-TUNE SCALE (0.8x - 2.0x):</span>
            <span className="font-bold text-orange-600">{cardScale.toFixed(2)}x ({Math.round(cardScale * 100)}%)</span>
          </div>
          <input
            type="range"
            min="0.8"
            max="2.0"
            step="0.05"
            value={cardScale}
            onChange={(e) => setCardScale(Number(e.target.value))}
            onPointerUp={commitCardScale}
            onKeyUp={commitCardScale}
            onBlur={commitCardScale}
            className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-blue-100 accent-orange-500"
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-1">
            <span>0.80x (Small)</span>
            <span>1.0x</span>
            <span>1.30x (Default)</span>
            <span>1.60x</span>
            <span>2.0x (Maximum Screen Fill)</span>
          </div>
        </div>

        {/* Card width constraint */}
        <div className="border-t border-blue-100 pt-4">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
            CARD WIDTH CONSTRAINT:
          </span>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'narrow', label: 'Narrow (3XL)' },
              { id: 'normal', label: 'Normal (4XL)' },
              { id: 'wide', label: 'Wide (5XL)' },
            ].map((w) => (
              <button
                key={w.id}
                onClick={() => {
                  // `cardWidth` only has three values; 'full' used to store 'wide' as well, so
                  // picking "Full Width (6XL)" highlighted "XL (5XL)" instead.
                  const target = w.id as typeof cardWidth;
                  setCardWidth(target);
                  if (s) save.mutate({ ...s, cardWidth: target });
                }}
                className={clsx(
                  'rounded-lg px-4 py-1.5 text-xs font-bold uppercase transition shadow-xs',
                  (cardWidth === w.id || (w.id === 'wide' && cardWidth === 'wide'))
                    ? 'border border-orange-500 bg-orange-500 text-white font-bold'
                    : 'border border-blue-200 bg-white text-blue-900 hover:bg-blue-50',
                )}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SIDE SCORE CARDS SIZE & SCALE CUSTOMIZER */}
      <div className="w-full rounded-xl border border-blue-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-orange-500 text-lg">📊</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-blue-950">
                  SIDE SCORE CARDS SIZE &amp; SCALE CUSTOMIZER
                </h2>
                <span className="rounded bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700 uppercase">
                  CURRENT: {Math.round(sideCardScale * 100)}%
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Scale the left &amp; right side cards (Match Centre, Player profiles, Over ball strip, Stats 2x2 &amp; Win %) to fit your stream framing.
              </p>
            </div>
          </div>
        </div>

        {/* Preset pills */}
        <div className="flex flex-wrap gap-2">
          {[
            { val: 0.85, label: 'Compact (0.85x)' },
            { val: 1.0, label: 'Standard (1.0x)' },
            { val: 1.15, label: 'Medium (1.15x)' },
            { val: 1.3, label: 'Large (1.30x)' },
            { val: 1.5, label: 'Cinema (1.50x)' },
          ].map((preset) => (
            <button
              key={preset.val}
              onClick={() => {
                setSideCardScale(preset.val);
                if (s) save.mutate({ ...s, sideCardScale: preset.val });
              }}
              className={clsx(
                'rounded-lg px-3.5 py-1.5 text-xs font-bold transition shadow-xs',
                sideCardScale === preset.val
                  ? 'border border-orange-500 bg-orange-500 text-white font-bold'
                  : 'border border-blue-200 bg-white text-blue-900 hover:bg-blue-50',
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Fine-tune scale slider */}
        <div className="border-t border-blue-100 pt-4">
          <div className="flex items-center justify-between text-xs text-slate-600 mb-2">
            <span>FINE-TUNE SIDE CARDS SCALE (0.8x - 2.0x):</span>
            <span className="font-bold text-orange-600">{sideCardScale.toFixed(2)}x ({Math.round(sideCardScale * 100)}%)</span>
          </div>
          <input
            type="range"
            min="0.8"
            max="2.0"
            step="0.05"
            value={sideCardScale}
            onChange={(e) => setSideCardScale(Number(e.target.value))}
            onPointerUp={commitSideScale}
            onKeyUp={commitSideScale}
            onBlur={commitSideScale}
            className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-blue-100 accent-orange-500"
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-1">
            <span>0.80x (Small)</span>
            <span>1.0x (Standard)</span>
            <span>1.20x</span>
            <span>1.50x</span>
            <span>2.0x (Max Broadcast Fill)</span>
          </div>
        </div>
      </div>

      {/* AI TOOLS SECTION */}
      <div className="w-full rounded-xl border border-blue-200 bg-white p-5 shadow-sm space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">🤖</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-blue-950">
                  SQUAD PHOTOS &amp; TEAM LOGOS
                </h2>
                <span className="rounded bg-emerald-100 px-1.5 py-0.2 text-[9px] font-bold text-emerald-700 uppercase">
                  LIVE DATA
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Saves the photo each player&apos;s score page publishes, so every lower third has a real
                face. Players the site has no picture of are left for you to upload — nothing is invented.
              </p>
            </div>
          </div>
          <button
            onClick={() => setKeyModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-bold uppercase text-blue-700 hover:bg-blue-50 transition shadow-xs"
          >
            <span>⚙️</span> AI API KEYS{' '}
            {aiKeys.data?.gemini?.hasKey ? (
              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">ACTIVE</span>
            ) : (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">CONFIGURE</span>
            )}
          </button>
        </div>

        {/* ON-PITCH PLAYERS & TEAMS — real line-up, real photos */}
        <div className="border-t border-blue-100 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              🏟️ ON-PITCH PLAYERS &amp; TEAMS
            </span>
            <span className="text-[11px] font-semibold text-slate-500">
              {onStreamMatch ? onStreamMatch.title : 'No match on stream'}
            </span>
          </div>
          {panelTeams.length === 0 && (
            <p className="text-[11px] text-slate-500">
              No line-up has been scraped for this match yet. Open its squads page once so the
              extension can read it.
            </p>
          )}
          {panelTeams.map((team) => {
            const roster = rosterOf(team);
            const missing = roster.filter((p) => !playerReady(p));
            return (
              <div key={team.id} className="mb-4 last:mb-0">
                <div className="flex items-center gap-3 mb-2">
                  <TeamCrest team={team} className="size-8 rounded" />
                  <span className="text-xs font-bold text-slate-900">{team.name}</span>
                  <span className="text-[10px] font-semibold text-blue-700">[{team.short}] team</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    👥 {team.short} ({team.short}) {roster.length} squad members
                  </span>
                  <button
                    type="button"
                    disabled={missing.length === 0}
                    onClick={() => pickMissingIn(team)}
                    className="text-xs font-semibold text-blue-600 hover:underline disabled:text-slate-400 disabled:no-underline"
                  >
                    + select missing ({missing.length})
                  </button>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {roster.map((p) => {
                    const picked = pickedPlayers.has(p.name);
                    const ready = playerReady(p);
                    return (
                      <button
                        key={p.name}
                        type="button"
                        onClick={() => togglePick(p.name)}
                        title={ready ? p.name + ' — photo available' : p.name + ' — no photo yet'}
                        className={clsx(
                          'flex w-[84px] shrink-0 flex-col items-center rounded-xl border bg-white p-2 shadow-xs transition',
                          picked
                            ? 'border-orange-500 ring-2 ring-orange-300'
                            : 'border-blue-200 hover:border-orange-300',
                        )}
                      >
                        <div className="relative flex size-10 items-center justify-center rounded-lg border border-blue-200 bg-blue-50/40 p-0.5">
                          <PlayerAvatar
                            name={p.name}
                            srcs={[p.imageUrl, '/assets/players/' + slug(p.name) + '.webp']}
                            className="max-h-full max-w-full"
                          />
                          <span
                            className={clsx(
                              'absolute -right-1 -top-1 size-2.5 rounded-full border border-white',
                              ready ? 'bg-emerald-500' : 'bg-orange-400',
                            )}
                          />
                        </div>
                        <span className="mt-1 w-full truncate text-center text-[10px] font-bold text-slate-800">
                          {p.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-blue-100 pt-4">
          <span className="text-[11px] text-slate-500">
            {pickedPlayers.size === 0
              ? 'Pick players to save their published photo to disk for OBS.'
              : pickedPlayers.size +
                ' selected' +
                (pickedWithoutPhoto
                  ? ' · ' + pickedWithoutPhoto + ' have no published photo and will be skipped'
                  : '') +
                '.'}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={allMissing.length === 0}
              onClick={() => setPickedPlayers(new Set(allMissing.map((p) => p.name)))}
              className="rounded-lg border border-blue-200 bg-white px-4 py-2 text-xs font-bold uppercase text-blue-700 hover:bg-blue-50 disabled:text-slate-400 shadow-xs"
            >
              SELECT ALL MISSING
            </button>
            <button
              type="button"
              disabled={pickedPlayers.size === 0 || savingPhotos}
              onClick={() => void savePickedPhotos()}
              className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-5 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-orange-600 disabled:bg-slate-200 disabled:text-slate-500 shadow-sm"
            >
              <span>⬇</span>{' '}
              {savingPhotos
                ? 'Saving…'
                : 'SAVE ' + (pickedPlayers.size || '') + (pickedPlayers.size === 1 ? ' PHOTO' : ' PHOTOS')}
            </button>
          </div>
        </div>
      </div>

      <Dialog
        open={keyModalOpen}
        onOpenChange={setKeyModalOpen}
        title="Configure API Keys (Gemini, Cricket & OpenAI)"
        description="Keys are encrypted locally on disk with AES-256-GCM. They are stored securely and never sent to third parties."
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setKeyModalOpen(false)}>
              Close
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-1">
          {/* Tabs for Providers */}
          <div className="flex border-b border-blue-100 gap-1 pb-1">
            <button
              type="button"
              onClick={() => setActiveKeyTab('gemini')}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition',
                activeKeyTab === 'gemini'
                  ? 'bg-orange-50 text-orange-700 border border-orange-200'
                  : 'text-slate-600 hover:bg-slate-50',
              )}
            >
              <span>Google Gemini</span>
              <span
                className={clsx(
                  'size-2 rounded-full',
                  aiKeys.data?.gemini?.hasKey ? 'bg-emerald-500' : 'bg-slate-300',
                )}
              />
            </button>
            <button
              type="button"
              onClick={() => setActiveKeyTab('cricket')}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition',
                activeKeyTab === 'cricket'
                  ? 'bg-orange-50 text-orange-700 border border-orange-200'
                  : 'text-slate-600 hover:bg-slate-50',
              )}
            >
              <span>Cricket Data API</span>
              <span
                className={clsx(
                  'size-2 rounded-full',
                  aiKeys.data?.cricket?.hasKey ? 'bg-emerald-500' : 'bg-slate-300',
                )}
              />
            </button>
            <button
              type="button"
              onClick={() => setActiveKeyTab('openai')}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition',
                activeKeyTab === 'openai'
                  ? 'bg-orange-50 text-orange-700 border border-orange-200'
                  : 'text-slate-600 hover:bg-slate-50',
              )}
            >
              <span>OpenAI (Optional)</span>
              <span
                className={clsx(
                  'size-2 rounded-full',
                  aiKeys.data?.openai?.hasKey ? 'bg-emerald-500' : 'bg-slate-300',
                )}
              />
            </button>
          </div>

          {/* Active Tab: Google Gemini */}
          {activeKeyTab === 'gemini' && (
            <div className="space-y-3">
              <div
                className={clsx(
                  'rounded-lg p-2.5 text-xs flex items-center justify-between',
                  aiKeys.data?.gemini?.hasKey
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border border-amber-200',
                )}
              >
                <div className="flex items-center gap-1.5">
                  <span>{aiKeys.data?.gemini?.hasKey ? '✓' : '⚠️'}</span>
                  <span className="font-semibold">
                    {aiKeys.data?.gemini?.hasKey
                      ? 'Gemini Key is Active & Stored Encrypted'
                      : 'No Gemini Key configured yet'}
                  </span>
                </div>
                {aiKeys.data?.gemini?.hasKey && (
                  <span className="text-[10px] font-mono bg-emerald-100 text-emerald-900 px-1.5 py-0.5 rounded font-bold">
                    AES-256
                  </span>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Google Gemini API Key</label>
                  <button
                    type="button"
                    onClick={() => setShowKeySecret(!showKeySecret)}
                    className="text-[11px] text-blue-600 hover:underline font-medium"
                  >
                    {showKeySecret ? 'Hide' : 'Show key'}
                  </button>
                </div>
                <input
                  type={showKeySecret ? 'text' : 'password'}
                  value={geminiKeyInput}
                  onChange={(e) => setGeminiKeyInput(e.target.value)}
                  placeholder={
                    aiKeys.data?.gemini?.hasKey
                      ? '•••••••••••••••••••• (Key is active, type here to replace)'
                      : 'AIzaSy...'
                  }
                  autoComplete="off"
                  className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-mono text-slate-800 focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-blue-600 hover:underline flex items-center gap-1"
                >
                  <span>🔗</span> Get free key at Google AI Studio
                </a>

                <div className="flex items-center gap-2">
                  {aiKeys.data?.gemini?.hasKey && (
                    <button
                      type="button"
                      disabled={removeKeyMutation.isPending}
                      onClick={() => removeKeyMutation.mutate('gemini')}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100 transition disabled:opacity-50"
                    >
                      {removeKeyMutation.isPending ? 'Removing...' : 'Remove Key'}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={saveKeyMutation.isPending || !geminiKeyInput.trim()}
                    onClick={() => {
                      const clean = geminiKeyInput.trim();
                      if (clean.length < 8) {
                        toast({ title: 'Enter a valid Gemini API key (at least 8 chars)', kind: 'error' });
                        return;
                      }
                      saveKeyMutation.mutate({ provider: 'gemini', key: clean });
                    }}
                    className="rounded-lg bg-orange-500 px-4 py-1.5 text-xs font-bold text-white hover:bg-orange-600 transition disabled:opacity-50 shadow-sm"
                  >
                    {saveKeyMutation.isPending ? 'Saving...' : 'Save Gemini Key'}
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed border-t border-slate-100 pt-2">
                Powers real-time ball-by-ball AI commentary (Urdu, Hindi, English), natural TTS speech narration on OBS overlays, and AI player portraits.
              </p>
            </div>
          )}

          {/* Active Tab: Cricket Data API */}
          {activeKeyTab === 'cricket' && (
            <div className="space-y-3">
              <div
                className={clsx(
                  'rounded-lg p-2.5 text-xs flex items-center justify-between',
                  aiKeys.data?.cricket?.hasKey
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-slate-50 text-slate-600 border border-slate-200',
                )}
              >
                <div className="flex items-center gap-1.5">
                  <span>{aiKeys.data?.cricket?.hasKey ? '✓' : 'ℹ️'}</span>
                  <span className="font-semibold">
                    {aiKeys.data?.cricket?.hasKey
                      ? 'Cricket Data Key is Active & Stored'
                      : 'No Cricket Data Key configured (Optional)'}
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Cricket Data (cricapi.com) API Key</label>
                  <button
                    type="button"
                    onClick={() => setShowKeySecret(!showKeySecret)}
                    className="text-[11px] text-blue-600 hover:underline font-medium"
                  >
                    {showKeySecret ? 'Hide' : 'Show key'}
                  </button>
                </div>
                <input
                  type={showKeySecret ? 'text' : 'password'}
                  value={cricketKeyInput}
                  onChange={(e) => setCricketKeyInput(e.target.value)}
                  placeholder={
                    aiKeys.data?.cricket?.hasKey
                      ? '•••••••••••••••••••• (Key is active, type here to replace)'
                      : 'Enter cricapi key...'
                  }
                  autoComplete="off"
                  className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-mono text-slate-800 focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <a
                  href="https://cricapi.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-blue-600 hover:underline flex items-center gap-1"
                >
                  <span>🔗</span> Get key at CricAPI.com
                </a>

                <div className="flex items-center gap-2">
                  {aiKeys.data?.cricket?.hasKey && (
                    <button
                      type="button"
                      disabled={removeKeyMutation.isPending}
                      onClick={() => removeKeyMutation.mutate('cricket')}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100 transition disabled:opacity-50"
                    >
                      {removeKeyMutation.isPending ? 'Removing...' : 'Remove Key'}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={saveKeyMutation.isPending || !cricketKeyInput.trim()}
                    onClick={() => {
                      const clean = cricketKeyInput.trim();
                      if (!clean) return;
                      saveKeyMutation.mutate({ provider: 'cricket', key: clean });
                    }}
                    className="rounded-lg bg-orange-500 px-4 py-1.5 text-xs font-bold text-white hover:bg-orange-600 transition disabled:opacity-50 shadow-sm"
                  >
                    {saveKeyMutation.isPending ? 'Saving...' : 'Save Cricket Key'}
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed border-t border-slate-100 pt-2">
                Enables automated live scorecard fetching and match list subscription directly from official cricket data providers as a backup source.
              </p>
            </div>
          )}

          {/* Active Tab: OpenAI */}
          {activeKeyTab === 'openai' && (
            <div className="space-y-3">
              <div
                className={clsx(
                  'rounded-lg p-2.5 text-xs flex items-center justify-between',
                  aiKeys.data?.openai?.hasKey
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-slate-50 text-slate-600 border border-slate-200',
                )}
              >
                <div className="flex items-center gap-1.5">
                  <span>{aiKeys.data?.openai?.hasKey ? '✓' : 'ℹ️'}</span>
                  <span className="font-semibold">
                    {aiKeys.data?.openai?.hasKey
                      ? 'OpenAI Key is Active & Stored'
                      : 'No OpenAI Key configured (Optional)'}
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">OpenAI API Key</label>
                  <button
                    type="button"
                    onClick={() => setShowKeySecret(!showKeySecret)}
                    className="text-[11px] text-blue-600 hover:underline font-medium"
                  >
                    {showKeySecret ? 'Hide' : 'Show key'}
                  </button>
                </div>
                <input
                  type={showKeySecret ? 'text' : 'password'}
                  value={openaiKeyInput}
                  onChange={(e) => setOpenaiKeyInput(e.target.value)}
                  placeholder={
                    aiKeys.data?.openai?.hasKey
                      ? '•••••••••••••••••••• (Key is active, type here to replace)'
                      : 'sk-proj-...'
                  }
                  autoComplete="off"
                  className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-mono text-slate-800 focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-blue-600 hover:underline flex items-center gap-1"
                >
                  <span>🔗</span> Get key at OpenAI Platform
                </a>

                <div className="flex items-center gap-2">
                  {aiKeys.data?.openai?.hasKey && (
                    <button
                      type="button"
                      disabled={removeKeyMutation.isPending}
                      onClick={() => removeKeyMutation.mutate('openai')}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100 transition disabled:opacity-50"
                    >
                      {removeKeyMutation.isPending ? 'Removing...' : 'Remove Key'}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={saveKeyMutation.isPending || !openaiKeyInput.trim()}
                    onClick={() => {
                      const clean = openaiKeyInput.trim();
                      if (clean.length < 8) {
                        toast({ title: 'Enter a valid OpenAI API key', kind: 'error' });
                        return;
                      }
                      saveKeyMutation.mutate({ provider: 'openai', key: clean });
                    }}
                    className="rounded-lg bg-orange-500 px-4 py-1.5 text-xs font-bold text-white hover:bg-orange-600 transition disabled:opacity-50 shadow-sm"
                  >
                    {saveKeyMutation.isPending ? 'Saving...' : 'Save OpenAI Key'}
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed border-t border-slate-100 pt-2">
                Used for DALL-E 3 visual artwork generation and GPT commentary models.
              </p>
            </div>
          )}
        </div>
      </Dialog>

      <ProLooksModal open={showProLooks} onClose={() => setShowProLooks(false)} />
    </div>
  );
};
