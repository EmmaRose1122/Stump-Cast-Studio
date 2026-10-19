import { AudioEngine, SoundCommandSchema, type AudioContextLike } from '@stumpcast/shared';
import type { SoundOverview } from './sounds';

/**
 * Headphone monitor: plays the same sounds the overlay triggers, on a chosen output device of
 * this computer, so the operator hears what the stream hears (SN-3). It is silent unless enabled.
 */
class Monitor {
  private engine: AudioEngine | null = null;
  private enabled = false;

  get isEnabled(): boolean {
    return this.enabled;
  }

  private ensure(): AudioEngine {
    if (!this.engine) {
      this.engine = new AudioEngine({
        createContext: () => new AudioContext() as unknown as AudioContextLike,
        fetchBytes: async (url) => {
          const res = await fetch(url);
          if (!res.ok) throw new Error(String(res.status));
          return res.arrayBuffer();
        },
      });
    }
    return this.engine;
  }

  async enable(deviceId: string | null): Promise<void> {
    const engine = this.ensure();
    this.enabled = true;
    if (deviceId) await engine.setSink(deviceId);
    await engine.unlock();
    await this.reload();
  }

  async setDevice(deviceId: string | null): Promise<boolean> {
    return deviceId ? this.ensure().setSink(deviceId) : false;
  }

  disable(): void {
    this.enabled = false;
    this.engine?.stopAll();
  }

  async reload(): Promise<void> {
    if (!this.enabled) return;
    try {
      const res = await fetch('/api/sounds');
      if (!res.ok) return;
      const o = (await res.json()) as SoundOverview;
      const e = this.ensure();
      e.setMaster(o.master);
      await e.preload(
        o.slots.map((s) => ({ id: s.id, url: `/assets/${s.file}`, volume: s.volume })),
      );
      if (o.loopRunning) e.startLoop(o.slots.filter((s) => s.includeInLoop).map((s) => s.id));
    } catch {
      /* the monitor is a convenience; never throw into the page */
    }
  }

  /** Feed a raw `sound` channel payload. */
  handle(payload: unknown): void {
    if (!this.enabled) return;
    const cmd = SoundCommandSchema.safeParse(payload);
    if (!cmd.success) return;
    if (cmd.data.action === 'library-updated') void this.reload();
    else this.engine?.handle(cmd.data);
  }
}

export const monitor = new Monitor();
/** Output devices, if the browser lets us list them (labels need a prior permission). */
export const listOutputDevices = async (): Promise<{ id: string; label: string }[]> => {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const all = await navigator.mediaDevices.enumerateDevices();
  return all
    .filter((d) => d.kind === 'audiooutput')
    .map((d, i) => ({ id: d.deviceId, label: d.label || `Output ${i + 1}` }));
};
