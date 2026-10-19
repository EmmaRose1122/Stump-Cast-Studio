import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, selectorsApi } from '../lib/api';
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
  const [delay, setDelay] = useState(0);
  const [cardScale, setCardScale] = useState(1.45);
  const [sideCardScale, setSideCardScale] = useState(1.0);
  const [cardWidth, setCardWidth] = useState<'narrow' | 'normal' | 'wide'>('wide');
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const [showProLooks, setShowProLooks] = useState(false);
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [geminiKey, setGeminiKey] = useState('');

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
                  const data = (await res.json()) as { updateAvailable?: boolean; latestVersion?: string };
                  if (data.updateAvailable) {
                    toast({
                      title: `New version v${data.latestVersion} available! Click update badge in top header.`,
                      kind: 'success',
                    });
                    void qc.invalidateQueries({ queryKey: ['app-update'] });
                  } else {
                    toast({
                      title: 'StumpCast Studio is running the latest version (v1.0.2)',
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
            onChange={(e) => {
              const val = Number(e.target.value);
              setDelay(val);
              if (s) save.mutate({ ...s, syncDelaySec: val });
            }}
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
            onChange={(e) => {
              const val = Number(e.target.value);
              setCardScale(val);
              if (s) save.mutate({ ...s, cardScale: val });
            }}
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
              { id: 'normal', label: 'Wide (4XL)' },
              { id: 'wide', label: 'XL (5XL)' },
              { id: 'full', label: 'Full Width (6XL)' },
            ].map((w) => (
              <button
                key={w.id}
                onClick={() => {
                  const target = (w.id === 'full' ? 'wide' : w.id) as typeof cardWidth;
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
            onChange={(e) => {
              const val = Number(e.target.value);
              setSideCardScale(val);
              if (s) save.mutate({ ...s, sideCardScale: val });
            }}
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
            <span>⚙️</span> AI API KEYS <span className="text-orange-500">[NOT SET]</span>
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
            onClick={() => setKeyModalOpen(true)}
            className="flex items-center gap-1 rounded-lg bg-orange-500 px-3 py-1 font-bold text-white uppercase hover:bg-orange-600 transition shadow-xs"
          >
            <span>⚠️</span> Configure Gemini Key
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
          <button
            onClick={() => toast({ title: 'Selected all missing squad cutouts', kind: 'info' })}
            className="rounded-lg border border-blue-200 bg-white px-4 py-2 text-xs font-bold uppercase text-blue-700 hover:bg-blue-50 transition shadow-xs"
          >
            SELECT ALL MISSING
          </button>
          <button
            onClick={() => toast({ title: 'AI generation started for selected players', kind: 'success' })}
            className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-5 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-orange-600 border border-orange-400 shadow-sm transition"
          >
            <span>🎨</span> GENERATE SELECTED
          </button>
        </div>
      </div>

      <Dialog
        open={keyModalOpen}
        onOpenChange={setKeyModalOpen}
        title="Configure AI API Keys"
        description="Add your Google AI Studio Gemini API key or OpenAI API key to enable AI cutout portraits generation."
        actions={
          <div className="flex gap-2">
            <Button onClick={() => setKeyModalOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                setKeyModalOpen(false);
                toast({ title: 'API Key saved', kind: 'success' });
              }}
            >
              Save Key
            </Button>
          </div>
        }
      >
        <div className="space-y-3 py-2">
          <label className="text-xs font-semibold text-slate-600 block">Google Gemini API Key</label>
          <input
            type="password"
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
            placeholder="AIzaSy..."
            className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-orange-500 focus:outline-none"
          />
        </div>
      </Dialog>

      <ProLooksModal open={showProLooks} onClose={() => setShowProLooks(false)} />
    </div>
  );
};
