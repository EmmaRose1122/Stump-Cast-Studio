import {
  AudioEngine,
  SoundCommandSchema,
  type AudioContextLike,
  type SoundCommand,
  type SoundSlot,
} from '@stumpcast/shared';

export interface SoundOverview {
  slots: SoundSlot[];
  master: number;
  loopRunning: boolean;
}

/** Real Web Audio engine for the browser. */
export const createBrowserEngine = (): AudioEngine =>
  new AudioEngine({
    createContext: () =>
      new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      )() as unknown as AudioContextLike,
    fetchBytes: async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      return res.arrayBuffer();
    },
  });

/**
 * Keeps an AudioEngine in step with the server's sound library and `sound` channel. Used by
 * the OBS overlay (audio is captured from the browser source).
 */
export class OverlayAudio {
  private loopIds: string[] | null = null;

  constructor(
    private readonly engine: AudioEngine,
    private readonly origin: string,
    private readonly fetchOverview: () => Promise<SoundOverview | undefined> = async () => {
      try {
        const r = await fetch(`${origin}/api/sounds`);
        return r.ok ? ((await r.json()) as SoundOverview) : undefined;
      } catch {
        return undefined;
      }
    },
  ) {}

  /** (Re)load the library and restore the loop if one is running. */
  async sync(): Promise<void> {
    const o = await this.fetchOverview();
    if (!o) return;
    this.engine.setMaster(o.master);
    await this.engine.preload(
      o.slots.map((s) => ({ id: s.id, url: `${this.origin}/assets/${s.file}`, volume: s.volume })),
    );
    if (o.loopRunning) {
      const ids = o.slots.filter((s) => s.includeInLoop).map((s) => s.id);
      this.loopIds = ids;
      this.engine.startLoop(ids);
    } else if (this.loopIds) {
      this.engine.stopLoop();
      this.loopIds = null;
    }
  }

  /** Handle a raw `sound` channel payload. Unknown or invalid payloads are ignored. */
  async handle(payload: unknown): Promise<void> {
    const cmd = SoundCommandSchema.safeParse(payload);
    if (!cmd.success) return;
    const c: SoundCommand = cmd.data;
    if (c.action === 'library-updated') {
      await this.sync();
      return;
    }
    if (c.action === 'loop-start') this.loopIds = c.ids;
    if (c.action === 'loop-stop' || c.action === 'stop-all') this.loopIds = null;
    this.engine.handle(c);
  }

  get needsUnlock(): boolean {
    return this.engine.needsUnlock;
  }

  unlock(): Promise<void> {
    return this.engine.unlock();
  }
}
