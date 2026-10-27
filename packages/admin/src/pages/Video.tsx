import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type LayoutPresetId, type ObsRole } from '@stumpcast/shared';
import { api, useServerOrigin } from '../lib/api';
import { assetsApi } from '../lib/assetsApi';
import { ProLooksModal } from '../shell/ProLooksModal';
import { useAdmin } from '../store';

interface ObsStatus {
  connected: boolean;
  host: string | null;
  port: number | null;
  connectedAt: number | null;
  error: string | null;
}

interface ObsSourceItem {
  name: string;
  kind: string;
}

const readJson = async <T,>(response: Response): Promise<T> => {
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `${response.status} ${response.statusText}`);
  return body;
};

const request = <T,>(url: string, method = 'GET', body?: unknown): Promise<T> =>
  fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then((response) => readJson<T>(response));

const TV_THEMES = [
  {
    id: 'none',
    name: 'LOOK DEFAULT',
    desc: 'No theme override — the active pro look drives every colour on air',
    swatches: ['#1e293b', '#475569', '#94a3b8'],
    primary: '#334155',
    accent: '#94a3b8',
    accent2: '#64748b',
    border: '#475569',
    glow: 'rgba(148, 163, 184, 0.4)',
    barBg: 'linear-gradient(90deg, #1e293b 0%, #475569 50%, #1e293b 100%)',
    live: true,
  },
  {
    id: 'orange-blue',
    name: 'ORANGE & BLUE BROADCAST',
    desc: 'StumpCast Orange, White, Blue Broadcast Theme',
    swatches: ['#ffffff', '#f97316', '#3b82f6'],
    primary: '#f97316',
    accent: '#3b82f6',
    accent2: '#f87171',
    border: '#e2e8f0',
    glow: 'rgba(59, 130, 246, 0.55)',
    barBg: 'linear-gradient(90deg, #ffffff 0%, #f97316 42%, #e2e8f0 50%, #f87171 58%, #3b82f6 100%)',
    live: true,
  },
  {
    id: 'star-sports',
    name: 'STAR SPORTS PREMIER',
    desc: 'IPL & T20 World Cup Broadcast',
    swatches: ['#091226', '#1e40af', '#f97316'],
    primary: '#1e40af',
    accent: '#f97316',
    accent2: '#3b82f6',
    border: '#3b82f6',
    glow: 'rgba(59, 130, 246, 0.55)',
    barBg: 'linear-gradient(90deg, #091226 0%, #1e40af 42%, #0b1320 50%, #c2410c 58%, #7c2d12 100%)',
    live: true,
  },
  {
    id: 'icc-gold',
    name: 'ICC GOLD CHAMPIONSHIP',
    desc: 'Official ICC World Cup Look',
    swatches: ['#18181b', '#eab308', '#06b6d4'],
    primary: '#18181b',
    accent: '#eab308',
    accent2: '#06b6d4',
    border: '#eab308',
    glow: 'rgba(234, 179, 8, 0.55)',
    barBg: 'linear-gradient(90deg, #18181b 0%, #27272a 42%, #09090b 50%, #713f12 58%, #854d0e 100%)',
  },
  {
    id: 'sky-sports',
    name: 'SKY SPORTS CARBON & CYAN',
    desc: 'Modern European Sports Look',
    swatches: ['#0f172a', '#06b6d4', '#f43f5e'],
    primary: '#0f172a',
    accent: '#06b6d4',
    accent2: '#f43f5e',
    border: '#06b6d4',
    glow: 'rgba(6, 182, 212, 0.55)',
    barBg: 'linear-gradient(90deg, #0f172a 0%, #0e7490 42%, #020617 50%, #9f1239 58%, #4c0519 100%)',
  },
  {
    id: 'supersport',
    name: 'SUPERSPORT STADIUM EMERALD',
    desc: 'South Africa & CPL Look',
    swatches: ['#064e3b', '#10b981', '#f59e0b'],
    primary: '#064e3b',
    accent: '#10b981',
    accent2: '#f59e0b',
    border: '#10b981',
    glow: 'rgba(16, 185, 129, 0.55)',
    barBg: 'linear-gradient(90deg, #064e3b 0%, #047857 42%, #022c22 50%, #78350f 58%, #451a03 100%)',
  },
  {
    id: 'willow',
    name: 'WILLOW BURGUNDY & GOLD',
    desc: 'Ashes & Classical Test Style',
    swatches: ['#450a0a', '#eab308', '#10b981'],
    primary: '#450a0a',
    accent: '#eab308',
    accent2: '#10b981',
    border: '#eab308',
    glow: 'rgba(234, 179, 8, 0.5)',
    barBg: 'linear-gradient(90deg, #450a0a 0%, #7f1d1d 42%, #1c0606 50%, #713f12 58%, #3f2207 100%)',
  },
  {
    id: 'fox-cricket',
    name: 'FOX CRICKET VELOCITY',
    desc: 'Big Bash High Voltage Design',
    swatches: ['#18181b', '#facc15', '#ef4444'],
    primary: '#18181b',
    accent: '#facc15',
    accent2: '#ef4444',
    border: '#facc15',
    glow: 'rgba(250, 204, 21, 0.55)',
    barBg: 'linear-gradient(90deg, #09090b 0%, #27272a 42%, #000000 50%, #991b1b 58%, #450a0a 100%);',
  },
  {
    id: 'cyberpunk',
    name: 'CYBERPUNK MIDNIGHT NEON',
    desc: 'Twitch & YouTube Gaming Aesthetic',
    swatches: ['#09090b', '#8b5cf6', '#22c55e'],
    primary: '#09090b',
    accent: '#8b5cf6',
    accent2: '#22c55e',
    border: '#22c55e',
    glow: 'rgba(139, 92, 246, 0.6)',
    barBg: 'linear-gradient(90deg, #09090b 0%, #4c1d95 42%, #030712 50%, #064e3b 58%, #022c22 100%)',
  },
  {
    id: 'frosted-glass',
    name: 'FROSTED GLASS MINIMALIST',
    desc: 'Clean Translucent OBS Glass',
    swatches: ['#334155', '#38bdf8', '#f8fafc'],
    primary: 'rgba(30, 41, 59, 0.7)',
    accent: '#38bdf8',
    accent2: '#f8fafc',
    border: 'rgba(56, 189, 248, 0.7)',
    glow: 'rgba(56, 189, 248, 0.45)',
    barBg: 'linear-gradient(90deg, rgba(15, 23, 42, 0.85) 0%, rgba(30, 41, 59, 0.85) 100%)',
  },
];

const STADIUM_RENDERS = [
  {
    id: 'floodlight',
    tag: 'PREMIER NIGHT',
    title: 'FLOODLIGHT NIGHT ARENA',
    desc: 'Ultra-realistic illuminated night stadium under brilliant floodlights',
    imgUrl: '/assets/backgrounds/floodlight.jpg',
    thumb: 'url("/assets/backgrounds/floodlight.jpg") center/cover no-repeat',
    onAir: true,
  },
  {
    id: 'sunset',
    tag: 'CINEMATIC TWILIGHT',
    title: 'SUNSET GOLDEN HOUR',
    desc: 'Dramatic warm amber & violet sunset skies with modern canopy',
    imgUrl: '/assets/backgrounds/sunset.jpg',
    thumb: 'url("/assets/backgrounds/sunset.jpg") center/cover no-repeat',
  },
  {
    id: 'day-champions',
    tag: 'WORLD CHAMPIONSHIP',
    title: 'DAY CHAMPIONS TROPHY',
    desc: 'Crisp azure skies, manicured field mowing patterns & packed crowds',
    imgUrl: '/assets/backgrounds/day-champions.jpg',
    thumb: 'url("/assets/backgrounds/day-champions.jpg") center/cover no-repeat',
  },
  {
    id: 'virtual-3d',
    tag: 'DARK PROCEDURAL',
    title: 'VIRTUAL 3D PITCH',
    desc: 'Procedural dark aesthetic turf with SVG floodlights & 3D field markings',
    imgUrl: '/assets/backgrounds/virtual-3d.jpg',
    thumb: 'url("/assets/backgrounds/virtual-3d.jpg") center/cover no-repeat',
  },
  {
    id: 'transparent',
    tag: 'CHROMA / ALPHA',
    title: 'TRANSPARENT (OBS MODE)',
    desc: 'Transparent backdrop for clean broadcast overlays on top of video feed',
    imgUrl: '',
    thumb: 'repeating-conic-gradient(#1e293b 0% 25%, #0f172a 0% 50%)',
  },
  {
    id: 'custom',
    tag: 'CUSTOM ASSET',
    title: 'CUSTOM STADIUM IMAGE',
    desc: 'User uploaded image or direct remote URL',
    imgUrl: '',
    thumb: 'linear-gradient(135deg, #374151 0%, #111827 100%)',
  },
];

export const VideoPage = () => {
  const qc = useQueryClient();
  const toast = useAdmin((state) => state.toast);
  const origin = useServerOrigin();
  const settings = useQuery({ queryKey: ['settings'], queryFn: api.settings });
  const video = settings.data?.video;
  const [showProLooks, setShowProLooks] = useState(false);
  const [password, setPassword] = useState('');
  const [backgroundRights] = useState(true);
  const backgroundPicker = useRef<HTMLInputElement>(null);
  const [hostDraft, setHostDraft] = useState('127.0.0.1');
  const [portDraft, setPortDraft] = useState('4455');
  const [sceneDraft, setSceneDraft] = useState('');
  const [customBgUrl, setCustomBgUrl] = useState('');
  const [activeTheme, setActiveTheme] = useState(video?.tvTheme || 'none');
  const [activeStadiumDraft, setActiveStadiumDraft] = useState<string | null>(null);
  const [cameraHostCount, setCameraHostCount] = useState<'none' | 'one' | 'two'>('none');
  const [cameraTab, setCameraTab] = useState<'webcam' | 'obs' | 'guide'>('webcam');
  const [guideStep, setGuideStep] = useState<number>(1);
  const [bgDimDraft, setBgDimDraft] = useState<number>(video?.backgroundDim ?? 0.3);

  // Direct In-Browser WebCam state
  const [webcamActive, setWebcamActive] = useState(false);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [streamRes, setStreamRes] = useState<string>('1920×1080');
  const [streamFps, setStreamFps] = useState<number>(30);
  const [mirrorVideo, setMirrorVideo] = useState<boolean>(true);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [routeToCam1, setRouteToCam1] = useState<boolean>(true);

  // OBS Mapping drafts
  const [cam1Draft, setCam1Draft] = useState('');
  const [cam2Draft, setCam2Draft] = useState('');
  const [matchVideoDraft, setMatchVideoDraft] = useState('');

  const webcamVideoRef = useRef<HTMLVideoElement | null>(null);
  const monitorCamVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const screenMapToLabel: Record<string, string> = {
    auto: 'AUTO',
    pre: 'PRE-MATCH',
    live: 'LIVE',
    innings_break: 'INN. BREAK',
    break: 'BREAK',
    result: 'RESULT',
  };
  const screenLabelToValue: Record<string, 'auto' | 'pre' | 'live' | 'innings_break' | 'break' | 'result'> = {
    'AUTO': 'auto',
    'PRE-MATCH': 'pre',
    'LIVE': 'live',
    'INN. BREAK': 'innings_break',
    'BREAK': 'break',
    'RESULT': 'result',
  };
  const currentOnAirScreen = screenMapToLabel[settings.data?.onAirScreen ?? 'auto'] ?? 'AUTO';

  const sceneMapToLabel: Record<string, string> = {
    auto: 'AUTO',
    clock: 'CLOCK / CAPTAINS',
    toss: 'TOSS',
    squad1: 'TEAM 1 SQUAD',
    squad2: 'TEAM 2 SQUAD',
  };
  const sceneLabelToValue: Record<string, 'auto' | 'clock' | 'toss' | 'squad1' | 'squad2'> = {
    'AUTO': 'auto',
    'CLOCK / CAPTAINS': 'clock',
    'TOSS': 'toss',
    'TEAM 1 SQUAD': 'squad1',
    'TEAM 2 SQUAD': 'squad2',
  };
  const currentPreMatchScene = sceneMapToLabel[settings.data?.preMatch?.scene ?? 'auto'] ?? 'AUTO';

  const [clockDraft, setClockDraft] = useState(String(settings.data?.preMatch?.clockSec ?? 90));
  const [tossDraft, setTossDraft] = useState(String(settings.data?.preMatch?.tossSec ?? 45));
  const [squad1Draft, setSquad1Draft] = useState(String(settings.data?.preMatch?.squad1Sec ?? 120));
  const [squad2Draft, setSquad2Draft] = useState(String(settings.data?.preMatch?.squad2Sec ?? 90));
  const [oversDraft, setOversDraft] = useState(settings.data?.preMatch?.matchLengthOvers ? String(settings.data.preMatch.matchLengthOvers) : '');
  const [venueDraft, setVenueDraft] = useState(settings.data?.preMatch?.venue || 'Kingsmead, Durban');

  const currentBg = video?.backgroundImage;
  const activeStadium = activeStadiumDraft !== null
    ? activeStadiumDraft
    : !currentBg || currentBg === 'transparent'
      ? 'transparent'
      : currentBg.includes('sunset')
        ? 'sunset'
        : currentBg.includes('day')
          ? 'day-champions'
          : currentBg.includes('virtual')
            ? 'virtual-3d'
            : currentBg.includes('floodlight')
              ? 'floodlight'
              : 'custom';

  // A field the operator is editing stops tracking the server until the server agrees with the
  // edit (their save landed). Without this, any unrelated settings save on the page — a theme
  // click, the dim slider — rewrote whatever was half-typed in the OBS host or cam mapping boxes.
  const dirty = useRef(new Set<string>());
  const markDirty = (k: string) => dirty.current.add(k);
  const clearDirty = (k: string) => dirty.current.delete(k);
  const lastDimSaved = useRef<number | null>(null);
  const commitDim = () => {
    if (lastDimSaved.current === bgDimDraft) return;
    lastDimSaved.current = bgDimDraft;
    saveVideo.mutate({ backgroundDim: bgDimDraft });
  };

  useEffect(() => {
    if (!video) return;
    const keep = (k: string, mine: string, live: string, apply: (v: string) => void) => {
      if (dirty.current.has(k) && mine === live) clearDirty(k);
      if (!dirty.current.has(k)) apply(live);
    };
    keep('host', hostDraft, video.obsHost, setHostDraft);
    keep('port', portDraft, String(video.obsPort), setPortDraft);
    keep('scene', sceneDraft, video.obsScene, setSceneDraft);
    if (!dirty.current.has('cameraMode')) setCameraHostCount(video.cameraMode);
    if (video.tvTheme && !dirty.current.has('tvTheme')) setActiveTheme(video.tvTheme);
    if (typeof video.backgroundDim === 'number' && !dirty.current.has('bgDim'))
      setBgDimDraft(video.backgroundDim);
    if (video.obsMap) {
      const mine = `${matchVideoDraft}|${cam1Draft}|${cam2Draft}`;
      const live = `${video.obsMap.matchVideo ?? ''}|${video.obsMap.cam1 ?? ''}|${video.obsMap.cam2 ?? ''}`;
      keep('obsMap', mine, live, (v) => {
        const [matchVideo = '', cam1 = '', cam2 = ''] = v.split('|');
        setMatchVideoDraft(matchVideo);
        setCam1Draft(cam1);
        setCam2Draft(cam2);
      });
    }
  }, [
    video?.obsHost,
    video?.obsPort,
    video?.cameraMode,
    video?.tvTheme,
    video?.backgroundDim,
    video?.obsMap,
    hostDraft,
    portDraft,
    sceneDraft,
    matchVideoDraft,
    cam1Draft,
    cam2Draft,
  ]);

  const status = useQuery({
    queryKey: ['obs-status'],
    queryFn: () => request<ObsStatus>('/api/obs/status'),
    refetchInterval: 3000,
  });

  const connected = status.data?.connected === true;

  const obsSources = useQuery({
    queryKey: ['obs-sources'],
    queryFn: () => request<ObsSourceItem[]>('/api/obs/sources'),
    enabled: connected,
    refetchInterval: connected ? 10000 : false,
  });

  const saveSettings = useMutation({
    mutationFn: api.saveSettings,
    onSuccess: (saved) => qc.setQueryData(['settings'], saved),
    onError: (error) =>
      toast({
        title: 'Could not save',
        description: error instanceof Error ? error.message : 'The server rejected the change',
        kind: 'error',
      }),
  });

  const saveVideo = useMutation({
    mutationFn: (patch: Partial<NonNullable<typeof video>>) =>
      api.saveSettings({ ...settings.data!, video: { ...settings.data!.video, ...patch } }),
    onSuccess: (saved) => qc.setQueryData(['settings'], saved),
    onError: (error) => toast({ title: error instanceof Error ? error.message : 'Could not save video settings', kind: 'error' }),
  });

  const saveObsMap = useMutation({
    mutationFn: (map: { matchVideo: string; cam1: string; cam2: string }) =>
      request<{ matchVideo: string; cam1: string; cam2: string }>('/api/obs/map', 'PUT', map),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['settings'] });
      toast({ title: 'OBS Source Mapping Saved', kind: 'success' });
    },
    onError: (error) => toast({ title: error instanceof Error ? error.message : 'Could not save OBS map', kind: 'error' }),
  });

  const connect = useMutation({
    mutationFn: () => request<ObsStatus>('/api/obs/connect', 'POST', {
      host: hostDraft,
      port: Number(portDraft),
      password: password || undefined,
    }),
    onSuccess: async () => {
      setPassword('');
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['settings'] }),
        qc.invalidateQueries({ queryKey: ['obs-status'] }),
        qc.invalidateQueries({ queryKey: ['obs-scenes'] }),
        qc.invalidateQueries({ queryKey: ['obs-sources'] }),
      ]);
      toast({ title: 'Connected to OBS Studio', kind: 'success' });
    },
    onError: (error) => toast({ title: error instanceof Error ? error.message : 'OBS connection failed', kind: 'error' }),
  });

  const disconnect = useMutation({
    mutationFn: () => request<ObsStatus>('/api/obs/disconnect', 'POST', {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['obs-status'] }),
  });

  const applyLayout = useMutation({
    mutationFn: (layoutId: LayoutPresetId) => request<{
      applied: ObsRole[];
      missing: ObsRole[];
      canvas: { width: number; height: number };
    }>('/api/obs/layout', 'POST', { layoutId, sceneName: video?.obsScene || undefined }),
    onSuccess: (result) => {
      const missing = result.missing.length ? ` · Not found: ${result.missing.join(', ')}` : '';
      toast({ title: `Layout applied to ${result.applied.length} source(s)`, description: `${result.canvas.width} × ${result.canvas.height}${missing}`, kind: result.missing.length ? 'info' : 'success' });
      void qc.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (error) => toast({ title: error instanceof Error ? error.message : 'Could not apply layout', kind: 'error' }),
  });

  const uploadBackground = useMutation({
    mutationFn: (file: File) => assetsApi.upload({ type: 'background', name: file.name.replace(/\.[^.]+$/, ''), rights: backgroundRights, file }),
    onSuccess: async (asset) => {
      setActiveStadiumDraft(asset.file);
      await saveVideo.mutateAsync({ backgroundImage: asset.file });
      toast({ title: 'Background saved and applied', kind: 'success' });
    },
    onError: (error) => toast({ title: error instanceof Error ? error.message : 'Background upload failed', kind: 'error' }),
  });

  // Direct WebCam Functions
  const stopWebcam = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioCtxRef.current) {
      void audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (webcamVideoRef.current) webcamVideoRef.current.srcObject = null;
    if (monitorCamVideoRef.current) monitorCamVideoRef.current.srcObject = null;
    setWebcamActive(false);
    setAudioLevel(0);
  }, []);

  /** Releasing only the local preview leaves cameraMode on `one`, so every overlay keeps the feed. */
  const stopCameraEverywhere = useCallback(() => {
    stopWebcam();
    setCameraHostCount('none');
    saveVideo.mutate({ cameraMode: 'none' });
    toast({ title: 'Camera stopped — Cam 1 feed is off in every window', kind: 'info' });
  }, [saveVideo, stopWebcam, toast]);

  const startWebcam = useCallback(async (devId?: string) => {
    try {
      stopWebcam();
      let stream: MediaStream | null = null;

      // Tier 1: Try requested video device + audio (ideal 1080p)
      try {
        const videoConstraint: MediaTrackConstraints = devId
          ? { deviceId: { ideal: devId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
          : { width: { ideal: 1920 }, height: { ideal: 1080 } };
        stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraint,
          audio: true,
        });
      } catch {
        // Tier 2: Try video without audio (audio lock causes "Could not start video source")
        try {
          const videoConstraint: boolean | MediaTrackConstraints = devId
            ? { deviceId: { ideal: devId } }
            : true;
          stream = await navigator.mediaDevices.getUserMedia({
            video: videoConstraint,
            audio: false,
          });
        } catch {
          // Tier 3: Generic fallback to any available video input
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }
      }

      if (!stream) throw new Error('No video stream returned by camera');
      mediaStreamRef.current = stream;

      if (webcamVideoRef.current) {
        webcamVideoRef.current.srcObject = stream;
        void webcamVideoRef.current.play().catch(() => undefined);
      }
      if (monitorCamVideoRef.current && routeToCam1) {
        monitorCamVideoRef.current.srcObject = stream;
        void monitorCamVideoRef.current.play().catch(() => undefined);
      }

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const trackSettings = videoTrack.getSettings();
        if (trackSettings.width && trackSettings.height) {
          setStreamRes(`${trackSettings.width}×${trackSettings.height}`);
        }
        if (trackSettings.frameRate) {
          setStreamFps(Math.round(trackSettings.frameRate));
        }
      }

      // Audio activity monitor (if an audio track is available)
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        try {
          const AudioCtxClass =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          if (AudioCtxClass) {
            const audioCtx = new AudioCtxClass();
            audioCtxRef.current = audioCtx;
            const source = audioCtx.createMediaStreamSource(stream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 128;
            source.connect(analyser);
            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            const updateMeter = () => {
              analyser.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) sum += dataArray[i] ?? 0;
              const avg = sum / (dataArray.length || 1);
              setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
              animFrameRef.current = requestAnimationFrame(updateMeter);
            };
            updateMeter();
          }
        } catch {
          /* audio meter fallback */
        }
      }

      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        setVideoDevices(videoInputs);
        if (!selectedDeviceId && videoInputs[0]) {
          setSelectedDeviceId(videoInputs[0].deviceId);
        }
      } catch {
        /* ignore */
      }

      setWebcamActive(true);
      if (routeToCam1) {
        setCameraHostCount('one');
        saveVideo.mutate({ cameraMode: 'one' });
      }
      toast({ title: 'WebCam Active · Routed to Cam 1 & Preview Window', kind: 'success' });
    } catch (err) {
      console.error('Camera access error:', err);
      toast({
        title: 'Could not access camera',
        description:
          'Camera may be open in OBS or another program. Close other camera apps or choose OBS Virtual Camera.',
        kind: 'error',
      });
    }
  }, [stopWebcam, routeToCam1, selectedDeviceId, saveVideo, toast]);

  useEffect(() => {
    if (monitorCamVideoRef.current) {
      monitorCamVideoRef.current.srcObject = routeToCam1 && webcamActive ? mediaStreamRef.current : null;
    }
  }, [routeToCam1, webcamActive]);

  useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, [stopWebcam]);

  if (!video) return <p className="text-sm text-muted">Loading video settings…</p>;
  const currentLayout = settings.data?.layout ?? 'arena';
  const activeThemeObj = TV_THEMES.find((t) => t.id === activeTheme) ?? TV_THEMES[0]!;
  const activeStadiumObj = STADIUM_RENDERS.find((s) => s.id === activeStadium) ?? STADIUM_RENDERS[0]!;

  // Resolve preview backdrop style for the Live Broadcast Monitor
  const getMonitorBackdropStyle = () => {
    if (activeStadium === 'transparent') {
      return {
        backgroundImage: 'repeating-conic-gradient(#1e293b 0% 25%, #0f172a 0% 50%)',
        backgroundSize: '24px 24px',
      };
    }
    let img = activeStadiumObj.imgUrl;
    if (activeStadium === 'custom' || (!img && currentBg)) {
      img = customBgUrl || currentBg || '/assets/backgrounds/floodlight.jpg';
      if (!img.startsWith('http') && !img.startsWith('/') && !img.startsWith('data:')) {
        img = `/assets/${img}`;
      }
    }
    return {
      backgroundImage: `linear-gradient(rgba(0, 0, 0, ${bgDimDraft}), rgba(0, 0, 0, ${bgDimDraft})), url("${img}")`,
      backgroundPosition: 'center',
      backgroundSize: 'cover',
      backgroundRepeat: 'no-repeat',
    };
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 flex flex-col items-center">
      {/* Pro Look Banner */}
      <div className="w-full flex flex-wrap items-center justify-between gap-4 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-surface-2 to-amber-500/5 p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400 border border-amber-500/40">
            BROADCAST ENGINE
          </span>
          <p className="text-xs text-white sm:text-sm">
            You're broadcasting with StumpCast Studio. Change TV Themes, Stadium Ambiances, and Cameras in real-time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowProLooks(true)}
            className="rounded-lg bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-black transition hover:bg-amber-400"
          >
            PRO LOOKS
          </button>
          <a
            href="/overlay"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-cyan-500/50 bg-cyan-500/20 px-3.5 py-1.5 text-xs font-bold text-cyan-300 transition hover:bg-cyan-500/30"
          >
            OPEN OVERLAY
          </a>
        </div>
      </div>

      {/* ====================================================================================
          LIVE BROADCAST STAGE MONITOR (REAL-TIME BROADCAST PREVIEW)
          ==================================================================================== */}
      <div className="w-full rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
        {/* Monitor Header Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-100 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="relative flex size-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full size-3 bg-emerald-500" />
            </span>
            <h2 className="font-heading text-sm font-bold tracking-wider text-slate-900 uppercase">
              LIVE BROADCAST STAGE MONITOR
            </h2>
            <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-900 border border-blue-200 font-mono">
              1080P · 60 FPS
            </span>
            <span className="hidden sm:inline-block rounded bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-800 border border-orange-200 uppercase">
              THEME: {activeThemeObj.name}
            </span>
            <span className="hidden sm:inline-block rounded bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-900 border border-blue-200 uppercase">
              VENUE: {activeStadiumObj.title}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                // clipboard.writeText rejects in a non-secure context or without permission;
                // the toast must say what actually happened.
                // The app chooses its own port when 4000 is taken, so ask the server where it
                // lives instead of pasting a URL OBS cannot reach.
                const copied = navigator.clipboard?.writeText(`${origin}/overlay/`);
                if (!copied) {
                  toast({ title: 'Clipboard unavailable — copy the URL from the address bar', kind: 'error' });
                  return;
                }
                copied
                  .then(() =>
                    toast({ title: 'OBS Browser Source URL copied to clipboard', kind: 'success' }),
                  )
                  .catch(() =>
                    toast({ title: 'Could not copy — copy the URL from the address bar', kind: 'error' }),
                  );
              }}
              className="rounded-lg border border-blue-200 bg-white px-3 py-1 text-xs font-semibold text-blue-900 hover:bg-blue-50 transition flex items-center gap-1.5 shadow-xs"
            >
              <span>📋</span> Copy OBS URL
            </button>
            <a
              href="/overlay?fixture=rsa-aus"
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-orange-500 px-3.5 py-1 text-xs font-bold text-white hover:bg-orange-600 transition flex items-center gap-1.5 shadow-sm"
            >
              <span>↗</span> Pop-Out Live Feed
            </a>
          </div>
        </div>

        {/* 16:9 Broadcast Canvas Chassis */}
        <div className="mt-4 flex justify-center">
          <div
            className="group relative aspect-video w-full max-w-4xl rounded-xl border-2 border-slate-700/80 overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.85)] transition-all duration-300"
            style={getMonitorBackdropStyle()}
          >
            {/* Alignment Guides Overlay */}
            {video.alignmentGuides && (
              <div className="pointer-events-none absolute inset-0 z-30 border border-dashed border-amber-500/40 m-[5%]">
                <div className="absolute inset-0 border border-dashed border-cyan-400/30 m-[5%]" />
                <div className="absolute left-1/3 top-0 bottom-0 border-l border-amber-500/20" />
                <div className="absolute right-1/3 top-0 bottom-0 border-l border-amber-500/20" />
                <div className="absolute top-1/3 left-0 right-0 border-t border-amber-500/20" />
                <div className="absolute bottom-1/3 left-0 right-0 border-t border-amber-500/20" />
                <span className="absolute top-1 left-2 text-[9px] font-mono text-amber-400/70">TITLE SAFE 90%</span>
              </div>
            )}

            {/* Broadcast Top ScoreBar (styled dynamically by active TV Theme) */}
            <div className="absolute top-3 left-4 right-4 z-20 flex justify-center pointer-events-none">
              <div
                className="w-full max-w-2xl rounded-xl px-4 py-2 flex items-center justify-between text-white transition-all duration-300"
                style={{
                  background: activeThemeObj.barBg,
                  border: `2px solid ${activeThemeObj.border}`,
                  boxShadow: `0 8px 24px rgba(0,0,0,0.8), 0 0 16px ${activeThemeObj.glow}`,
                }}
              >
                {/* Team 1 Score */}
                <div className="flex items-center gap-3">
                  <span className="rounded bg-black/60 px-2 py-0.5 text-xs font-bold tracking-wider text-amber-300 border border-white/10">
                    RSA
                  </span>
                  <span className="font-numbers text-lg font-bold leading-none text-white tracking-wide">
                    184/4
                  </span>
                  <span className="text-xs text-slate-300 font-mono">(17.2 ov)</span>
                </div>

                {/* Match Situation & TV Theme Accent Pills */}
                <div className="flex items-center gap-2 text-xs">
                  <span
                    className="rounded px-2 py-0.5 text-[10px] font-bold text-black uppercase"
                    style={{ backgroundColor: activeThemeObj.accent }}
                  >
                    NEED 32 OFF 16
                  </span>
                  <span className="text-slate-300 font-mono text-[11px]">CRR 10.61</span>
                </div>

                {/* Team 2 Opponent & Bowler */}
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-200">
                    Miller <span className="font-bold text-white">48*</span> (24)
                  </span>
                  <span className="rounded bg-black/60 px-2 py-0.5 text-xs font-bold tracking-wider text-cyan-300 border border-white/10">
                    AUS
                  </span>
                </div>
              </div>
            </div>

            {/* Arena Central Stream Frame (with dynamic layout composition & glowing borders) */}
            {currentLayout === 'arena' && (
              <div
                className={clsx(
                  'absolute z-10 rounded-xl overflow-hidden transition-all duration-300 flex flex-col',
                  video.activeObsLayout === 'A' && 'top-14 bottom-4 left-1/4 right-1/4',
                  video.activeObsLayout === 'B' && 'top-14 bottom-4 left-1/4 right-1/4',
                  video.activeObsLayout === 'C' && 'top-14 bottom-4 left-4 right-1/3',
                  video.activeObsLayout === 'D' && 'top-14 bottom-4 left-1/3 right-4',
                  video.activeObsLayout === 'E' && 'top-20 bottom-3 left-1/5 right-1/5',
                )}
                style={{
                  border: `2px solid ${activeThemeObj.border}`,
                  boxShadow: `0 0 24px ${activeThemeObj.glow}, 0 20px 40px rgba(0,0,0,0.9)`,
                  background: activeStadium === 'transparent' ? 'transparent' : 'rgba(2, 26, 16, 0.75)',
                }}
              >
                {/* Live Match Slug Badge */}
                <div
                  className="absolute top-2 left-2 z-20 flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase backdrop-blur-md"
                  style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.75)',
                    border: `1px solid ${activeThemeObj.border}`,
                    color: '#fff',
                  }}
                >
                  <span className="animate-pulse" style={{ color: activeThemeObj.accent }}>● LIVE</span>
                  <span className="text-slate-300">RSA V AUS</span>
                </div>

                {/* StumpCast Studio Brand Badge */}
                <div
                  className="absolute top-2 right-2 z-20 flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase backdrop-blur-md"
                  style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.75)',
                    border: `1px solid ${activeThemeObj.border}`,
                    color: '#fff',
                  }}
                >
                  <span className="size-1.5 rounded-full" style={{ backgroundColor: activeThemeObj.accent }} />
                  STUMPCAST STUDIO
                </div>

                {/* Match Video Viewport Content */}
                <div className="relative w-full h-full flex items-center justify-center">
                  <div className="text-center p-4">
                    <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">
                      {video.sourceMode === 'off' ? 'STADIUM BROADCAST VIEW' : 'LIVE MATCH FEED · CAPTURE CARD'}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1 font-mono">
                      Preset: {video.activeObsLayout ?? 'A'} · {activeStadiumObj.title}
                    </p>
                  </div>

                  {/* Cam Boxes inside StreamFrame */}
                  {cameraHostCount !== 'none' && (
                    <div className="absolute bottom-2 right-2 flex gap-2 z-20">
                      {/* CAM 1 Window */}
                      <div
                        className="relative w-28 h-20 rounded-lg overflow-hidden border flex items-center justify-center bg-black/80 shadow-lg"
                        style={{
                          borderColor: activeThemeObj.border,
                          boxShadow: `0 0 12px ${activeThemeObj.glow}`,
                        }}
                      >
                        {webcamActive && routeToCam1 ? (
                          <video
                            ref={monitorCamVideoRef}
                            autoPlay
                            playsInline
                            muted
                            className={clsx('w-full h-full object-cover', mirrorVideo && 'scale-x-[-1]')}
                          />
                        ) : (
                          <div className="text-center text-[10px] text-slate-300">
                            <span className="text-sm block">👤</span>
                            CAM 1
                          </div>
                        )}
                        <span
                          className="absolute bottom-1 left-1 rounded px-1 py-0.2 text-[8px] font-bold uppercase"
                          style={{
                            backgroundColor: activeThemeObj.primary,
                            color: activeThemeObj.accent,
                            border: `1px solid ${activeThemeObj.border}`,
                          }}
                        >
                          CAM 1 · HOST
                        </span>
                      </div>

                      {/* CAM 2 Window */}
                      {cameraHostCount === 'two' && (
                        <div
                          className="relative w-28 h-20 rounded-lg overflow-hidden border flex items-center justify-center bg-black/80 shadow-lg"
                          style={{
                            borderColor: activeThemeObj.border,
                            boxShadow: `0 0 12px ${activeThemeObj.glow}`,
                          }}
                        >
                          <div className="text-center text-[10px] text-slate-300">
                            <span className="text-sm block">🎙️</span>
                            CAM 2
                          </div>
                          <span
                            className="absolute bottom-1 left-1 rounded px-1 py-0.2 text-[8px] font-bold uppercase"
                            style={{
                              backgroundColor: activeThemeObj.primary,
                              color: activeThemeObj.accent,
                              border: `1px solid ${activeThemeObj.border}`,
                            }}
                          >
                            CAM 2 · CO-HOST
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Real-time Monitor Controls Bar */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-border/50 pt-3 text-xs text-muted">
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-slate-200 flex items-center gap-2">
              <span>Stadium Dimming:</span>
              <input
                type="range"
                min="0"
                max="0.8"
                step="0.05"
                value={bgDimDraft}
                onChange={(e) => {
                  markDirty('bgDim');
                  setBgDimDraft(parseFloat(e.target.value));
                }}
                onPointerUp={commitDim}
                onKeyUp={commitDim}
                onBlur={commitDim}
                className="w-28 accent-amber-500 cursor-pointer"
              />
              <span className="font-mono text-amber-400 font-bold">{Math.round(bgDimDraft * 100)}%</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
              <input
                type="checkbox"
                checked={video.alignmentGuides}
                onChange={(e) => saveVideo.mutate({ alignmentGuides: e.target.checked })}
              />
              Safe Guides Grid
            </label>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Quick Theme:</span>
            <div className="flex gap-1.5">
              {TV_THEMES.slice(0, 4).map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setActiveTheme(t.id);
                    saveVideo.mutate({ tvTheme: t.id });
                    toast({ title: `Live Theme: ${t.name}`, kind: 'success' });
                  }}
                  className={clsx(
                    'rounded px-2 py-0.5 text-[10px] font-bold uppercase transition',
                    activeTheme === t.id
                      ? 'border border-amber-400 bg-amber-400/20 text-amber-300'
                      : 'border border-border/80 bg-slate-900 text-slate-400 hover:text-white',
                  )}
                >
                  {t.name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* OVERLAY LAYOUT */}
      <div className="w-full rounded-xl border border-blue-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-blue-600 text-lg">🖼️</span>
          <div>
            <h2 className="font-heading text-base font-bold uppercase tracking-wider text-slate-900">
              OVERLAY LAYOUT
            </h2>
            <p className="text-xs text-slate-600">
              Arena (graphics + live video &amp; streamer cams), full-screen graphics, a slim TV lower-third over your own video, or the previous layout.
            </p>
          </div>
        </div>

        {/* 4 Layout options */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              id: 'arena',
              title: 'ARENA + VIDEO',
              desc: 'Big graphics around a live video window & streamer cams',
            },
            {
              id: 'fullscreen',
              title: 'FULL SCREEN',
              desc: 'Big score, player cards, auto scorecards',
            },
            {
              id: 'ticker',
              title: 'TV STRIP',
              desc: 'Slim ICC-style bar at the bottom',
            },
            {
              id: 'classic',
              title: 'CLASSIC',
              desc: 'Previous layout',
            },
          ].map((l) => (
            <button
              key={l.id}
              onClick={() => saveSettings.mutate({ ...settings.data!, layout: l.id as typeof currentLayout })}
              className={clsx(
                'rounded-xl border p-4 text-left transition',
                currentLayout === l.id
                  ? 'border-orange-500 bg-orange-50/60 shadow-xs ring-1 ring-orange-500'
                  : 'border-blue-100 bg-[#f8fafc] hover:border-orange-300',
              )}
            >
              <div className="flex items-center gap-2">
                <span className={clsx('size-2 rounded-full', currentLayout === l.id ? 'bg-orange-500' : 'bg-transparent border border-slate-400')} />
                <span className="font-heading text-sm font-bold text-slate-900">{l.title}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{l.desc}</p>
            </button>
          ))}
        </div>

        {/* On-air screen pills */}
        <div className="mt-5 border-t border-blue-100 pt-4">
          <div className="text-xs font-semibold text-slate-600">
            On-air screen — <span className="text-orange-600 font-bold">AUTO</span> picks it from the match (now: <span className="text-slate-900 font-bold">{currentOnAirScreen}</span>)
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {['AUTO', 'PRE-MATCH', 'LIVE', 'INN. BREAK', 'BREAK', 'RESULT'].map((screen) => (
              <button
                key={screen}
                onClick={() => {
                  const val = screenLabelToValue[screen] ?? 'auto';
                  if (settings.data) {
                    saveSettings.mutate(
                      { ...settings.data, onAirScreen: val },
                      {
                        onSuccess: () => toast({ title: `On-Air Screen: ${screen}`, kind: 'success' }),
                      },
                    );
                  }
                }}
                className={clsx(
                  'rounded-lg px-4 py-1.5 text-xs font-bold uppercase transition',
                  currentOnAirScreen === screen
                    ? 'border border-orange-500 bg-orange-500 text-white shadow-xs'
                    : 'border border-blue-200 bg-white text-blue-900 hover:bg-blue-50',
                )}
              >
                {screen}
              </button>
            ))}
          </div>
        </div>

        {/* Pre-match show pills & timings */}
        <div className="mt-4 border-t border-blue-100 pt-4">
          <div className="text-xs font-semibold text-slate-600">
            Pre-match show — <span className="text-orange-600 font-bold">AUTO</span> rotates by the timings below; tap a scene to show it now
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {['AUTO', 'CLOCK / CAPTAINS', 'TOSS', 'TEAM 1 SQUAD', 'TEAM 2 SQUAD'].map((scene) => (
              <button
                key={scene}
                onClick={() => {
                  const val = sceneLabelToValue[scene] ?? 'auto';
                  if (settings.data) {
                    saveSettings.mutate(
                      {
                        ...settings.data,
                        preMatch: { ...settings.data.preMatch, scene: val },
                      },
                      {
                        onSuccess: () =>
                          toast({ title: `Pre-Match Scene: ${scene}`, kind: 'success' }),
                      },
                    );
                  }
                }}
                className={clsx(
                  'rounded-lg px-4 py-1.5 text-xs font-bold uppercase transition',
                  currentPreMatchScene === scene
                    ? 'border border-orange-500 bg-orange-500 text-white shadow-xs'
                    : 'border border-blue-200 bg-white text-blue-900 hover:bg-blue-50',
                )}
              >
                {scene}
              </button>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="text-[11px] text-slate-600 block mb-1">Clock / captains (sec)</label>
              <input
                value={clockDraft}
                onChange={(e) => setClockDraft(e.target.value)}
                onBlur={() => {
                  if (settings.data) {
                    saveSettings.mutate({
                      ...settings.data,
                      preMatch: { ...settings.data.preMatch, clockSec: Number(clockDraft) || 90 },
                    });
                  }
                }}
                className="w-full rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-600 block mb-1">Toss (sec)</label>
              <input
                value={tossDraft}
                onChange={(e) => setTossDraft(e.target.value)}
                onBlur={() => {
                  if (settings.data) {
                    saveSettings.mutate({
                      ...settings.data,
                      preMatch: { ...settings.data.preMatch, tossSec: Number(tossDraft) || 45 },
                    });
                  }
                }}
                className="w-full rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-600 block mb-1">Team 1 squad (sec)</label>
              <input
                value={squad1Draft}
                onChange={(e) => setSquad1Draft(e.target.value)}
                onBlur={() => {
                  if (settings.data) {
                    saveSettings.mutate({
                      ...settings.data,
                      preMatch: { ...settings.data.preMatch, squad1Sec: Number(squad1Draft) || 120 },
                    });
                  }
                }}
                className="w-full rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-600 block mb-1">Team 2 squad (sec)</label>
              <input
                value={squad2Draft}
                onChange={(e) => setSquad2Draft(e.target.value)}
                onBlur={() => {
                  if (settings.data) {
                    saveSettings.mutate({
                      ...settings.data,
                      preMatch: { ...settings.data.preMatch, squad2Sec: Number(squad2Draft) || 90 },
                    });
                  }
                }}
                className="w-full rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-[11px] text-slate-600 block mb-1">Match length (overs) — only if not detected</label>
              <input
                value={oversDraft}
                onChange={(e) => setOversDraft(e.target.value)}
                placeholder="e.g. 20"
                onBlur={() => {
                  if (settings.data) {
                    saveSettings.mutate({
                      ...settings.data,
                      preMatch: {
                        ...settings.data.preMatch,
                        matchLengthOvers: oversDraft ? Number(oversDraft) : null,
                      },
                    });
                  }
                }}
                className="w-full rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-600 block mb-1">Venue / stadium — only if not detected</label>
              <input
                value={venueDraft}
                onChange={(e) => setVenueDraft(e.target.value)}
                onBlur={() => {
                  if (settings.data) {
                    saveSettings.mutate({
                      ...settings.data,
                      preMatch: { ...settings.data.preMatch, venue: venueDraft },
                    });
                  }
                }}
                className="w-full rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ====================================================================================
          LIVE TELEVISION COLOR SCHEME / THEMES (REAL-TIME REACTIVE)
          ==================================================================================== */}
      <div className="w-full rounded-xl border border-blue-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-orange-500 text-lg">🎨</span>
            <h2 className="font-heading text-base font-bold uppercase tracking-wider text-slate-900">
              LIVE TELEVISION COLOR SCHEME / THEMES
            </h2>
            <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-900 border border-blue-200">
              ACTIVE: {activeThemeObj.name}
            </span>
          </div>
        </div>
        <p className="mt-1 text-xs text-slate-600">
          Instant real-time broadcast color palettes. Clicking any theme applies immediately across the live broadcast monitor and OBS overlay.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TV_THEMES.map((theme) => {
            const isSelected = activeTheme === theme.id;
            return (
              <button
                key={theme.id}
                onClick={() => {
                  setActiveTheme(theme.id);
                  saveVideo.mutate({ tvTheme: theme.id });
                  toast({ title: `Live Theme Applied: ${theme.name}`, kind: 'success' });
                }}
                className={clsx(
                  'group relative rounded-xl border p-4 text-left transition-all duration-200 cursor-pointer',
                  isSelected
                    ? 'border-orange-500 bg-orange-50/60 shadow-md ring-2 ring-orange-500 scale-[1.02]'
                    : 'border-blue-100 bg-[#f8fafc] hover:border-orange-300 hover:bg-white',
                )}
              >
                {/* Color swatch bar */}
                <div className="flex h-3.5 w-full overflow-hidden rounded-md border border-slate-300 shadow-inner">
                  {theme.swatches.map((color, i) => (
                    <div key={i} className="flex-1" style={{ backgroundColor: color }} />
                  ))}
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span className="font-heading text-xs font-bold text-slate-900">{theme.name}</span>
                  {isSelected ? (
                    <span className="rounded bg-orange-500 px-1.5 py-0.2 text-[9px] font-bold text-white uppercase shadow-sm">
                      ON AIR
                    </span>
                  ) : theme.live ? (
                    <span className="rounded bg-blue-100 px-1.5 py-0.2 text-[9px] font-bold text-blue-800 uppercase border border-blue-200">
                      PRESET
                    </span>
                  ) : null}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">{theme.desc}</p>
                <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full border border-black/10 shadow-sm" style={{ backgroundColor: theme.accent }} />
                    <span className="text-slate-700 font-medium">Accent Glow</span>
                  </div>
                  <span className="font-mono text-slate-500 text-[9px]">{theme.border}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ====================================================================================
          STADIUM BACKGROUND RENDERS & AMBIANCE (REAL-TIME REACTIVE)
          ==================================================================================== */}
      <div className="w-full rounded-xl border border-blue-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-orange-500 text-lg">🏟️</span>
          <h2 className="font-heading text-base font-bold uppercase tracking-wider text-slate-900">
            STADIUM BACKGROUND RENDERS &amp; AMBIANCE
          </h2>
          <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-900 border border-blue-200">
            ACTIVE: {activeStadiumObj.title}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-600">
          Instant real-time stadium backdrop switching. Floodlights, sunset canopy, day championship, virtual procedural pitch, transparent OBS mode, or custom upload.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {STADIUM_RENDERS.map((stadium) => {
            const isSelected = activeStadium === stadium.id;
            return (
              <button
                key={stadium.id}
                onClick={() => {
                  const bgVal = stadium.id === 'transparent' ? 'transparent' : stadium.id;
                  setActiveStadiumDraft(stadium.id);
                  saveVideo.mutate({ backgroundImage: bgVal });
                  toast({ title: `Stadium Applied: ${stadium.title}`, kind: 'success' });
                }}
                className={clsx(
                  'group relative rounded-xl border p-2 text-left transition-all duration-200 cursor-pointer',
                  isSelected
                    ? 'border-orange-500 bg-orange-50/60 shadow-md ring-2 ring-orange-500 scale-[1.03]'
                    : 'border-blue-100 bg-[#f8fafc] hover:border-orange-300 hover:bg-white',
                )}
              >
                <div
                  className="relative aspect-video w-full rounded-lg border border-blue-100 flex items-center justify-center overflow-hidden"
                  style={{ background: stadium.thumb }}
                >
                  <span className="absolute top-1 left-1 rounded bg-black/80 px-1 py-0.2 text-[8px] font-bold uppercase text-white backdrop-blur-sm">
                    {stadium.tag}
                  </span>
                  {isSelected ? (
                    <span className="absolute top-1 right-1 rounded bg-orange-500 px-1 py-0.2 text-[8px] font-bold uppercase text-white shadow-sm">
                      ACTIVE
                    </span>
                  ) : stadium.onAir ? (
                    <span className="absolute top-1 right-1 rounded bg-blue-600 px-1 py-0.2 text-[8px] font-bold uppercase text-white">
                      DEFAULT
                    </span>
                  ) : null}
                </div>
                <h4 className="mt-2 text-xs font-bold text-slate-900 truncate">{stadium.title}</h4>
                <p className="text-[10px] text-slate-500 line-clamp-2 mt-0.5">{stadium.desc}</p>
              </button>
            );
          })}
        </div>

        {/* Direct image URL + upload button */}
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-blue-100 pt-4">
          <div className="flex-1 min-w-[280px] flex items-center gap-2">
            <span className="text-xs text-slate-600">🔗 DIRECT IMAGE URL:</span>
            <input
              value={customBgUrl}
              onChange={(e) => setCustomBgUrl(e.target.value)}
              placeholder="https://example.com/stadium.jpg or /assets/backgrounds/custom.jpg"
              className="flex-1 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-orange-500 focus:outline-none"
            />
            <button
              onClick={() => {
                if (customBgUrl) {
                  setActiveStadiumDraft('custom');
                  saveVideo.mutate({ backgroundImage: customBgUrl });
                  toast({ title: 'Custom Background URL Applied', kind: 'success' });
                }
              }}
              className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-bold text-white uppercase hover:bg-orange-600 cursor-pointer shadow-sm"
            >
              APPLY URL
            </button>
          </div>
          <span className="text-xs text-slate-500">OR</span>
          <input
            ref={backgroundPicker}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) uploadBackground.mutate(file);
            }}
          />
          <button
            onClick={() => backgroundPicker.current?.click()}
            className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white uppercase hover:bg-blue-500 flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <span>📁</span> UPLOAD STADIUM FILE
          </button>
        </div>
      </div>

      {/* ====================================================================================
          VIDEO & STREAMER CAMS (ADD YOUR CAMERA UPGRADED SUITE)
          ==================================================================================== */}
      <div className="w-full rounded-xl border border-blue-200 bg-white p-5 shadow-sm space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-orange-500 text-lg">📹</span>
            <div>
              <h2 className="font-heading text-base font-bold uppercase tracking-wider text-slate-900">
                VIDEO &amp; STREAMER CAMS STUDIO
              </h2>
              <p className="text-xs text-slate-600">
                Add your webcam or capture card into StumpCast Studio. Route live streams directly into broadcast scenes A–E.
              </p>
            </div>
          </div>

          {/* Camera tab navigation */}
          <div className="flex rounded-lg border border-blue-200 bg-blue-50/60 p-1">
            <button
              onClick={() => setCameraTab('webcam')}
              className={clsx(
                'rounded-md px-3 py-1 text-xs font-bold uppercase transition',
                cameraTab === 'webcam' ? 'bg-orange-500 text-white shadow-xs' : 'text-blue-900 hover:bg-white',
              )}
            >
              🌐 Direct WebCam
            </button>
            <button
              onClick={() => setCameraTab('obs')}
              className={clsx(
                'rounded-md px-3 py-1 text-xs font-bold uppercase transition',
                cameraTab === 'obs' ? 'bg-orange-500 text-white shadow-xs' : 'text-blue-900 hover:bg-white',
              )}
            >
              🎛️ OBS Role Mapping
            </button>
            <button
              onClick={() => setCameraTab('guide')}
              className={clsx(
                'rounded-md px-3 py-1 text-xs font-bold uppercase transition',
                cameraTab === 'guide' ? 'bg-orange-500 text-white shadow-xs' : 'text-blue-900 hover:bg-white',
              )}
            >
              📘 4-Step Setup Guide
            </button>
          </div>
        </div>

        {/* TAB 1: DIRECT IN-BROWSER WEBCAM STUDIO */}
        {cameraTab === 'webcam' && (
          <div className="rounded-xl border border-blue-100 bg-[#f8fafc] p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm">📷</span>
                <span className="text-sm font-bold text-slate-900 uppercase tracking-wider">Browser WebCam / USB Device Studio</span>
                <span className={clsx('rounded px-2 py-0.5 text-[10px] font-bold uppercase', webcamActive ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-200 text-slate-700')}>
                  {webcamActive ? '● CAMERA ON-AIR' : 'CAMERA STANDBY'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {!webcamActive ? (
                  <button
                    onClick={() => void startWebcam(selectedDeviceId)}
                    className="rounded-lg bg-orange-500 px-4 py-1.5 text-xs font-bold text-white uppercase hover:bg-orange-600 transition shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>▶</span> Turn On WebCam Preview
                  </button>
                ) : (
                  <button
                    onClick={stopCameraEverywhere}
                    className="rounded-lg bg-rose-600 px-4 py-1.5 text-xs font-bold text-white uppercase hover:bg-rose-500 transition shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>⏹</span> Stop Camera
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              {/* WebCam Video Display */}
              <div className="relative aspect-video w-full rounded-xl bg-black border border-slate-700/80 overflow-hidden flex items-center justify-center shadow-lg">
                <video
                  ref={webcamVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={clsx('w-full h-full object-cover', mirrorVideo && 'scale-x-[-1]', !webcamActive && 'hidden')}
                />
                {!webcamActive && (
                  <div className="text-center p-6 text-slate-400">
                    <span className="text-3xl block mb-2 opacity-60">📹</span>
                    <p className="text-xs font-bold text-slate-200">WebCam is currently turned off</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Click "Turn On WebCam Preview" to test your USB camera, virtual cam, or capture card.
                    </p>
                  </div>
                )}

                {/* On-video HUD metrics */}
                {webcamActive && (
                  <div className="absolute top-2 left-2 flex items-center gap-1.5 rounded bg-black/75 px-2 py-0.5 text-[9px] font-mono font-bold text-white backdrop-blur-sm border border-white/10">
                    <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {streamRes} · {streamFps} FPS
                  </div>
                )}
              </div>

              {/* WebCam Controls & Configuration */}
              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">Select Video Device / Camera</label>
                  <select
                    value={selectedDeviceId}
                    onChange={(e) => {
                      setSelectedDeviceId(e.target.value);
                      if (webcamActive) void startWebcam(e.target.value);
                    }}
                    className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-orange-500 focus:outline-none"
                  >
                    {videoDevices.length === 0 ? (
                      <option value="">Default / Integrated WebCam</option>
                    ) : (
                      videoDevices.map((d, i) => (
                        <option key={d.deviceId || i} value={d.deviceId}>
                          {d.label || `Camera ${i + 1}`}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-slate-700 cursor-pointer font-medium">
                    <input
                      type="checkbox"
                      checked={mirrorVideo}
                      onChange={(e) => setMirrorVideo(e.target.checked)}
                      className="accent-orange-500"
                    />
                    Mirror Video (Selfie Mode)
                  </label>

                  <label className="flex items-center gap-2 text-slate-700 cursor-pointer font-medium">
                    <input
                      type="checkbox"
                      checked={routeToCam1}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setRouteToCam1(checked);
                        if (!checked) {
                          // Unrouting has to stop the local monitor as well as the on-air feed.
                          stopCameraEverywhere();
                          return;
                        }
                        setCameraHostCount('one');
                        saveVideo.mutate({ cameraMode: 'one' });
                        toast({
                          title: 'WebCam Routed to Cam 1 & Broadcast',
                          kind: 'info',
                        });
                      }}
                      className="accent-orange-500"
                    />
                    Route WebCam into Cam 1 Monitor Window &amp; OBS
                  </label>
                </div>

                {/* Audio Level Meter */}
                <div>
                  <div className="flex justify-between text-[11px] text-slate-600 mb-1">
                    <span>Microphone Activity Meter</span>
                    <span className="font-mono text-orange-600 font-bold">{audioLevel}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden border border-slate-300">
                    <div
                      className={clsx(
                        'h-full transition-all duration-75',
                        audioLevel > 75 ? 'bg-rose-500' : audioLevel > 40 ? 'bg-orange-500' : 'bg-emerald-500',
                      )}
                      style={{ width: `${audioLevel}%` }}
                    />
                  </div>
                </div>

                <div className="rounded-lg bg-blue-50 border border-blue-200 p-2.5 text-[11px] text-blue-900">
                  💡 <strong>Tip:</strong> Once active, this webcam feed streams directly into your Cam 1 box on the Stage Monitor above. You can also use OBS Virtual Camera here!
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: OBS SOURCES ROLE MAPPING */}
        {cameraTab === 'obs' && (
          <div className="rounded-xl border border-blue-200 bg-white p-4 space-y-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm">🎛️</span>
                <span className="text-sm font-bold text-slate-900 uppercase tracking-wider">OBS Source Role Mapping</span>
                <span className={clsx('rounded px-2 py-0.5 text-[10px] font-bold uppercase', connected ? 'text-emerald-700 bg-emerald-50 border border-emerald-300' : 'text-slate-500 bg-slate-100 border border-slate-200')}>
                  {connected ? '● OBS CONNECTED' : '○ OBS DISCONNECTED'}
                </span>
              </div>
              <button
                onClick={() => void qc.invalidateQueries({ queryKey: ['obs-sources'] })}
                className="rounded-lg border border-blue-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
              >
                🔄 Refresh OBS Sources
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Map your OBS video sources to StumpCast Studio broadcast roles. StumpCast will automatically move and resize these sources during scene transitions.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* CAM 1 Mapping */}
              <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                  <span className="size-2.5 rounded-full bg-blue-500" />
                  CAM 1 (Host 1 Source)
                </div>
                {connected && obsSources.data && obsSources.data.length > 0 ? (
                  <select
                    value={cam1Draft}
                    onChange={(e) => {
                      markDirty('obsMap');
                      setCam1Draft(e.target.value);
                    }}
                    className="w-full rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-orange-500"
                  >
                    <option value="">-- Choose OBS Source --</option>
                    {obsSources.data.map((src) => (
                      <option key={src.name} value={src.name}>
                        {src.name} ({src.kind})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={cam1Draft}
                    onChange={(e) => {
                      markDirty('obsMap');
                      setCam1Draft(e.target.value);
                    }}
                    placeholder="e.g. Streamer Cam 1"
                    className="w-full rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                )}
                <span className="text-[10px] text-slate-500 block">Primary commentator webcam source in OBS</span>
              </div>

              {/* CAM 2 Mapping */}
              <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                  <span className="size-2.5 rounded-full bg-red-500" />
                  CAM 2 (2nd Host / Guest)
                </div>
                {connected && obsSources.data && obsSources.data.length > 0 ? (
                  <select
                    value={cam2Draft}
                    onChange={(e) => {
                      markDirty('obsMap');
                      setCam2Draft(e.target.value);
                    }}
                    className="w-full rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-orange-500"
                  >
                    <option value="">-- Choose OBS Source --</option>
                    {obsSources.data.map((src) => (
                      <option key={src.name} value={src.name}>
                        {src.name} ({src.kind})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={cam2Draft}
                    onChange={(e) => {
                      markDirty('obsMap');
                      setCam2Draft(e.target.value);
                    }}
                    placeholder="e.g. Streamer Cam 2 / Discord"
                    className="w-full rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                )}
                <span className="text-[10px] text-slate-500 block">Second commentator or remote guest video</span>
              </div>

              {/* MATCH VIDEO Mapping */}
              <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                  <span className="size-2.5 rounded-full bg-emerald-500" />
                  MATCH VIDEO SOURCE
                </div>
                {connected && obsSources.data && obsSources.data.length > 0 ? (
                  <select
                    value={matchVideoDraft}
                    onChange={(e) => {
                      markDirty('obsMap');
                      setMatchVideoDraft(e.target.value);
                    }}
                    className="w-full rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-orange-500"
                  >
                    <option value="">-- Choose OBS Source --</option>
                    {obsSources.data.map((src) => (
                      <option key={src.name} value={src.name}>
                        {src.name} ({src.kind})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={matchVideoDraft}
                    onChange={(e) => {
                      markDirty('obsMap');
                      setMatchVideoDraft(e.target.value);
                    }}
                    placeholder="e.g. Capture Card / Game Feed"
                    className="w-full rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                )}
                <span className="text-[10px] text-slate-500 block">Live match gameplay or capture card source</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => {
                  saveObsMap.mutate({
                    matchVideo: matchVideoDraft,
                    cam1: cam1Draft,
                    cam2: cam2Draft,
                  });
                }}
                disabled={saveObsMap.isPending}
                className="rounded-lg bg-orange-500 hover:bg-orange-600 px-5 py-2 text-xs font-bold text-white uppercase transition shadow-md cursor-pointer disabled:opacity-50"
              >
                💾 SAVE OBS ROLE MAPPING
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: STEP-BY-STEP 4-STAGE SETUP GUIDE */}
        {cameraTab === 'guide' && (
          <div className="rounded-xl border border-blue-200 bg-white p-4 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-blue-100 pb-3">
              <div>
                <h3 className="font-heading text-sm font-bold text-slate-900">4-Step Camera Setup Wizard</h3>
                <p className="text-xs text-slate-500">Complete these 4 simple steps to connect your camera with StumpCast Studio.</p>
              </div>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4].map((step) => (
                  <button
                    key={step}
                    onClick={() => setGuideStep(step)}
                    className={clsx(
                      'size-7 rounded-lg text-xs font-bold transition cursor-pointer',
                      guideStep === step
                        ? 'bg-orange-500 text-white shadow-sm'
                        : 'border border-blue-200 bg-white text-slate-600 hover:bg-blue-50',
                    )}
                  >
                    {step}
                  </button>
                ))}
              </div>
            </div>

            {/* Guide Step 1 */}
            {guideStep === 1 && (
              <div className="rounded-lg bg-blue-50/60 border border-blue-100 p-4 text-xs space-y-2">
                <span className="font-bold text-blue-900 text-sm">Step 1: Turn on OBS WebSocket Remote Control</span>
                <p className="text-slate-700">
                  Open OBS Studio. In the top menu, go to <strong>Tools → WebSocket Server Settings</strong>.
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-600 pl-2">
                  <li>Tick <strong className="text-slate-900">"Enable WebSocket server"</strong>.</li>
                  <li>Ensure Server Port is set to <code className="text-orange-600 font-bold">4455</code>.</li>
                  <li>Click <strong className="text-slate-900">"Apply"</strong> and <strong className="text-slate-900">"OK"</strong>.</li>
                </ul>
                <div className="pt-2">
                  <button
                    onClick={() => setGuideStep(2)}
                    className="rounded-lg bg-orange-500 hover:bg-orange-600 px-4 py-1.5 text-xs font-bold text-white uppercase shadow-sm cursor-pointer"
                  >
                    Next: Step 2 →
                  </button>
                </div>
              </div>
            )}

            {/* Guide Step 2 */}
            {guideStep === 2 && (
              <div className="rounded-lg bg-blue-50/60 border border-blue-100 p-4 text-xs space-y-2">
                <span className="font-bold text-blue-900 text-sm">Step 2: Add your Camera Source in OBS</span>
                <p className="text-slate-700">
                  Inside OBS Studio, locate the <strong>Sources</strong> dock at the bottom:
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-600 pl-2">
                  <li>Click the <strong>+ (Add Source)</strong> button.</li>
                  <li>Select <strong>"Video Capture Device"</strong>.</li>
                  <li>Name it <code className="text-blue-700 font-bold">Streamer Cam 1</code>.</li>
                  <li>Choose your webcam model from the device dropdown and click OK.</li>
                </ul>
                <div className="flex gap-2 pt-2">
                  <button onClick={() => setGuideStep(1)} className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-blue-50 cursor-pointer">
                    ← Back
                  </button>
                  <button onClick={() => setGuideStep(3)} className="rounded-lg bg-orange-500 hover:bg-orange-600 px-4 py-1.5 text-xs font-bold text-white uppercase shadow-sm cursor-pointer">
                    Next: Step 3 →
                  </button>
                </div>
              </div>
            )}

            {/* Guide Step 3 */}
            {guideStep === 3 && (
              <div className="rounded-lg bg-blue-50/60 border border-blue-100 p-4 text-xs space-y-2">
                <span className="font-bold text-blue-900 text-sm">Step 3: Link Source to StumpCast Studio</span>
                <p className="text-slate-700">
                  Switch to the <strong>OBS Role Mapping</strong> tab above:
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-600 pl-2">
                  <li>Under <strong>CAM 1 (Host 1 Source)</strong>, select <code className="text-blue-700 font-bold">Streamer Cam 1</code>.</li>
                  <li>Click <strong>"Save OBS Role Mapping"</strong>.</li>
                  <li>StumpCast Studio now commands OBS to position your camera automatically!</li>
                </ul>
                <div className="flex gap-2 pt-2">
                  <button onClick={() => setGuideStep(2)} className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-blue-50 cursor-pointer">
                    ← Back
                  </button>
                  <button onClick={() => setGuideStep(4)} className="rounded-lg bg-orange-500 hover:bg-orange-600 px-4 py-1.5 text-xs font-bold text-white uppercase shadow-sm cursor-pointer">
                    Next: Step 4 →
                  </button>
                </div>
              </div>
            )}

            {/* Guide Step 4 */}
            {guideStep === 4 && (
              <div className="rounded-lg bg-blue-50/60 border border-blue-100 p-4 text-xs space-y-2">
                <span className="font-bold text-blue-900 text-sm">Step 4: Verify Scene Rotation &amp; Alignment</span>
                <p className="text-slate-700">
                  Test your setup using the Scene On-Air buttons below (Presets A through E):
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-600 pl-2">
                  <li>Click Preset A, B, C, or E to see your camera move fluidly in real-time.</li>
                  <li>Toggle <strong>"Safe Guides Grid"</strong> on the Monitor to align your headshot.</li>
                  <li>You are 100% ready for professional live commentary!</li>
                </ul>
                <div className="pt-2">
                  <button onClick={() => setCameraTab('webcam')} className="rounded-lg bg-orange-500 hover:bg-orange-600 px-4 py-1.5 text-xs font-bold text-white uppercase shadow-sm cursor-pointer">
                    Open WebCam Preview Studio →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Streamer cams count selection */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-blue-100 pt-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Streamer cams (1 host is the default):</span>
            <div className="flex gap-2">
              {[
                { id: 'none', label: 'NO CAM' },
                { id: 'one', label: '1 HOST' },
                { id: 'two', label: '+ 2ND HOST PRO' },
              ].map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setCameraHostCount(c.id as typeof cameraHostCount);
                    saveVideo.mutate({ cameraMode: c.id as typeof cameraHostCount });
                  }}
                  className={clsx(
                    'rounded-lg px-3 py-1 text-xs font-bold uppercase transition cursor-pointer',
                    cameraHostCount === c.id
                      ? 'border-2 border-orange-500 bg-orange-50 text-orange-600 shadow-sm'
                      : 'border border-blue-200 bg-white text-slate-600 hover:bg-blue-50',
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <label className="flex items-center gap-2 text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={video.camerasOnBreaks}
                onChange={(e) => saveVideo.mutate({ camerasOnBreaks: e.target.checked })}
              />
              Cams as picture-in-picture on breaks / full-screen cards
            </label>
            <label className="flex items-center gap-2 text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={video.alignmentGuides}
                onChange={(e) => saveVideo.mutate({ alignmentGuides: e.target.checked })}
              />
              Show alignment guides on overlay
            </label>
          </div>
        </div>

        {/* Scene on air (A to E) */}
        <div className="border-t border-blue-100 pt-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-700">
              Scene on air — click to cut now:
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={video.sceneRotation}
                onChange={(e) => saveVideo.mutate({ sceneRotation: e.target.checked })}
              />
              Random rotation every
              <input
                type="number"
                min={5}
                max={600}
                defaultValue={video.rotationSec}
                key={video.rotationSec}
                onBlur={(e) => {
                  const n = Math.trunc(Number(e.target.value));
                  if (!Number.isFinite(n) || n < 5 || n > 600) {
                    toast({ title: 'Rotation interval must be 5-600 seconds', kind: 'error' });
                    return;
                  }
                  if (n !== video.rotationSec) saveVideo.mutate({ rotationSec: n });
                }}
                className="w-12 rounded border border-blue-200 bg-white px-1 py-0.5 text-center text-xs text-slate-900"
              />
              seconds
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { id: 'A', title: 'A · Video centre · stats left' },
              { id: 'B', title: 'B · Video centre · stats right' },
              { id: 'C', title: 'C · Big video left' },
              { id: 'D', title: 'D · Big video right' },
              { id: 'E', title: 'E · Streamer spotlight' },
            ].map((preset) => (
              <button
                key={preset.id}
                onClick={() => {
                  const target = preset.id as LayoutPresetId;
                  saveVideo.mutate(
                    { activeObsLayout: target },
                    { onSuccess: () => toast({ title: `Scene Layout: ${preset.title}`, kind: 'success' }) },
                  );
                  if (connected) applyLayout.mutate(target);
                }}
                className={clsx(
                  'rounded-xl border p-3 text-left transition cursor-pointer',
                  (video.activeObsLayout ?? 'B') === preset.id
                    ? 'border-2 border-orange-500 bg-orange-50/60 shadow-sm ring-1 ring-orange-400'
                    : 'border border-blue-200 bg-white hover:border-blue-400 hover:bg-blue-50/40',
                )}
              >
                <div className="aspect-video w-full rounded bg-slate-100 border border-slate-200 p-1.5 flex gap-1 relative overflow-hidden">
                  <div className="w-1/3 bg-orange-500/80 rounded-sm" />
                  <div className="flex-1 bg-blue-600 rounded-sm" />
                </div>
                <div className="mt-2 text-xs font-bold text-slate-900">{preset.title}</div>
                <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-500">
                  <input
                    type="checkbox"
                    checked={video.rotationLayouts.includes(preset.id as LayoutPresetId)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const id = preset.id as LayoutPresetId;
                      const next = e.target.checked
                        ? [...new Set([...video.rotationLayouts, id])]
                        : video.rotationLayouts.filter((x) => x !== id);
                      if (!next.length) {
                        toast({ title: 'Keep at least one layout in the rotation', kind: 'error' });
                        return;
                      }
                      saveVideo.mutate({ rotationLayouts: next });
                    }}
                  />
                  in random rotation
                </div>
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-4 text-[11px] text-slate-600">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-blue-600" /> match video</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-orange-500" /> cam 1</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-red-500" /> cam 2</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-amber-500" /> live stats</span>
          </div>
        </div>

        {/* MATCH VIDEO source buttons */}
        <div className="border-t border-blue-100 pt-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">MATCH VIDEO</span>
            <span className="rounded bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-bold text-blue-800 uppercase">APPLIED</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {[
              ['off', 'OFF'],
              ['obs', 'OBS SOURCE'],
              ['capture', 'CAMERA / CAPTURE CARD'],
              ['stream', 'STREAM LINK'],
              ['embed', 'EMBED (YOUTUBE / VDO.NINJA)'],
            ].map(([val, label]) => (
              <button
                key={val}
                onClick={() => saveVideo.mutate({ sourceMode: val as typeof video.sourceMode })}
                className={clsx(
                  'rounded-lg px-4 py-1.5 text-xs font-bold uppercase transition cursor-pointer',
                  video.sourceMode === val
                    ? 'border-2 border-orange-500 bg-orange-50 text-orange-600 shadow-sm'
                    : 'border border-blue-200 bg-white text-slate-600 hover:bg-blue-50',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            No video — stadium artwork shows in the window.
          </p>
        </div>

        {/* OBS WEBSOCKET LINK */}
        <div className="border-t border-blue-100 pt-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              OBS WEBSOCKET LINK <span className="text-slate-500 font-normal">(moves OBS sources with the scenes)</span>
            </span>
            <span className={clsx('text-xs font-semibold', connected ? 'text-emerald-700' : 'text-slate-500')}>
              {connected ? `Connected · ${status.data?.host}:${status.data?.port}` : '● Not connected'}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={hostDraft}
              onChange={(e) => {
                markDirty('host');
                setHostDraft(e.target.value);
              }}
              placeholder="127.0.0.1"
              className="w-28 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-orange-500"
            />
            <input
              value={portDraft}
              onChange={(e) => {
                markDirty('port');
                setPortDraft(e.target.value);
              }}
              placeholder="4455"
              className="w-20 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-orange-500"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (blank = keep saved)"
              className="flex-1 min-w-[140px] rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-orange-500"
            />
            <input
              placeholder="Scene (blank = current)"
              value={sceneDraft}
              onChange={(e) => {
                markDirty('scene');
                setSceneDraft(e.target.value);
              }}
              onBlur={() => {
                if (sceneDraft === video.obsScene) return;
                saveVideo.mutate({ obsScene: sceneDraft });
              }}
              className="flex-1 min-w-[140px] rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-orange-500"
            />
            <button
              disabled={connected || connect.isPending}
              onClick={() => connect.mutate()}
              className="rounded-lg bg-orange-500 hover:bg-orange-600 px-4 py-1.5 text-xs font-bold text-white uppercase disabled:opacity-50 cursor-pointer shadow-sm transition"
            >
              CONNECT
            </button>
            <button
              disabled={!connected || disconnect.isPending}
              onClick={() => disconnect.mutate()}
              className="rounded-lg border border-blue-200 bg-white px-4 py-1.5 text-xs font-bold text-slate-600 uppercase hover:bg-blue-50 disabled:opacity-50 cursor-pointer"
            >
              STOP
            </button>
          </div>
        </div>
      </div>

      <ProLooksModal open={showProLooks} onClose={() => setShowProLooks(false)} />
    </div>
  );
};