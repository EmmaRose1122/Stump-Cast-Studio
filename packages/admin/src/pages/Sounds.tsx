import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { monitor, listOutputDevices } from '../lib/monitor';
import { soundsApi, type SoundOverview } from '../lib/sounds';
import { useAdmin } from '../store';
import { Button, Dialog } from '../ui';

const errText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

type CommPatch = Partial<{
  enabled: boolean;
  autoEvents: boolean;
  rate: number;
  pitch: number;
  volume: number;
  language: 'hi' | 'ur' | 'en';
  ai: boolean;
}>;

/** Play audio locally in the operator's headphones using Web Audio API synthesis or HTML5 Audio */
const playLocalAudio = (typeOrUrl: string, gainLevel: number) => {
  try {
    if (typeOrUrl.includes('/') || typeOrUrl.includes('.')) {
      const audio = new Audio(typeOrUrl.startsWith('/') ? typeOrUrl : `/assets/${typeOrUrl}`);
      audio.volume = Math.max(0, Math.min(1, gainLevel));
      audio.play().catch(() => undefined);
      return;
    }

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, gainLevel * 0.8)), now);
    masterGain.connect(ctx.destination);

    if (typeOrUrl === 'horn' || typeOrUrl === 'four') {
      [261.63, 329.63, 392.0, 523.25].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now);
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.2, now + 0.05);
        g.gain.setValueAtTime(0.2, now + 0.35);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
        osc.connect(g);
        g.connect(masterGain);
        osc.start(now + idx * 0.03);
        osc.stop(now + 0.85);
      });
    } else if (typeOrUrl === 'clap') {
      for (let c = 0; c < 5; c++) {
        const t = now + c * 0.16;
        const bufferSize = Math.floor(ctx.sampleRate * 0.08);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1200, t);
        filter.Q.setValueAtTime(3, t);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.4, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
        noise.connect(filter);
        filter.connect(g);
        g.connect(masterGain);
        noise.start(t);
        noise.stop(t + 0.09);
      }
    } else {
      const bufferSize = Math.floor(ctx.sampleRate * 1.4);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let b0 = 0,
        b1 = 0,
        b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99 * b0 + white * 0.05;
        b1 = 0.95 * b1 + white * 0.1;
        b2 = 0.85 * b2 + white * 0.25;
        data[i] = (b0 + b1 + b2) * 0.4;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400, now);
      filter.frequency.exponentialRampToValueAtTime(1800, now + 0.35);
      filter.frequency.exponentialRampToValueAtTime(600, now + 1.3);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.01, now);
      g.gain.linearRampToValueAtTime(0.5, now + 0.2);
      g.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
      noise.connect(filter);
      filter.connect(g);
      g.connect(masterGain);
      noise.start(now);
      noise.stop(now + 1.4);
    }
  } catch {
    // web audio unavailable
  }
};

export const SoundsPage = () => {
  const qc = useQueryClient();
  const toast = useAdmin((s) => s.toast);
  const onError = (e: unknown) => toast({ title: errText(e), kind: 'error' });
  const q = useQuery({ queryKey: ['sounds'], queryFn: soundsApi.overview, refetchInterval: 5000 });
  const data = q.data;

  const settings = useQuery({ queryKey: ['settings'], queryFn: api.settings });
  const saveSettings = useMutation({
    mutationFn: api.saveSettings,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  const [master, setMaster] = useState(40);
  const [title, setTitle] = useState('');
  const [inLoop, setInLoop] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [headphoneMonitor, setHeadphoneMonitor] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const [customCommentary, setCustomCommentary] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const commQuery = useQuery({
    queryKey: ['commentary'],
    queryFn: async () => {
      const res = await fetch('/api/commentary/status');
      return (await res.json()) as {
        config: {
          enabled: boolean;
          autoEvents: boolean;
          rate: number;
          pitch: number;
          volume: number;
          language?: 'hi' | 'ur' | 'en';
          ai?: boolean;
        };
        history: Array<{
          id: string;
          text: string;
          eventType?: string;
          timestamp: number;
          lang?: 'hi' | 'ur' | 'en';
        }>;
        ai?: { enabled: boolean; active: boolean; hasKey: boolean };
        tts?: { engine: 'gemini' | 'system' | 'none' };
      };
    },
    refetchInterval: 3000,
  });

  const saveGeminiKey = useMutation({
    mutationFn: async (key: string | null) => {
      const res = await fetch('/api/commentary/key', {
        method: key === null ? 'DELETE' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: key === null ? undefined : JSON.stringify({ key }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new ApiError(res.status, body.error ?? `Server replied ${res.status}`);
      return body;
    },
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ['commentary'] });
      toast({
        title: vars === null ? 'Gemini key removed' : 'Gemini key saved',
        description:
          vars === null
            ? 'Commentary falls back to the built-in phrasebook.'
            : 'AI narration is live. The key is stored encrypted on this machine only.',
        kind: 'success',
      });
    },
    onError,
  });

  const updateCommConfig = useMutation({
    mutationFn: async (patch: CommPatch) => {
      const res = await fetch('/api/commentary/config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new ApiError(res.status, body.error ?? `Server replied ${res.status}`);
      return body;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['commentary'] });
    },
    onError,
  });

  const speakText = useMutation({
    mutationFn: async ({ text, eventType }: { text: string; eventType?: string }) => {
      const res = await fetch('/api/commentary/speak', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, eventType }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new ApiError(res.status, body.error ?? `Server replied ${res.status}`);
      return body;
    },
    onSuccess: (_, vars) => {
      setCustomCommentary('');
      void qc.invalidateQueries({ queryKey: ['commentary'] });
      toast({ title: '🎙️ Commentary broadcast live!', description: vars.text, kind: 'success' });
      if (headphoneMonitor && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(vars.text);
        u.volume = commQuery.data?.config?.volume ?? 1;
        u.rate = commQuery.data?.config?.rate ?? 1.05;
        window.speechSynthesis.speak(u);
      }
    },
    onError,
  });

  const commConfig = commQuery.data?.config;
  const commHistory = commQuery.data?.history ?? [];

  const autoSoundsOn = settings.data?.sounds?.autoCelebrations ?? true;

  useEffect(() => {
    if (data) setMaster(Math.round(data.master * 100));
  }, [data?.master]);

  const refresh = (o?: SoundOverview) => {
    if (o) qc.setQueryData(['sounds'], o);
    else void qc.invalidateQueries({ queryKey: ['sounds'] });
  };

  const upload = useMutation({
    mutationFn: soundsApi.upload,
    onSuccess: () => {
      setTitle('');
      setFile(null);
      setInLoop(true);
      if (fileInput.current) fileInput.current.value = '';
      refresh();
      toast({ title: 'Sound added to rack', kind: 'success' });
    },
    onError,
  });

  const samples = useMutation({
    mutationFn: soundsApi.samples,
    onSuccess: (o) => {
      refresh(o);
      toast({ title: 'Sample sounds added', kind: 'success' });
    },
    onError,
  });

  const update = useMutation({
    mutationFn: (v: { id: string; includeInLoop?: boolean; volume?: number }) =>
      soundsApi.update(v.id, { includeInLoop: v.includeInLoop, volume: v.volume }),
    onSuccess: () => refresh(),
    onError,
  });

  const remove = useMutation({
    mutationFn: soundsApi.remove,
    onSuccess: (o) => {
      refresh(o);
      setToDelete(null);
    },
    onError,
  });

  const control = useMutation({
    mutationFn: (fn: () => Promise<SoundOverview>) => fn(),
    onSuccess: (o) => refresh(o),
    onError,
  });

  const slots = data?.slots ?? [];
  const loopCount = slots.filter((s) => s.includeInLoop).length;
  const isLoopRunning = Boolean(data?.loopRunning);

  // Sliders used to PUT on every input event: a one-second drag fired dozens of concurrent
  // settings writes, the last response won, and the handle snapped back mid-drag.
  const masterSaved = useRef<number | null>(null);
  const commitMaster = () => {
    if (masterSaved.current === master) return;
    masterSaved.current = master;
    control.mutate(() => soundsApi.master(master / 100));
    if (settings.data) {
      saveSettings.mutate({
        ...settings.data,
        sounds: { ...settings.data.sounds, masterVolume: master / 100 },
      });
    }
  };

  const [commDraft, setCommDraft] = useState<CommPatch>({});
  const draftValue = (key: 'rate' | 'pitch' | 'volume', live: number) => commDraft[key] ?? live;
  const holdComm = (key: 'rate' | 'pitch' | 'volume') => (e: React.ChangeEvent<HTMLInputElement>) =>
    setCommDraft((d) => ({ ...d, [key]: Number(e.target.value) }));
  const commitComm = () => {
    if (!Object.keys(commDraft).length) return;
    updateCommConfig.mutate(commDraft);
    setCommDraft({});
  };

  // The headphone monitor existed but was never switched on, so the `sound` channel was dropped.
  const [outputs, setOutputs] = useState<{ id: string; label: string }[]>([]);
  const [outputId, setOutputId] = useState<string | null>(null);
  const switchMonitor = async (on: boolean) => {
    if (!on) {
      monitor.disable();
      setHeadphoneMonitor(false);
      return;
    }
    try {
      if (!outputs.length) setOutputs(await listOutputDevices());
      await monitor.enable(outputId);
      // Only now is the monitor actually running. Setting this first left the switch showing
      // "on" after enable() rejected, so the operator heard nothing and was not told why.
      setHeadphoneMonitor(true);
    } catch (e) {
      setHeadphoneMonitor(false);
      toast({ title: 'Headphone monitor unavailable', description: errText(e), kind: 'error' });
    }
  };
  const pickOutput = async (id: string) => {
    setOutputId(id);
    if (monitor.isEnabled) await monitor.setDevice(id);
  };

  useEffect(() => () => monitor.disable(), []);

  const handleQuickAdd = async (sampleTitle: string) => {
    try {
      await samples.mutateAsync();
      toast({ title: `Added preset: ${sampleTitle}`, kind: 'success' });
    } catch (e) {
      onError(e);
    }
  };

  const handleInstantCrowd = async (soundIdOrName: string) => {
    // With the monitor on, the operator already hears the track through the `sound` channel;
    // playing it locally as well doubled it.
    if (!headphoneMonitor) playLocalAudio(soundIdOrName, master / 100);
    const slot = slots.find(
      (s) =>
        s.title.toLowerCase().includes(soundIdOrName.toLowerCase()) ||
        s.id.toLowerCase() === soundIdOrName.toLowerCase(),
    );
    if (slot) {
      await soundsApi.play(slot.id).catch(onError);
    } else if (slots[0]) {
      await soundsApi.play(slots[0].id).catch(onError);
    } else {
      toast({ title: `Playing crowd effect: ${soundIdOrName}`, kind: 'info' });
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col items-center space-y-6">
      {/* Celebrations Bar */}
      <div className="w-full flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-white px-4 py-2.5 shadow-sm">
        <span className="text-xs font-bold uppercase tracking-wider text-blue-950">CELEBRATIONS:</span>
        <button
          onClick={() => {
            if (settings.data) {
              saveSettings.mutate({
                ...settings.data,
                sounds: {
                  ...settings.data.sounds,
                  autoCelebrations: !autoSoundsOn,
                },
              });
            }
          }}
          className={clsx(
            'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition shadow-xs',
            autoSoundsOn
              ? 'bg-orange-50 border border-orange-300 text-orange-700'
              : 'bg-white border border-blue-200 text-slate-500 hover:bg-blue-50',
          )}
        >
          <span className={clsx('size-2 rounded-full', autoSoundsOn ? 'bg-orange-500' : 'bg-slate-400')} />
          🏟️ Auto Sounds {autoSoundsOn ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Crowd Bar */}
      <div className="w-full flex flex-wrap items-center justify-center sm:justify-start gap-3 rounded-xl border border-blue-200 bg-white px-4 py-2.5 shadow-sm">
        <span className="text-xs font-bold uppercase tracking-wider text-blue-950">CROWD:</span>
        <button
          onClick={() => handleInstantCrowd('cheer')}
          className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700 transition hover:bg-rose-100 shadow-xs"
        >
          📣 Cheer
        </button>
        <button
          onClick={() => handleInstantCrowd('clap')}
          className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 transition hover:bg-amber-100 shadow-xs"
        >
          👏 Clap
        </button>
        <button
          onClick={() => handleInstantCrowd('four')}
          className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800 transition hover:bg-blue-100 shadow-xs"
        >
          📯 Four
        </button>
        <button
          onClick={() => control.mutate(soundsApi.stopAll)}
          className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold text-red-700 transition hover:bg-red-100 shadow-xs"
        >
          🔴 Mute
        </button>
      </div>

      {/* STADIUM CROWD AUDIO STATION */}
      <div className="w-full rounded-xl border border-blue-200 bg-white p-5 shadow-sm">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-orange-100 text-xl border border-orange-200 text-orange-600">
              🔊
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading text-base font-bold uppercase tracking-wider text-blue-950">
                  STADIUM CROWD AUDIO STATION
                </h2>
                <span className="rounded-full bg-orange-100 border border-orange-300 px-2.5 py-0.5 text-[10px] font-bold text-orange-700 uppercase tracking-wider">
                  ● LOOP ACTIVE ({loopCount} IN LOOP)
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Multi-track stadium engine: loop up to 10 sounds continuously or fire instant crowd punches on stream.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={headphoneMonitor}
                onChange={(e) => void switchMonitor(e.target.checked)}
              />
              🎧 Monitor in Admin Headphones
            </label>
            {headphoneMonitor && outputs.length > 0 && (
              <select
                aria-label="Monitor output device"
                value={outputId ?? ''}
                onChange={(e) => void pickOutput(e.target.value)}
                className="rounded-lg border border-blue-200 bg-white px-2 py-1 text-xs text-slate-700"
              >
                <option value="">System default</option>
                {outputs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={() => control.mutate(isLoopRunning ? soundsApi.loopStop : soundsApi.loopStart)}
              className="rounded-lg bg-red-600/80 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-red-500 flex items-center gap-1"
            >
              ■ {isLoopRunning ? 'STOP LOOP' : 'START LOOP'}
            </button>
            <button
              onClick={() => control.mutate(soundsApi.stopAll)}
              className="rounded-lg bg-rose-700/80 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-rose-600 flex items-center gap-1"
            >
              ● STOP ALL
            </button>
          </div>
        </div>

        {/* Master Crowd Volume */}
        <div className="mt-5 rounded-xl border border-blue-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-blue-950 uppercase tracking-wider">
                🎚️ MASTER CROWD VOLUME: {master}%
              </span>
            </div>
            <span className="text-slate-500 font-medium">
              Capacity: {slots.length} / 10 slots filled
            </span>
          </div>
          <div className="mt-2 flex items-center gap-4">
            <input
              type="range"
              min="0"
              max="100"
              value={master}
              onChange={(e) => setMaster(Number(e.target.value))}
              onPointerUp={commitMaster}
              onKeyUp={commitMaster}
              onBlur={commitMaster}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-blue-100 accent-orange-500"
            />
          </div>
        </div>

        {/* Audio Tracks Rack */}
        <div className="mt-6">
          <div className="flex items-center justify-between border-b border-blue-100 pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-950">
              AUDIO TRACKS RACK (PERSISTENT ACROSS RELOADS)
            </span>
            <span className="text-xs font-bold text-orange-600 uppercase tracking-wider">
              ⚡ CLICK "PLAY INSTANT" FOR INSTANT CROWD PUNCH
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {slots.map((s, idx) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-xl border border-blue-100 bg-[#f8fafc] p-3 transition hover:border-orange-400 hover:shadow-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-xs font-bold text-orange-700">
                    #{idx + 1}
                  </span>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-slate-900 truncate">{s.title}</h4>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500">
                      <span className="truncate">{s.file.replace('sounds/', '')}</span>
                      <span>•</span>
                      <label className="flex items-center gap-1 cursor-pointer text-emerald-700 font-medium">
                        <input
                          type="checkbox"
                          checked={s.includeInLoop}
                          onChange={(e) => update.mutate({ id: s.id, includeInLoop: e.target.checked })}
                          className="accent-emerald-600"
                        />
                        Include in Loop
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <button
                    onClick={() => {
                      if (!headphoneMonitor) playLocalAudio(s.file, master / 100);
                      void soundsApi.play(s.id).catch(onError);
                    }}
                    className="flex items-center gap-1 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-bold text-white uppercase hover:bg-orange-600 transition shadow-xs"
                  >
                    💥 INSTANT
                  </button>
                  <button
                    onClick={() => setToDelete(s.id)}
                    className="flex size-7 items-center justify-center rounded-lg border border-blue-200 text-slate-400 hover:border-red-400 hover:text-red-600 transition bg-white"
                    title="Delete track"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}

            {slots.length === 0 && (
              <div className="col-span-2 rounded-xl border border-dashed border-blue-200 p-6 text-center text-xs text-slate-500 bg-white">
                No custom sounds loaded yet. Add a track below or load quick presets.
              </div>
            )}
          </div>
        </div>

        {/* Add Audio Track Box */}
        <div className="mt-6 rounded-xl border border-blue-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              + ADD AUDIO TRACK ({Math.max(0, 10 - slots.length)} SLOTS REMAINING)
            </span>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">Quick Presets:</span>
              <button
                onClick={() => handleQuickAdd('Stadium Murmur')}
                className="rounded-lg border border-blue-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-900 hover:bg-blue-50 shadow-xs"
              >
                + Stadium Murmur
              </button>
              <button
                onClick={() => handleQuickAdd('Roar Cheer')}
                className="rounded-lg border border-blue-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-900 hover:bg-blue-50 shadow-xs"
              >
                + Roar Cheer
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Track Title (e.g. 6s Boundary Beat, Team Chant)..."
              className="flex-1 min-w-[240px] rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-orange-500 focus:outline-none"
            />
            <input
              ref={fileInput}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setFile(f);
                  if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''));
                }
              }}
            />
            <button
              onClick={() => fileInput.current?.click()}
              className="rounded-lg bg-white border border-blue-200 px-3.5 py-1.5 text-xs font-semibold text-blue-900 uppercase hover:bg-blue-50 shadow-xs"
            >
              Choose File
            </button>
            <span className="text-xs text-slate-500 truncate max-w-[140px]">
              {file ? file.name : 'No file chosen'}
            </span>
            {file && (
              <button
                onClick={() => {
                  if (file && title) {
                    upload.mutate({ file, title, includeInLoop: inLoop });
                  }
                }}
                disabled={upload.isPending}
                className="rounded-lg bg-orange-500 px-3.5 py-1.5 text-xs font-bold text-white uppercase hover:bg-orange-600 shadow-sm"
              >
                Upload Track
              </button>
            )}
          </div>
        </div>
      </div>

      {/* LIVE CRICKET COMMENTARY & TTS ENGINE (E3) */}
      <div className="w-full rounded-xl border border-blue-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between border-b border-blue-100 pb-3 gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎙️</span>
            <div>
              <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-blue-950">
                LIVE CRICKET COMMENTARY &amp; TTS ENGINE (E3)
              </h2>
              <p className="text-xs text-slate-500">
                Synthesizes realistic, natural cricket commentary for OBS overlays and stream audio.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={commConfig?.enabled ?? true}
                onChange={(e) => updateCommConfig.mutate({ enabled: e.target.checked })}
                className="size-4 rounded accent-orange-500"
              />
              Commentary Active
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={commConfig?.autoEvents ?? true}
                onChange={(e) => updateCommConfig.mutate({ autoEvents: e.target.checked })}
                className="size-4 rounded accent-orange-500"
              />
              Auto-Speak Match Events (4s, 6s, Wkts)
            </label>
          </div>
        </div>

        {/* Language & AI narration */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4 border-b border-border/40 pb-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted">Commentary language</label>
            <select
              value={commConfig?.language ?? 'hi'}
              onChange={(e) =>
                updateCommConfig.mutate({ language: e.target.value as 'hi' | 'ur' | 'en' })
              }
              className="w-full rounded-lg border border-border bg-white px-2 py-1.5 text-xs font-semibold"
            >
              <option value="hi">हिन्दी (Hindi — Devanagari)</option>
              <option value="ur">اردو (Urdu — Nastaliq)</option>
              <option value="en">English</option>
            </select>
            <p className="text-[10px] text-muted">
              The broadcast voice follows this script; a mismatched voice mangles the words.
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted">Voice (audio out)</label>
            <p
              className={`rounded-lg px-2 py-1.5 text-xs font-semibold ${
                commQuery.data?.tts?.engine === 'none'
                  ? 'bg-red-50 text-red-700'
                  : 'bg-emerald-50 text-emerald-700'
              }`}
            >
              {commQuery.data?.tts?.engine === 'gemini'
                ? 'Gemini voice — Urdu, Hindi, English'
                : commQuery.data?.tts?.engine === 'system'
                  ? 'This PC\'s voice — English only'
                  : 'No voice installed — captions only'}
            </p>
            <p className="text-[10px] text-muted">
              {commQuery.data?.tts?.engine === 'none'
                ? 'OBS has no speech engine of its own and this PC has no voice for this script. Add a Gemini key below to get a real voice in Urdu.'
                : 'Audio is rendered on this machine and played by the overlay.'}
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted">AI narration (Gemini)</label>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={commConfig?.ai ?? true}
                onChange={(e) => updateCommConfig.mutate({ ai: e.target.checked })}
                className="size-4 rounded accent-orange-500"
              />
              Write lines with the model
            </label>
            <p className="text-[10px] text-muted">
              {commQuery.data?.ai?.active
                ? 'Live — the model narrates each moment.'
                : commQuery.data?.ai?.hasKey
                  ? 'Key saved, but the model is not answering. Built-in lines are used.'
                  : 'No key set — using the built-in phrasebook.'}
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted">Gemini API key</label>
            <div className="flex gap-2">
              <input
                type="password"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder={commQuery.data?.ai?.hasKey ? '•••••••• (stored)' : 'AIza...'}
                className="min-w-0 flex-1 rounded-lg border border-border bg-white px-2 py-1.5 text-xs"
              />
              <button
                type="button"
                onClick={() => {
                  if (geminiKey.trim().length < 8) {
                    toast({ title: 'Enter a Gemini key (at least 8 characters)', kind: 'error' });
                    return;
                  }
                  saveGeminiKey.mutate(geminiKey.trim());
                  setGeminiKey('');
                }}
                disabled={saveGeminiKey.isPending}
                className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
              >
                Save
              </button>
              {commQuery.data?.ai?.hasKey && (
                <button
                  type="button"
                  onClick={() => saveGeminiKey.mutate(null)}
                  disabled={saveGeminiKey.isPending}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </div>
            <p className="text-[10px] text-muted">
              Stored encrypted in this app&apos;s data folder and sent only to Google.
            </p>
          </div>
        </div>

        {/* Speed & Pitch Controls */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-border/40 pb-4">
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-muted">Speech Speed (Rate):</span>
              <span className="text-amber-400">{draftValue('rate', commConfig?.rate ?? 1.05)}x</span>
            </div>
            <input
              type="range"
              min="0.7"
              max="1.5"
              step="0.05"
              value={draftValue('rate', commConfig?.rate ?? 1.05)}
              onChange={holdComm('rate')}
              onPointerUp={commitComm}
              onKeyUp={commitComm}
              onBlur={commitComm}
              className="w-full accent-amber-500"
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-muted">Excitement Pitch:</span>
              <span className="text-amber-400">{draftValue('pitch', commConfig?.pitch ?? 1.0)}</span>
            </div>
            <input
              type="range"
              min="0.8"
              max="1.3"
              step="0.05"
              value={draftValue('pitch', commConfig?.pitch ?? 1.0)}
              onChange={holdComm('pitch')}
              onPointerUp={commitComm}
              onKeyUp={commitComm}
              onBlur={commitComm}
              className="w-full accent-amber-500"
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-muted">TTS Master Volume:</span>
              <span className="text-amber-400">{Math.round(draftValue('volume', commConfig?.volume ?? 1) * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={draftValue('volume', commConfig?.volume ?? 1)}
              onChange={holdComm('volume')}
              onPointerUp={commitComm}
              onKeyUp={commitComm}
              onBlur={commitComm}
              className="w-full accent-amber-500"
            />
          </div>
        </div>

        {/* Quick Say Presets */}
        <div className="mt-4 space-y-2">
          <span className="text-xs font-bold text-muted uppercase tracking-wider">
            Quick Live Broadcast Presets
          </span>
          <div className="flex flex-wrap gap-2">
            {[
              { label: '💥 Boundary FOUR', text: 'Terrific shot! Smashed away through the covers for FOUR!', event: 'FOUR' },
              { label: '🚀 Colossal SIX', text: 'Massive hit! Clean as a whistle over deep mid-wicket for a gigantic SIX!', event: 'SIX' },
              { label: '🎯 Clean Bowled WICKET', text: 'OUT! Clean bowled! The stumps are rattled! What a breakthrough!', event: 'WICKET' },
              { label: '👏 Fifty Milestone', text: 'Fifty up! A brilliant half-century! Quality knock under pressure!', event: 'FIFTY' },
              { label: '👑 Sensational Century', text: 'Take a bow! A magnificent century! An absolute masterclass on display!', event: 'HUNDRED' },
              { label: '📊 Over Recap', text: 'End of the over. Tight bowling keeps the pressure on.', event: 'OVER_END' },
            ].map((p, idx) => (
              <button
                key={idx}
                onClick={() => speakText.mutate({ text: p.text, eventType: p.event })}
                disabled={speakText.isPending}
                className="rounded-lg border border-border/80 bg-surface-2 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500 hover:text-black hover:border-amber-400 transition"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Commentary Box */}
        <div className="mt-4 flex flex-wrap gap-2">
          <input
            value={customCommentary}
            onChange={(e) => setCustomCommentary(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && customCommentary.trim()) {
                speakText.mutate({ text: customCommentary });
              }
            }}
            placeholder="Type custom live commentary to speak over stream..."
            className="flex-1 min-w-[280px] rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-orange-500 focus:outline-none"
          />
          <button
            onClick={() => {
              if (customCommentary.trim()) speakText.mutate({ text: customCommentary });
            }}
            disabled={!customCommentary.trim() || speakText.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2 text-xs font-bold text-white uppercase hover:bg-orange-600 disabled:opacity-50 transition shadow-sm"
          >
            <span>🎙️</span> SPEAK LIVE (TTS)
          </button>
        </div>

        {/* Spoken Commentary History Log */}
        {commHistory.length > 0 && (
          <div className="mt-4 rounded-lg border border-blue-100 bg-[#f8fafc] p-3">
            <span className="text-[11px] font-bold text-blue-950 uppercase tracking-wider">
              Recent Spoken Commentary Feed
            </span>
            <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto">
              {commHistory.slice(0, 6).map((item) => (
                <div key={item.id} className="flex items-center justify-between text-xs border-b border-blue-100 pb-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-orange-100 border border-orange-200 px-1.5 py-0.5 text-[10px] font-bold text-orange-800 uppercase">
                      {item.eventType ?? 'LIVE'}
                    </span>
                    <span className="text-slate-800 font-medium">{item.text}</span>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Dialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Delete Sound"
        description="Are you sure you want to remove this sound from the rack?"
        footer={
          <div className="flex gap-2">
            <Button onClick={() => setToDelete(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (toDelete) remove.mutate(toDelete);
              }}
            >
              Delete
            </Button>
          </div>
        }
      />
    </div>
  );
};
