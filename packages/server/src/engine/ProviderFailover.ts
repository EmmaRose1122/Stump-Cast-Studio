export interface FailoverEvent {
  at: number;
  fromMatchId: string;
  toMatchId: string;
  reason: string;
  source: string;
}

export interface CandidateMatch {
  id: string;
  title: string;
  source: string;
  health: 'connected' | 'stale' | 'down' | 'unknown' | 'ok';
}

export interface FailoverConfig {
  autoFailoverEnabled: boolean;
  fallbackMatchId: string | null;
  staleThresholdSec: number;
}

export interface ProviderFailoverDeps {
  getActiveMatchId: () => string | null;
  setActiveMatchId: (matchId: string) => void;
  getAvailableMatches: () => CandidateMatch[];
  onFailover?: (event: FailoverEvent) => void;
  now?: () => number;
}

export class ProviderFailoverManager {
  private autoFailoverEnabled = true;
  private fallbackMatchId: string | null = null;
  private staleThresholdSec = 30;
  private lastFailover: FailoverEvent | null = null;

  constructor(
    private readonly deps: ProviderFailoverDeps,
    config?: Partial<FailoverConfig>,
  ) {
    if (config?.autoFailoverEnabled !== undefined) {
      this.autoFailoverEnabled = config.autoFailoverEnabled;
    }
    if (config?.fallbackMatchId !== undefined) {
      this.fallbackMatchId = config.fallbackMatchId;
    }
    if (config?.staleThresholdSec !== undefined && config.staleThresholdSec > 0) {
      this.staleThresholdSec = config.staleThresholdSec;
    }
  }

  private get now(): number {
    return (this.deps.now ?? Date.now)();
  }

  getConfig(): FailoverConfig {
    return {
      autoFailoverEnabled: this.autoFailoverEnabled,
      fallbackMatchId: this.fallbackMatchId,
      staleThresholdSec: this.staleThresholdSec,
    };
  }

  updateConfig(patch: Partial<FailoverConfig>): FailoverConfig {
    if (patch.autoFailoverEnabled !== undefined) {
      this.autoFailoverEnabled = patch.autoFailoverEnabled;
    }
    if (patch.fallbackMatchId !== undefined) {
      this.fallbackMatchId = patch.fallbackMatchId;
    }
    if (patch.staleThresholdSec !== undefined && patch.staleThresholdSec > 0) {
      this.staleThresholdSec = patch.staleThresholdSec;
    }
    return this.getConfig();
  }

  getStatus() {
    const active = this.deps.getActiveMatchId();
    const available = this.deps.getAvailableMatches();
    const fallback = available.find((m) => m.id === this.fallbackMatchId);

    return {
      activeMatchId: active,
      config: this.getConfig(),
      availableMatches: available,
      fallbackMatch: fallback ?? null,
      lastFailover: this.lastFailover,
    };
  }

  /**
   * Evaluate health and perform auto-failover if active match feed has died or gone stale.
   */
  evaluateHealth(activeMatchHealth: string, alarmCode: string | null): {
    failedOver: boolean;
    event: FailoverEvent | null;
  } {
    if (!this.autoFailoverEnabled) {
      return { failedOver: false, event: null };
    }

    const currentId = this.deps.getActiveMatchId();
    if (!currentId) {
      return { failedOver: false, event: null };
    }

    const isProblematic =
      activeMatchHealth === 'stale' ||
      activeMatchHealth === 'down' ||
      alarmCode === 'DATA_STALE' ||
      alarmCode === 'PROVIDER_DOWN';

    if (!isProblematic) {
      return { failedOver: false, event: null };
    }

    // Find candidate fallback match
    const candidates = this.deps.getAvailableMatches();

    // 1. Check explicit fallback match
    let target = this.fallbackMatchId
      ? candidates.find(
          (m) =>
            m.id === this.fallbackMatchId &&
            m.id !== currentId &&
            (m.health === 'connected' || m.health === 'ok'),
        )
      : null;

    // 2. If no explicit fallback or it is unhealthy, find first available healthy match
    if (!target) {
      target = candidates.find(
        (m) => m.id !== currentId && (m.health === 'connected' || m.health === 'ok'),
      );
    }

    if (!target) {
      return { failedOver: false, event: null };
    }

    const event: FailoverEvent = {
      at: this.now,
      fromMatchId: currentId,
      toMatchId: target.id,
      source: target.source,
      reason: `Primary feed degraded (${alarmCode ?? activeMatchHealth}). Switched automatically to healthy feed ${target.title || target.id}.`,
    };

    this.lastFailover = event;
    this.deps.setActiveMatchId(target.id);
    this.deps.onFailover?.(event);

    return { failedOver: true, event };
  }

  /**
   * Operator manually switches to a specific match/provider.
   */
  manualSwitch(targetMatchId: string): { ok: boolean; error?: string } {
    const candidates = this.deps.getAvailableMatches();
    const target = candidates.find((m) => m.id === targetMatchId);
    if (!target) {
      return { ok: false, error: `Match ${targetMatchId} not found in available feeds.` };
    }

    const currentId = this.deps.getActiveMatchId();
    this.deps.setActiveMatchId(target.id);

    if (currentId && currentId !== target.id) {
      this.lastFailover = {
        at: this.now,
        fromMatchId: currentId,
        toMatchId: target.id,
        source: target.source,
        reason: `Operator manual switch to ${target.title || target.id}.`,
      };
    }

    return { ok: true };
  }
}
