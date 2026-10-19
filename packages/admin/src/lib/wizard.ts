import type { MatchState, Settings } from '@stumpcast/shared';
import type { ProviderStatus } from './api';

export type StepId = 'source' | 'match' | 'preview' | 'obs';

export interface WizardInputs {
  provider?: ProviderStatus;
  matches: MatchState[];
  settings?: Settings;
  /** The user chose manual scoring instead of the extension. */
  manualChosen: boolean;
  /** The user confirmed the preview looks right. */
  previewConfirmed: boolean;
  /** The user copied the overlay link at least once. */
  linkCopied: boolean;
}

export interface WizardStep {
  id: StepId;
  title: string;
  done: boolean;
}

/** Whether the extension is connected and has actually delivered a match. */
export const extensionHasData = (p?: ProviderStatus): boolean =>
  !!p && p.lastHeartbeatAt !== null && p.health !== 'down' && p.matches.length > 0;

/**
 * Steps tick themselves when their condition is met (nothing to click "done" on), except the
 * two that are judgement calls: "preview looks right" and "link copied".
 */
export const wizardSteps = (i: WizardInputs): WizardStep[] => {
  const onStream = i.settings?.onStreamMatchId ?? null;
  const matchSelected =
    i.matches.length > 0 && (onStream === null ? false : i.matches.some((m) => m.id === onStream));
  return [
    {
      id: 'source',
      title: 'Connect a data source',
      done: extensionHasData(i.provider) || i.manualChosen || i.matches.length > 0,
    },
    { id: 'match', title: 'Pick the match', done: matchSelected },
    { id: 'preview', title: 'Check the overlay', done: matchSelected && i.previewConfirmed },
    { id: 'obs', title: 'Add it to OBS', done: i.linkCopied },
  ];
};

/** Index of the first step that is not done (the last step when all are). */
export const currentStep = (steps: WizardStep[]): number => {
  const i = steps.findIndex((s) => !s.done);
  return i === -1 ? steps.length - 1 : i;
};

export const overlayUrl = (origin: string): string => `${origin}/overlay/`;

/** OBS needs a 1920x1080 transparent browser source; these are the values to enter. */
export const OBS_SETTINGS = { width: 1920, height: 1080 } as const;

const KEY = 'stumpcast.wizard';

export interface WizardLocal {
  manualChosen: boolean;
  previewConfirmed: boolean;
  linkCopied: boolean;
}

export const readLocal = (storage: Pick<Storage, 'getItem'> = localStorage): WizardLocal => {
  try {
    const v = JSON.parse(storage.getItem(KEY) ?? '{}') as Partial<WizardLocal>;
    return {
      manualChosen: v.manualChosen === true,
      previewConfirmed: v.previewConfirmed === true,
      linkCopied: v.linkCopied === true,
    };
  } catch {
    return { manualChosen: false, previewConfirmed: false, linkCopied: false };
  }
};

export const writeLocal = (v: WizardLocal, storage: Pick<Storage, 'setItem'> = localStorage) => {
  try {
    storage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* progress just will not persist */
  }
};

export const resetLocal = (storage: Pick<Storage, 'removeItem'> = localStorage) => {
  try {
    storage.removeItem(KEY);
  } catch {
    /* ignore */
  }
};
