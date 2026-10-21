import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Settings } from '@stumpcast/shared';
import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, keysApi, selectorsApi } from '../lib/api';
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
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const [showProLooks, setShowProLooks] = useState(false);
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [activeKeyTab, setActiveKeyTab] = useState<'gemini' | 'cricket' | 'openai'>('gemini');
  const [geminiKeyInput, setGeminiKeyInput] = useState('');
  const [openaiKeyInput, setOpenaiKeyInput] = useState('');
  const [cricketKeyInput, setCricketKeyInput] = useState('');
  const [showKeySecret, setShowKeySecret] = useState(false);

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
            href="https://wa.me/?text=Hi%20StumpCast%2C%20I%20want%20a%20Pro%20Look"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-blue-200 bg-white px-3.5 py-1.5 text-xs font-bold text-blue-700 transition hover:bg-blue-50 shadow-xs"
          >
            GO PRO ON WHATSAPP
          </a>
        </div>
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
                      title: `StumpCast Studio is running the latest version (v${data.currentVersion ?? '1.0.4'})`,
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
                  AI IMAGE GENERATOR
                </h2>
                <span className="rounded bg-orange-100 px-1.5 py-0.2 text-[9px] font-bold text-orange-700 uppercase">
                  BETA
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Generate player portraits &amp; team logos using Gemini Imagen 3 or OpenAI DALL-E 3. Images are saved to disk and appear live on the overlay instantly.
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

        {/* AI Model Selection */}
        <div>
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span className="font-bold uppercase tracking-wider">AI GENERATION MODEL:</span>
            <span className="text-blue-600 font-semibold">Free / Low quota</span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { id: 'gemini-2.5-flash', provider: 'GEMINI', name: 'Gemini 2.5 Flash', tag: 'Key required', rec: true },
              { id: 'gemini-3.1-flash', provider: 'GEMINI', name: 'Gemini 3.1 Flash', tag: 'Key required' },
              { id: 'gemini-3-pro', provider: 'GEMINI', name: 'Gemini 3 Pro', tag: 'Key required' },
              { id: 'dalle-3', provider: 'OPENAI', name: 'DALL-E 3', tag: 'Key required' },
              { id: 'dalle-2', provider: 'OPENAI', name: 'DALL-E 2', tag: 'Key required' },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedModel(m.id)}
                className={clsx(
                  'rounded-xl border p-3 text-left transition shadow-xs',
                  selectedModel === m.id
                    ? 'border-orange-500 bg-orange-50/50 shadow-sm'
                    : 'border-blue-200 bg-white hover:border-orange-300',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">{m.provider}</span>
                  <span className="size-2 rounded-full bg-orange-400" />
                </div>
                <h4 className="mt-1 font-heading text-xs font-bold text-slate-800 truncate">{m.name}</h4>
                <p className="text-[10px] text-slate-500 mt-0.5">{m.tag}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Gemini recommendation notice */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50/60 p-3 text-xs">
          <p className="text-blue-900">
            <span className="font-bold text-blue-950">Gemini 2.5 Flash:</span> Fast, broadcast-quality portraits &amp; badges via Google AI Studio API key. (Recommended)
          </p>
          <button
            onClick={() => {
              setActiveKeyTab('gemini');
              setKeyModalOpen(true);
            }}
            className={clsx(
              'flex items-center gap-1 rounded-lg px-3 py-1 font-bold text-white uppercase transition shadow-xs',
              aiKeys.data?.gemini?.hasKey
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-orange-500 hover:bg-orange-600',
            )}
          >
            <span>{aiKeys.data?.gemini?.hasKey ? '✓' : '⚠️'}</span>{' '}
            {aiKeys.data?.gemini?.hasKey ? 'Gemini Key Active' : 'Configure Gemini Key'}
          </button>
        </div>

        {/* ON-PITCH PLAYERS & TEAMS */}
        <div className="border-t border-blue-100 pt-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              🏟️ ON-PITCH PLAYERS &amp; TEAMS
            </span>
            <span className="text-xs font-bold text-emerald-600 uppercase">2/2 READY</span>
          </div>

          <div className="flex gap-4">
            <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-white p-3 shadow-xs">
              <span className="text-2xl">🇿🇦</span>
              <div>
                <span className="text-xs font-bold text-slate-900 block">South Africa</span>
                <span className="text-[10px] text-blue-700 font-semibold">[RSA] team</span>
              </div>
              <span className="size-2 rounded-full bg-emerald-500 ml-2" />
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-white p-3 shadow-xs">
              <span className="text-2xl">🇦🇺</span>
              <div>
                <span className="text-xs font-bold text-slate-900 block">Australia</span>
                <span className="text-[10px] text-blue-700 font-semibold">[AUS] team</span>
              </div>
              <span className="size-2 rounded-full bg-emerald-500 ml-2" />
            </div>
          </div>
        </div>

        {/* Squad Selection Blocks */}
        <div className="border-t border-blue-100 pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-900">
              👥 RSA (RSA) 11 squad members
            </span>
            <button className="text-xs text-blue-600 font-semibold hover:underline">
              + select missing (3)
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {['RSA Badge', 'Aiden Markram', 'Ryan Rickelton', 'David Bedingham', 'Temba Bavuma', 'Tristan Stubbs', 'Wiaan Mulder', 'Kyle Verreynne'].map((p, i) => (
              <div key={p} className="flex flex-col items-center justify-center rounded-xl border border-blue-200 bg-white p-2 min-w-[80px] shadow-xs">
                <div className="relative">
                  <span className="text-lg">👤</span>
                  <span className={clsx('absolute -top-1 -right-1 size-2 rounded-full', i % 3 === 0 ? 'bg-orange-400' : 'bg-emerald-500')} />
                </div>
                <span className="text-[10px] font-bold text-slate-800 mt-1 text-center truncate w-full">{p}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-blue-100 pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-900">
              👥 AUS (AUS) 11 squad members
            </span>
            <button className="text-xs text-blue-600 font-semibold hover:underline">
              + select missing (5)
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {['AUS Badge', 'Travis Head', 'Nic Maddinson', 'Marnus Labuschagne', 'Steven Smith', 'Matt Renshaw', 'Alex Carey', 'Beau Webster'].map((p, i) => (
              <div key={p} className="flex flex-col items-center justify-center rounded-xl border border-blue-200 bg-white p-2 min-w-[80px] shadow-xs">
                <div className="relative">
                  <span className="text-lg">👤</span>
                  <span className={clsx('absolute -top-1 -right-1 size-2 rounded-full', i % 2 === 0 ? 'bg-orange-400' : 'bg-emerald-500')} />
                </div>
                <span className="text-[10px] font-bold text-slate-800 mt-1 text-center truncate w-full">{p}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-blue-100 pt-4">
          <span className="text-[11px] text-slate-500">
            AI cutout generation is not wired up in this build, so these stay disabled rather
            than reporting a save that never happened.
          </span>
          <div className="flex gap-2">
            <button
              disabled
              title="No server endpoint for cutout selection yet"
              className="rounded-lg border border-blue-200 bg-slate-50 px-4 py-2 text-xs font-bold uppercase text-slate-400 shadow-xs"
            >
              SELECT ALL MISSING
            </button>
            <button
              disabled
              title="No image-generation endpoint yet"
              className="flex items-center gap-1.5 rounded-lg bg-slate-200 px-5 py-2 text-xs font-bold uppercase tracking-wider text-slate-500 shadow-sm"
            >
              <span>🎨</span> GENERATE SELECTED
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
