import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { soundsApi, type SoundOverview } from '../lib/sounds';
import { useAdmin } from '../store';
import { Button, Dialog } from '../ui';

const errText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

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
  const commQuery = useQuery({
    queryKey: ['commentary'],
    queryFn: async () => {
      const res = await fetch('/api/commentary/status');
      return (await res.json()) as {
        config: { enabled: boolean; autoEvents: boolean; rate: number; pitch: number; volume: number };
        history: Array<{ id: string; text: string; eventType?: string; timestamp: number }>;
      };
    },
    refetchInterval: 3000,
  });

  const updateCommConfig = useMutation({
    mutationFn: async (
      patch: Partial<{ enabled: boolean; autoEvents: boolean; rate: number; pitch: number; volume: number }>,
    ) => {
      const res = await fetch('/api/commentary/config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      });
      return res.json();
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['commentary'] });
    },
  });

  const speakText = useMutation({
    mutationFn: async ({ text, eventType }: { text: string; eventType?: string }) => {
      const res = await fetch('/api/commentary/speak', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, eventType }),
      });
      return res.json();
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
  const onError = (e: unknown) => toast({ title: errText(e), kind: 'error' });

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

  const handleQuickAdd = async (sampleTitle: string) => {
    try {
      await samples.mutateAsync();
      toast({ title: `Added preset: ${sampleTitle}`, kind: 'success' });
    } catch (e) {
      onError(e);
    }
  };

  const handleInstantCrowd = async (soundIdOrName: string) => {
    if (headphoneMonitor) {
      playLocalAudio(soundIdOrName, master / 100);
    }
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
      <div className="w-full flex items-center justify-between gap-3 rounded-xl border border-[#213f77] bg-[#0c1836] px-4 py-2.5">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-300">CELEBRATIONS:</span>
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
            'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition',
            autoSoundsOn
              ? 'bg-blue-600/30 border border-blue-400 text-blue-200'
              : 'bg-surface-2 border border-border text-muted',
          )}
        >
          <span className={clsx('size-2 rounded-full', autoSoundsOn ? 'bg-blue-400' : 'bg-muted')} />
          🏟️ Auto Sounds {autoSoundsOn ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Crowd Bar */}
      <div className="w-full flex flex-wrap items-center justify-center sm:justify-start gap-3 rounded-xl border border-[#213f77] bg-[#0c1836] px-4 py-2.5">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-300">CROWD:</span>
        <button
          onClick={() => handleInstantCrowd('cheer')}
          className="flex items-center gap-1.5 rounded-lg border border-[#213f77] bg-[#0e1d40] px-3 py-1 text-xs font-bold text-white transition hover:bg-[#152a5c]"
        >
          📣 Cheer
        </button>
        <button
          onClick={() => handleInstantCrowd('clap')}
          className="flex items-center gap-1.5 rounded-lg border border-[#213f77] bg-[#0e1d40] px-3 py-1 text-xs font-bold text-white transition hover:bg-[#152a5c]"
        >
          👏 Clap
        </button>
        <button
          onClick={() => handleInstantCrowd('four')}
          className="flex items-center gap-1.5 rounded-lg border border-[#213f77] bg-[#0e1d40] px-3 py-1 text-xs font-bold text-white transition hover:bg-[#152a5c]"
        >
          📯 Four
        </button>
        <button
          onClick={() => control.mutate(soundsApi.stopAll)}
          className="flex items-center gap-1.5 rounded-lg border border-red-500/50 bg-red-600/20 px-3 py-1 text-xs font-bold text-red-300 transition hover:bg-red-600/30"
        >
          🔴 Mute
        </button>
      </div>

      {/* STADIUM CROWD AUDIO STATION */}
      <div className="w-full rounded-xl border border-[#213f77] bg-[#0c1836] p-5 shadow-lg">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-blue-600/20 text-xl border border-blue-500/30">
              🔊
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading text-base font-bold uppercase tracking-wider text-white">
                  STADIUM CROWD AUDIO STATION
                </h2>
                <span className="rounded-full bg-blue-600/20 border border-blue-500/40 px-2.5 py-0.5 text-[10px] font-bold text-blue-300 uppercase tracking-wider">
                  ● LOOP ACTIVE ({loopCount} IN LOOP)
                </span>
              </div>
              <p className="text-xs text-muted">
                Multi-track stadium engine: loop up to 10 sounds continuously or fire instant crowd punches on stream.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={headphoneMonitor}
                onChange={(e) => setHeadphoneMonitor(e.target.checked)}
              />
              🎧 Monitor in Admin Headphones
            </label>
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
        <div className="mt-5 rounded-xl border border-border/60 bg-[#111a28] p-4">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-amber-400 uppercase tracking-wider">
                🎚️ MASTER CROWD VOLUME: {master}%
              </span>
            </div>
            <span className="text-muted">
              Capacity: {slots.length} / 10 slots filled
            </span>
          </div>
          <div className="mt-2 flex items-center gap-4">
            <input
              type="range"
              min="0"
              max="100"
              value={master}
              onChange={(e) => {
                const val = Number(e.target.value);
                setMaster(val);
                control.mutate(() => soundsApi.master(val / 100));
                if (settings.data) {
                  saveSettings.mutate({
                    ...settings.data,
                    sounds: {
                      ...settings.data.sounds,
                      masterVolume: val / 100,
                    },
                  });
                }
              }}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-surface-2 accent-amber-500"
            />
          </div>
        </div>

        {/* Audio Tracks Rack */}
        <div className="mt-6">
          <div className="flex items-center justify-between border-b border-border/50 pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">
              AUDIO TRACKS RACK (PERSISTENT ACROSS RELOADS)
            </span>
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
              ⚡ CLICK "PLAY INSTANT" FOR INSTANT CROWD PUNCH
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {slots.map((s, idx) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-xl border border-border/80 bg-[#111a28] p-3 transition hover:border-border"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-xs font-bold text-amber-400">
                    #{idx + 1}
                  </span>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-white truncate">{s.title}</h4>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted">
                      <span className="truncate">{s.file.replace('sounds/', '')}</span>
                      <span>•</span>
                      <label className="flex items-center gap-1 cursor-pointer text-emerald-400">
                        <input
                          type="checkbox"
                          checked={s.includeInLoop}
                          onChange={(e) => update.mutate({ id: s.id, includeInLoop: e.target.checked })}
                        />
                        Include in Loop
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <button
                    onClick={() => {
                      if (headphoneMonitor) {
                        playLocalAudio(s.file, master / 100);
                      }
                      void soundsApi.play(s.id).catch(onError);
                    }}
                    className="flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-black uppercase hover:bg-amber-400 transition"
                  >
                    💥 INSTANT
                  </button>
                  <button
                    onClick={() => setToDelete(s.id)}
                    className="flex size-7 items-center justify-center rounded-lg border border-border text-muted hover:border-red-500/50 hover:text-red-400 transition"
                    title="Delete track"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}

            {slots.length === 0 && (
              <div className="col-span-2 rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted">
                No custom sounds loaded yet. Add a track below or load quick presets.
              </div>
            )}
          </div>
        </div>

        {/* Add Audio Track Box */}
        <div className="mt-6 rounded-xl border border-border/60 bg-[#111a28] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              + ADD AUDIO TRACK ({Math.max(0, 10 - slots.length)} SLOTS REMAINING)
            </span>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted">Quick Presets:</span>
              <button
                onClick={() => handleQuickAdd('Stadium Murmur')}
                className="rounded-lg border border-border bg-surface-2 px-2.5 py-1 text-xs text-white hover:bg-surface"
              >
                + Stadium Murmur
              </button>
              <button
                onClick={() => handleQuickAdd('Roar Cheer')}
                className="rounded-lg border border-border bg-surface-2 px-2.5 py-1 text-xs text-white hover:bg-surface"
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
              className="flex-1 min-w-[240px] rounded-lg border border-border bg-[#0b1320] px-3 py-1.5 text-xs text-white"
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
              className="rounded-lg bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-black uppercase hover:bg-amber-400"
            >
              Choose File
            </button>
            <span className="text-xs text-muted truncate max-w-[140px]">
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
                className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white uppercase hover:bg-emerald-500"
              >
                Upload Track
              </button>
            )}
          </div>
        </div>
      </div>

      {/* LIVE CRICKET COMMENTARY & TTS ENGINE (E3) */}
      <div className="w-full rounded-xl border border-[#213f77] bg-[#0c1836] p-5 shadow-lg">
        <div className="flex flex-wrap items-center justify-between border-b border-border/50 pb-3 gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎙️</span>
            <div>
              <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-blue-400">
                LIVE CRICKET COMMENTARY &amp; TTS ENGINE (E3)
              </h2>
              <p className="text-xs text-muted">
                Synthesizes realistic, natural cricket commentary for OBS overlays and stream audio.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-white cursor-pointer">
              <input
                type="checkbox"
                checked={commConfig?.enabled ?? true}
                onChange={(e) => updateCommConfig.mutate({ enabled: e.target.checked })}
                className="size-4 rounded accent-blue-500"
              />
              Commentary Active
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-white cursor-pointer">
              <input
                type="checkbox"
                checked={commConfig?.autoEvents ?? true}
                onChange={(e) => updateCommConfig.mutate({ autoEvents: e.target.checked })}
                className="size-4 rounded accent-red-600"
              />
              Auto-Speak Match Events (4s, 6s, Wkts)
            </label>
          </div>
        </div>

        {/* Speed & Pitch Controls */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-border/40 pb-4">
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-muted">Speech Speed (Rate):</span>
              <span className="text-amber-400">{commConfig?.rate ?? 1.05}x</span>
            </div>
            <input
              type="range"
              min="0.7"
              max="1.5"
              step="0.05"
              value={commConfig?.rate ?? 1.05}
              onChange={(e) => updateCommConfig.mutate({ rate: Number(e.target.value) })}
              className="w-full accent-amber-500"
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-muted">Excitement Pitch:</span>
              <span className="text-amber-400">{commConfig?.pitch ?? 1.0}</span>
            </div>
            <input
              type="range"
              min="0.8"
              max="1.3"
              step="0.05"
              value={commConfig?.pitch ?? 1.0}
              onChange={(e) => updateCommConfig.mutate({ pitch: Number(e.target.value) })}
              className="w-full accent-amber-500"
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-muted">TTS Master Volume:</span>
              <span className="text-amber-400">{Math.round((commConfig?.volume ?? 1) * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={commConfig?.volume ?? 1}
              onChange={(e) => updateCommConfig.mutate({ volume: Number(e.target.value) })}
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
            className="flex-1 min-w-[280px] rounded-lg border border-border bg-[#111a28] px-3 py-2 text-xs text-white"
          />
          <button
            onClick={() => {
              if (customCommentary.trim()) speakText.mutate({ text: customCommentary });
            }}
            disabled={!customCommentary.trim() || speakText.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-black uppercase hover:bg-amber-400 disabled:opacity-50 transition"
          >
            <span>🎙️</span> SPEAK LIVE (TTS)
          </button>
        </div>

        {/* Spoken Commentary History Log */}
        {commHistory.length > 0 && (
          <div className="mt-4 rounded-lg border border-border/40 bg-[#070d17] p-3">
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider">
              Recent Spoken Commentary Feed
            </span>
            <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto">
              {commHistory.slice(0, 6).map((item) => (
                <div key={item.id} className="flex items-center justify-between text-xs border-b border-border/20 pb-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-amber-950/60 border border-amber-600/40 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 uppercase">
                      {item.eventType ?? 'LIVE'}
                    </span>
                    <span className="text-white/90">{item.text}</span>
                  </div>
                  <span className="text-[10px] text-muted">
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
