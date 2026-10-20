import { OBSWebSocket } from 'obs-websocket-js';
import {
  OBS_LAYOUT_PRESETS,
  obsRectPixels,
  type LayoutPresetId,
  type ObsRole,
} from '@stumpcast/shared';

interface ObsClient {
  connect(url: string, password?: string, params?: { rpcVersion?: number }): Promise<unknown>;
  disconnect(): Promise<unknown>;
  call(requestType: string, requestData?: Record<string, unknown>): Promise<unknown>;
  on?(event: string, cb: (...args: unknown[]) => void): void;
}

export interface ObsSource {
  name: string;
  kind: string;
}

export interface ObsStatus {
  connected: boolean;
  host: string | null;
  port: number | null;
  connectedAt: number | null;
  error: string | null;
}

export interface ObsRotationConfig {
  enabled: boolean;
  intervalSec: number;
  layouts: LayoutPresetId[];
  map: Partial<Record<ObsRole, string>>;
  sceneName?: string;
}

export interface ObsTimers {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
}

const realTimers: ObsTimers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
};

/** obs-websocket-js signals a dropped or ended session with these two events. */
const LOST_EVENTS = ['SessionLost', 'SessionDestroyed'];
const RECONNECT_START_MS = 2000;
const RECONNECT_MAX_MS = 30_000;

const obsClient = (): ObsClient => new OBSWebSocket() as unknown as ObsClient;

export class OBSLink {
  private client: ObsClient | null = null;
  private host: string | null = null;
  private port: number | null = null;
  private password: string | undefined;
  private connectedAt: number | null = null;
  private error: string | null = null;
  private rotationTimer: ReturnType<typeof setInterval> | null = null;
  private rotation: ObsRotationConfig | null = null;
  private retryTimer: unknown = null;
  private retryDelayMs = RECONNECT_START_MS;

  constructor(
    private readonly createClient: () => ObsClient = obsClient,
    private readonly timers: ObsTimers = realTimers,
  ) {}

  get connected(): boolean {
    return this.client !== null;
  }

  get status(): ObsStatus {
    return {
      connected: this.connected,
      host: this.host,
      port: this.port,
      connectedAt: this.connectedAt,
      error: this.error,
    };
  }

  async connect(host: string, port: number, password?: string): Promise<ObsStatus> {
    await this.closeSocket();
    this.cancelRetry();
    const client = this.createClient();
    const safeHost = host.trim().replace(/^\[|\]$/g, '');
    if (!safeHost || /[\s/@?#]/.test(safeHost)) throw new Error('Enter a valid OBS host name');
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('OBS port must be 1-65535');
    const urlHost = safeHost.includes(':') ? `[${safeHost}]` : safeHost;
    try {
      await client.connect(`ws://${urlHost}:${port}`, password || undefined, { rpcVersion: 1 });
      this.client = client;
      this.host = safeHost;
      this.port = port;
      this.password = password;
      this.connectedAt = Date.now();
      this.error = null;
      this.retryDelayMs = RECONNECT_START_MS;
      // OBS quitting or dropping the socket must show up as disconnected, not as a stale
      // "connected" that makes every later scene call fail silently for the rest of the stream.
      for (const event of LOST_EVENTS) client.on?.(event, () => this.onSessionLost(event));
      if (this.rotation) this.startRotationClock();
      return this.status;
    } catch (err) {
      this.client = null;
      this.host = safeHost;
      this.port = port;
      this.password = password;
      this.connectedAt = null;
      this.error = err instanceof Error ? err.message : 'Could not connect to OBS';
      throw new Error(this.error);
    }
  }

  /** Operator-initiated: close the link, stop rotating and give up on reconnecting. */
  async disconnect(): Promise<ObsStatus> {
    this.cancelRetry();
    this.rotation = null;
    this.clearRotationClock();
    return this.closeSocket();
  }

  private async closeSocket(): Promise<ObsStatus> {
    const client = this.client;
    this.client = null;
    this.connectedAt = null;
    if (client) await client.disconnect().catch(() => undefined);
    return this.status;
  }

  private onSessionLost(reason: string): void {
    if (this.client === null) return;
    this.client = null;
    this.connectedAt = null;
    this.error = `Connection to OBS lost (${reason})`;
    this.clearRotationClock();
    this.scheduleRetry();
  }

  private scheduleRetry(): void {
    if (this.retryTimer !== null || this.host === null || this.port === null) return;
    const delay = this.retryDelayMs;
    this.retryDelayMs = Math.min(this.retryDelayMs * 2, RECONNECT_MAX_MS);
    this.retryTimer = this.timers.setTimeout(() => {
      this.retryTimer = null;
      if (this.client !== null || this.host === null || this.port === null) return;
      void this.connect(this.host, this.port, this.password).catch(() => {
        this.scheduleRetry();
      });
    }, delay);
  }

  private cancelRetry(): void {
    if (this.retryTimer !== null) {
      this.timers.clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  /** Remembered so a reconnect picks the rotation back up instead of losing it silently. */
  setRotation(config: ObsRotationConfig): void {
    this.clearRotationClock();
    this.rotation = config.enabled && config.layouts.length >= 2 ? config : null;
    if (this.rotation && this.client) this.startRotationClock();
  }

  private startRotationClock(): void {
    const config = this.rotation!;
    this.rotationTimer = setInterval(() => {
      const id = config.layouts[Math.floor(Math.random() * config.layouts.length)]!;
      void this.applyLayout(id, config.map, config.sceneName).catch(() => undefined);
    }, config.intervalSec * 1000);
    this.rotationTimer.unref?.();
  }

  private clearRotationClock(): void {
    if (this.rotationTimer !== null) {
      clearInterval(this.rotationTimer);
      this.rotationTimer = null;
    }
  }

  async listScenes(): Promise<{ scenes: string[]; current: string }> {
    const result = (await this.requireClient().call('GetSceneList')) as {
      scenes: { sceneName?: string }[];
      currentProgramSceneName: string;
    };
    return {
      scenes: result.scenes.map((scene) => scene.sceneName ?? '').filter(Boolean),
      current: result.currentProgramSceneName,
    };
  }

  async listSources(): Promise<ObsSource[]> {
    const result = (await this.requireClient().call('GetInputList')) as {
      inputs: { inputName?: string; inputKind?: string }[];
    };
    return result.inputs.map((input) => ({
      name: input.inputName ?? '',
      kind: input.inputKind ?? 'unknown',
    }));
  }

  async setScene(sceneName: string): Promise<void> {
    if (!sceneName.trim()) throw new Error('Choose an OBS scene');
    await this.requireClient().call('SetCurrentProgramScene', { sceneName });
  }

  async applyLayout(
    layoutId: LayoutPresetId,
    map: Partial<Record<ObsRole, string>>,
    sceneName?: string,
  ): Promise<{ applied: ObsRole[]; missing: ObsRole[]; canvas: { width: number; height: number } }> {
    const client = this.requireClient();
    const preset = OBS_LAYOUT_PRESETS.find((item) => item.id === layoutId);
    if (!preset) throw new Error('Unknown OBS layout');
    const scene = sceneName?.trim() || (await this.listScenes()).current;
    if (!scene) throw new Error('OBS has no active scene');
    const [{ baseWidth, baseHeight }] = await Promise.all([
      client.call('GetVideoSettings') as Promise<{ baseWidth: number; baseHeight: number }>,
    ]);
    const applied: ObsRole[] = [];
    const missing: ObsRole[] = [];

    for (const role of ['matchVideo', 'cam1', 'cam2'] as const) {
      const rect = preset.roles[role];
      const sourceName = map[role]?.trim();
      if (!rect || !sourceName) continue;
      try {
        const { sceneItemId } = (await client.call('GetSceneItemId', {
          sceneName: scene,
          sourceName,
        })) as { sceneItemId: number };
        const bounds = obsRectPixels(rect, baseWidth, baseHeight);
        await client.call('SetSceneItemTransform', {
          sceneName: scene,
          sceneItemId,
          sceneItemTransform: {
            positionX: bounds.x,
            positionY: bounds.y,
            boundsType: 'OBS_BOUNDS_SCALE_INNER',
            boundsWidth: bounds.width,
            boundsHeight: bounds.height,
            boundsAlignment: 0,
            alignment: 0,
          },
        });
        applied.push(role);
      } catch {
        missing.push(role);
      }
    }
    return { applied, missing, canvas: { width: baseWidth, height: baseHeight } };
  }

  private requireClient(): ObsClient {
    if (!this.client) throw new Error('Connect to OBS first');
    return this.client;
  }
}