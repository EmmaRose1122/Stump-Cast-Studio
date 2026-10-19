import { MAX_SOUND_SLOTS, type SoundCommand } from '../sound';

/* Minimal structural types so this module needs no DOM lib and is easy to fake in tests. */
export interface GainNodeLike {
  gain: {
    value: number;
    setValueAtTime(v: number, t: number): void;
    linearRampToValueAtTime(v: number, t: number): void;
    cancelScheduledValues?(t: number): void;
  };
  connect(dest: unknown): unknown;
  disconnect(): void;
}

export interface SourceLike {
  buffer: unknown;
  loop: boolean;
  connect(dest: unknown): unknown;
  disconnect(): void;
  start(when?: number): void;
  stop(when?: number): void;
  onended: (() => void) | null;
}

export interface CompressorLike {
  threshold: { value: number };
  knee: { value: number };
  ratio: { value: number };
  attack: { value: number };
  release: { value: number };
  connect(dest: unknown): unknown;
}

export interface AudioContextLike {
  readonly currentTime: number;
  readonly state: 'suspended' | 'running' | 'closed';
  readonly destination: unknown;
  resume(): Promise<void>;
  createGain(): GainNodeLike;
  createBufferSource(): SourceLike;
  createDynamicsCompressor(): CompressorLike;
  decodeAudioData(data: ArrayBuffer): Promise<unknown>;
  setSinkId?(id: string): Promise<void>;
}

export interface AudioEngineDeps {
  createContext(): AudioContextLike;
  /** Fetch the raw bytes of a sound file. */
  fetchBytes(url: string): Promise<ArrayBuffer>;
}

export interface SoundSource {
  id: string;
  url: string;
  volume?: number;
}

/** Stop-all fades the master gain over this long (the requirement is "within 100 ms"). */
export const STOP_FADE_SEC = 0.04;

/**
 * Multi-track loop plus instant one-shots (SN-1), shared by the overlay (OBS capture) and the
 * admin (headphone monitor). A limiter keeps ten simultaneous tracks from clipping.
 */
export class AudioEngine {
  private ctx: AudioContextLike | null = null;
  private master: GainNodeLike | null = null;
  private buffers = new Map<string, unknown>();
  private volumes = new Map<string, number>();
  private loops = new Map<string, { src: SourceLike; gain: GainNodeLike }>();
  private oneShots = new Set<SourceLike>();
  private masterVolume = 0.8;
  private masterVolumeBeforeStop = 0.8;
  private sink: string | null = null;

  constructor(private readonly deps: AudioEngineDeps) {}

  // ---- setup ------------------------------------------------------------------------------

  private ensure(): { ctx: AudioContextLike; master: GainNodeLike } {
    if (!this.ctx || !this.master) {
      const ctx = this.deps.createContext();
      // master -> limiter -> speakers. Threshold/ratio keep summed tracks out of clipping.
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -6;
      limiter.knee.value = 6;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.1;
      const master = ctx.createGain();
      master.gain.value = this.masterVolume;
      master.connect(limiter);
      limiter.connect(ctx.destination);
      this.ctx = ctx;
      this.master = master;
      if (this.sink && ctx.setSinkId) void ctx.setSinkId(this.sink).catch(() => undefined);
    }
    return { ctx: this.ctx, master: this.master };
  }

  /** True when the browser is holding audio until a user gesture. */
  get needsUnlock(): boolean {
    return this.ctx !== null && this.ctx.state === 'suspended';
  }

  async unlock(): Promise<void> {
    const { ctx } = this.ensure();
    if (ctx.state === 'suspended') await ctx.resume();
  }

  get loopCount(): number {
    return this.loops.size;
  }

  get loaded(): string[] {
    return [...this.buffers.keys()];
  }

  /** Decode every sound ahead of time; one failing file never blocks the rest. */
  async preload(sounds: SoundSource[]): Promise<{ loaded: string[]; failed: string[] }> {
    const { ctx } = this.ensure();
    const keep = new Set(sounds.map((s) => s.id));
    for (const id of [...this.buffers.keys()]) if (!keep.has(id)) this.buffers.delete(id);

    const loaded: string[] = [];
    const failed: string[] = [];
    await Promise.all(
      sounds.map(async (s) => {
        this.volumes.set(s.id, s.volume ?? 1);
        try {
          const bytes = await this.deps.fetchBytes(s.url);
          this.buffers.set(s.id, await ctx.decodeAudioData(bytes));
          loaded.push(s.id);
        } catch {
          failed.push(s.id);
        }
      }),
    );
    return { loaded, failed };
  }

  // ---- playback ---------------------------------------------------------------------------

  setMaster(volume: number): void {
    this.masterVolume = Math.min(1, Math.max(0, volume));
    if (this.master && this.ctx) {
      this.master.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
    }
  }

  /** Current master level (0-1). */
  get masterLevel(): number {
    return this.masterVolume;
  }

  /** Play a slot once. Returns false when it is not loaded. */
  play(id: string, volume?: number): boolean {
    const buffer = this.buffers.get(id);
    if (buffer === undefined) return false;
    const { ctx, master } = this.ensure();
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    gain.gain.value = (volume ?? 1) * (this.volumes.get(id) ?? 1);
    src.buffer = buffer;
    src.connect(gain);
    gain.connect(master);
    src.onended = () => {
      this.oneShots.delete(src);
      src.disconnect();
      gain.disconnect();
    };
    this.oneShots.add(src);
    src.start();
    return true;
  }

  /** Loop the given slots together (max 10). Replaces any loop already running. */
  startLoop(ids: string[]): number {
    this.stopLoop();
    const { ctx, master } = this.ensure();
    for (const id of ids.slice(0, MAX_SOUND_SLOTS)) {
      const buffer = this.buffers.get(id);
      if (buffer === undefined || this.loops.has(id)) continue;
      const src = ctx.createBufferSource();
      const gain = ctx.createGain();
      gain.gain.value = this.volumes.get(id) ?? 1;
      src.buffer = buffer;
      src.loop = true;
      src.connect(gain);
      gain.connect(master);
      src.start();
      this.loops.set(id, { src, gain });
    }
    return this.loops.size;
  }

  stopLoop(): void {
    for (const { src, gain } of this.loops.values()) {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
      src.disconnect();
      gain.disconnect();
    }
    this.loops.clear();
  }

  /** Silence everything: a short fade avoids a click, then all sources are stopped. */
  stopAll(): void {
    if (this.master && this.ctx) {
      const t = this.ctx.currentTime;
      this.master.gain.setValueAtTime(this.master.gain.value, t);
      this.master.gain.linearRampToValueAtTime(0, t + STOP_FADE_SEC);
    }
    for (const src of this.oneShots) {
      try {
        src.stop(this.ctx ? this.ctx.currentTime + STOP_FADE_SEC : 0);
      } catch {
        /* already finished */
      }
    }
    this.oneShots.clear();
    this.stopLoop();
    this.masterVolumeBeforeStop = this.masterVolume;
    if (this.master && this.ctx) {
      this.master.gain.setValueAtTime(
        this.masterVolumeBeforeStop,
        this.ctx.currentTime + STOP_FADE_SEC + 0.01,
      );
    }
  }

  /** Route output to a specific device (admin headphone monitor). */
  async setSink(deviceId: string | null): Promise<boolean> {
    this.sink = deviceId;
    const { ctx } = this.ensure();
    if (!ctx.setSinkId || deviceId === null) return false;
    try {
      await ctx.setSinkId(deviceId);
      return true;
    } catch {
      return false;
    }
  }

  /** Apply a `sound` channel command. `library-updated` is handled by the caller. */
  handle(cmd: SoundCommand): void {
    switch (cmd.action) {
      case 'play':
        this.play(cmd.id, cmd.volume);
        return;
      case 'loop-start':
        this.startLoop(cmd.ids);
        return;
      case 'loop-stop':
        this.stopLoop();
        return;
      case 'stop-all':
        this.stopAll();
        return;
      case 'master':
        this.setMaster(cmd.volume);
        return;
      case 'library-updated':
        return;
    }
  }

  async close(): Promise<void> {
    this.stopAll();
    this.ctx = null;
    this.master = null;
  }
}
