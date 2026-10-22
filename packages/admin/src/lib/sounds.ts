import { ApiError } from './api';
import type { SoundSlot } from '@stumpcast/shared';

export interface SoundOverview {
  slots: SoundSlot[];
  max: number;
  master: number;
  auto: {
    four: string | null;
    six: string | null;
    wicket: string | null;
    milestone: string | null;
  };
  loopRunning: boolean;
}

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPT = /\.(wav|mp3|ogg)$/i;

/** Client-side check so a bad file is explained before it is uploaded. */
export const validateSoundFile = (f: { name: string; size: number }): string | null => {
  if (!ACCEPT.test(f.name)) return 'Choose a WAV, MP3 or OGG file';
  if (f.size === 0) return 'That file is empty';
  if (f.size > MAX_FILE_BYTES) return 'That file is larger than 10 MB';
  return null;
};

export const capacityLabel = (used: number, max: number): string => `${used} / ${max} slots`;

const read = async <T>(res: Response): Promise<T> => {
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new ApiError(res.status, body.error ?? `${res.status} ${res.statusText}`);
  return body;
};

const send = (method: string, url: string, body?: unknown) =>
  fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

export const soundsApi = {
  overview: () => fetch('/api/sounds').then((r) => read<SoundOverview>(r)),
  upload: (input: { title: string; includeInLoop: boolean; file: File }) => {
    const form = new FormData();
    form.append('title', input.title);
    form.append('includeInLoop', String(input.includeInLoop));
    form.append('file', input.file); // after the fields: the server reads them in order
    return fetch('/api/sounds', { method: 'POST', body: form }).then((r) => read<SoundSlot>(r));
  },
  samples: () => send('POST', '/api/sounds/samples').then((r) => read<SoundOverview>(r)),
  preset: (id: string) => send('POST', `/api/sounds/preset/${encodeURIComponent(id)}`).then((r) => read<SoundOverview>(r)),
  update: (id: string, patch: Partial<Pick<SoundSlot, 'title' | 'includeInLoop' | 'volume'>>) =>
    send('PUT', `/api/sounds/${encodeURIComponent(id)}`, patch).then((r) => read<SoundSlot>(r)),
  remove: (id: string) =>
    send('DELETE', `/api/sounds/${encodeURIComponent(id)}`).then((r) => read<SoundOverview>(r)),
  play: (id: string) =>
    send('POST', `/api/sound/play/${encodeURIComponent(id)}`).then((r) => read<{ ok: true }>(r)),
  loopStart: () => send('POST', '/api/sound/loop/start').then((r) => read<SoundOverview>(r)),
  loopStop: () => send('POST', '/api/sound/loop/stop').then((r) => read<SoundOverview>(r)),
  stopAll: () => send('POST', '/api/sound/stop-all').then((r) => read<SoundOverview>(r)),
  master: (volume: number) =>
    send('PUT', '/api/sound/master-volume', { volume }).then((r) => read<SoundOverview>(r)),
  auto: (patch: Partial<SoundOverview['auto']>) =>
    send('PUT', '/api/sound/auto', patch).then((r) => read<SoundOverview>(r)),
};
