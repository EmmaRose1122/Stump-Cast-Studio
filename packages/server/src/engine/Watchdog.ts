import type { ProviderHealth } from '@stumpcast/shared';
import type { Scheduler } from './DelayBuffer';

export type AlarmLevel = 'ok' | 'warn' | 'error';
export type AlarmCode = 'DATA_STALE' | 'PROVIDER_DOWN' | 'OBS_DISCONNECTED';

export interface Alarm {
  level: AlarmLevel;
  code: AlarmCode | null;
  /** Plain-language and actionable. */
  message: string;
  /** True while the operator has muted the banner (the alarm itself is still reported). */
  muted: boolean;
  since: number | null;
}

export interface WatchdogInputs {
  /** Extension/provider connection health. */
  providerHealth: () => ProviderHealth;
  /** Epoch ms of the newest data for the on-stream match, or null if none yet. */
  lastDataAt: () => number | null;
  /** null when OBS integration is not configured. */
  obsConnected?: () => boolean | null;
}

const OK: Alarm = {
  level: 'ok',
  code: null,
  message: 'Receiving live data.',
  muted: false,
  since: null,
};

/**
 * Watches freshness of the on-stream data (B6). No data for `staleSec` is a warning, for twice
 * that (or a provider that is down) an error. Muting silences the banner for a while but never
 * hides the condition. Recovery returns to `ok` automatically.
 */
export class Watchdog {
  private current: Alarm = OK;
  private mutedUntil = 0;
  private timer: unknown = null;

  constructor(
    private readonly inputs: WatchdogInputs,
    private readonly onChange: (alarm: Alarm) => void,
    private readonly opts: { sched?: Scheduler } = {},
  ) {}

  private staleSec = 30;

  /** Runtime-adjustable threshold (Settings > watchdog). */
  setStaleSec(sec: number): void {
    if (Number.isFinite(sec) && sec > 0) this.staleSec = sec;
  }

  private get staleMs(): number {
    return this.staleSec * 1000;
  }

  private get now(): number {
    return (this.opts.sched?.now ?? Date.now)();
  }

  get alarm(): Alarm {
    return { ...this.current, muted: this.isMuted() };
  }

  start(intervalMs = 5000): void {
    // A second start() must not orphan the first timer: stop() first, then re-arm.
    this.stop();
    const sched = this.opts.sched;
    const tick = () => {
      this.check();
      this.timer = sched ? sched.setTimeout(tick, intervalMs) : setTimeout(tick, intervalMs);
    };
    tick();
  }

  stop(): void {
    if (this.timer === null) return;
    if (this.opts.sched) this.opts.sched.clearTimeout(this.timer);
    else clearTimeout(this.timer as ReturnType<typeof setTimeout>);
    this.timer = null;
  }

  mute(minutes: number): void {
    this.mutedUntil = this.now + Math.max(0, minutes) * 60_000;
    this.publish(this.current);
  }

  unmute(): void {
    this.mutedUntil = 0;
    this.publish(this.current);
  }

  isMuted(): boolean {
    return this.now < this.mutedUntil;
  }

  /** Evaluate now; emits only when the level/code changes. */
  check(): Alarm {
    const next = this.evaluate();
    const changed = next.level !== this.current.level || next.code !== this.current.code;
    if (changed) {
      // Keep the original `since` while an alarm only changes severity.
      const since = next.level === 'ok' ? null : (this.current.since ?? this.now);
      this.current = { ...next, since };
      this.publish(this.current);
    }
    return this.alarm;
  }

  private evaluate(): Alarm {
    const providerHealth = this.inputs.providerHealth();
    const last = this.inputs.lastDataAt();
    const obs = this.inputs.obsConnected?.() ?? null;

    if (last !== null && providerHealth === 'down') {
      return {
        level: 'error',
        code: 'PROVIDER_DOWN',
        message:
          'The match data source is disconnected. Check that the browser with the match page is open and the StumpCast extension is on.',
        muted: false,
        since: null,
      };
    }
    if (last !== null) {
      const age = this.now - last;
      if (age > this.staleMs * 2) {
        return {
          level: 'error',
          code: 'DATA_STALE',
          message: `No score update for ${Math.round(age / 1000)} seconds. The match page may be paused, throttled or have changed layout.`,
          muted: false,
          since: null,
        };
      }
      if (age > this.staleMs) {
        return {
          level: 'warn',
          code: 'DATA_STALE',
          message: `Score data is ${Math.round(age / 1000)} seconds old. Check the match page is visible and live.`,
          muted: false,
          since: null,
        };
      }
    }
    if (obs === false) {
      return {
        level: 'warn',
        code: 'OBS_DISCONNECTED',
        message: 'OBS is not connected. Camera layouts will not follow until it reconnects.',
        muted: false,
        since: null,
      };
    }
    return OK;
  }

  private publish(alarm: Alarm): void {
    this.onChange({ ...alarm, muted: this.isMuted() });
  }
}
