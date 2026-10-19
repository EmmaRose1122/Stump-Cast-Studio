import { describe, expect, it } from 'vitest';
import { createSettings, fixtures } from '@stumpcast/shared';
import type { ProviderStatus } from './lib/api';
import {
  currentStep,
  extensionHasData,
  overlayUrl,
  readLocal,
  wizardSteps,
  writeLocal,
  type WizardInputs,
} from './lib/wizard';

const provider = (over: Partial<ProviderStatus> = {}): ProviderStatus => ({
  health: 'connected',
  lastHeartbeatAt: 1,
  extensionVersion: '0.0.1',
  selectorsVersion: 1,
  matches: [],
  ...over,
});

const base = (over: Partial<WizardInputs> = {}): WizardInputs => ({
  matches: [],
  manualChosen: false,
  previewConfirmed: false,
  linkCopied: false,
  ...over,
});

describe('wizard steps tick themselves', () => {
  it('starts with nothing done', () => {
    const steps = wizardSteps(base());
    expect(steps.map((s) => s.done)).toEqual([false, false, false, false]);
    expect(currentStep(steps)).toBe(0);
  });

  it('a connected extension alone is not enough, it must deliver a match', () => {
    expect(extensionHasData(provider())).toBe(false);
    expect(extensionHasData(provider({ matches: [{ matchId: 'm', health: 'connected' }] }))).toBe(
      true,
    );
    expect(
      extensionHasData(provider({ health: 'down', matches: [{ matchId: 'm', health: 'down' }] })),
    ).toBe(false);
  });

  it('manual scoring satisfies the source step', () => {
    expect(wizardSteps(base({ manualChosen: true }))[0]!.done).toBe(true);
  });

  it('the match step needs an on-stream match that exists', () => {
    const matches = [fixtures.t20];
    expect(wizardSteps(base({ matches }))[1]!.done).toBe(false);
    const settings = createSettings({ onStreamMatchId: fixtures.t20.id });
    expect(wizardSteps(base({ matches, settings }))[1]!.done).toBe(true);
    const stale = createSettings({ onStreamMatchId: 'gone' });
    expect(wizardSteps(base({ matches, settings: stale }))[1]!.done).toBe(false);
  });

  it('preview and OBS steps follow the user confirming them', () => {
    const settings = createSettings({ onStreamMatchId: fixtures.t20.id });
    const s = wizardSteps(
      base({ matches: [fixtures.t20], settings, previewConfirmed: true, linkCopied: true }),
    );
    expect(s.every((x) => x.done)).toBe(true);
    expect(currentStep(s)).toBe(3);
  });

  it('preview cannot be confirmed before a match is selected', () => {
    expect(wizardSteps(base({ previewConfirmed: true }))[2]!.done).toBe(false);
  });
});

describe('wizard persistence and links', () => {
  it('round-trips progress and tolerates garbage', () => {
    const mem: Record<string, string> = {};
    const store = {
      getItem: (k: string) => mem[k] ?? null,
      setItem: (k: string, v: string) => void (mem[k] = v),
    };
    expect(readLocal(store).previewConfirmed).toBe(false);
    writeLocal({ manualChosen: true, previewConfirmed: true, linkCopied: false }, store);
    expect(readLocal(store)).toEqual({
      manualChosen: true,
      previewConfirmed: true,
      linkCopied: false,
    });
    mem['stumpcast.wizard'] = '{not json';
    expect(readLocal(store).manualChosen).toBe(false);
  });

  it('builds the overlay URL', () => {
    expect(overlayUrl('http://127.0.0.1:4000')).toBe('http://127.0.0.1:4000/overlay/');
  });
});
