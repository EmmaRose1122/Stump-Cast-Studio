import type { MatchState } from '@stumpcast/shared';
import type { AlarmState, ProviderStatus } from './api';

export type ChipState = 'ok' | 'warn' | 'error' | 'neutral';

export interface Chip {
  id: 'provider' | 'match' | 'obs' | 'licence';
  label: string;
  value: string;
  state: ChipState;
}

export interface StatusInputs {
  provider?: ProviderStatus;
  providerError?: boolean;
  obs?: { connected: boolean; error: string | null };
  matches?: MatchState[];
  alarm?: AlarmState;
  licensed?: boolean;
}

/** Pure mapping from server data to the four status-bar chips. */
export const deriveChips = (i: StatusInputs): Chip[] => {
  let provider: Chip;
  if (i.providerError || !i.provider) {
    provider = { id: 'provider', label: 'Provider', value: 'Server offline', state: 'error' };
  } else if (i.provider.lastHeartbeatAt === null) {
    provider = {
      id: 'provider',
      label: 'Provider',
      value: 'Extension not connected',
      state: 'warn',
    };
  } else {
    const map = {
      connected: { value: 'Extension connected', state: 'ok' },
      stale: { value: 'Data stale', state: 'warn' },
      down: { value: 'Extension disconnected', state: 'error' },
    } as const;
    provider = { id: 'provider', label: 'Provider', ...map[i.provider.health] };
  }

  const m = i.matches?.[0];
  const match: Chip = m
    ? {
        id: 'match',
        label: 'Match',
        value: m.title,
        state: m.status === 'live' ? 'ok' : 'neutral',
      }
    : { id: 'match', label: 'Match', value: 'No match', state: 'neutral' };

  const obs: Chip = i.obs?.connected
    ? { id: 'obs', label: 'OBS', value: 'Connected', state: 'ok' }
    : i.obs?.error
      ? { id: 'obs', label: 'OBS', value: 'Connection failed', state: 'error' }
      : { id: 'obs', label: 'OBS', value: 'Not connected', state: 'neutral' };
  const licence: Chip = i.licensed
    ? { id: 'licence', label: 'Licence', value: 'Pro', state: 'ok' }
    : { id: 'licence', label: 'Licence', value: 'Free', state: 'neutral' };

  // An active watchdog alarm tints the provider chip even if the socket is up.
  if (i.alarm && i.alarm.level !== 'ok' && provider.state === 'ok') {
    provider = { ...provider, state: i.alarm.level === 'error' ? 'error' : 'warn' };
  }
  return [provider, match, obs, licence];
};
