import { ApiError } from './api';

export type AssetType = 'player' | 'team' | 'background';

export interface AssetItem {
  id: string;
  type: AssetType;
  file: string;
  png: string;
  rightsConfirmed: boolean;
  createdAt: number;
}

export interface AssetPage {
  total: number;
  page: number;
  pageSize: number;
  items: AssetItem[];
}

export interface MissingReport {
  players: { id: string; name: string; teamId?: string }[];
  teams: { id: string; short: string; name: string; assetId: string }[];
}

export interface ListParams {
  type?: AssetType | '';
  q?: string;
  page?: number;
  pageSize?: number;
  sort?: 'newest' | 'oldest' | 'name';
}

const read = async <T>(res: Response): Promise<T> => {
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new ApiError(res.status, body.error ?? `${res.status} ${res.statusText}`);
  return body;
};

export const assetsApi = {
  list: (p: ListParams) => {
    const qs = new URLSearchParams();
    if (p.type) qs.set('type', p.type);
    if (p.q) qs.set('q', p.q);
    qs.set('page', String(p.page ?? 1));
    qs.set('pageSize', String(p.pageSize ?? 24));
    qs.set('sort', p.sort ?? 'newest');
    return fetch(`/api/assets?${qs}`).then((r) => read<AssetPage>(r));
  },

  /** Fields are appended before the file: the server reads them in stream order. */
  upload: (input: {
    type: AssetType;
    name?: string;
    short?: string;
    rights: boolean;
    file: File;
  }) => {
    const form = new FormData();
    form.append('type', input.type);
    if (input.name) form.append('name', input.name);
    if (input.short) form.append('short', input.short);
    form.append('rightsConfirmed', String(input.rights));
    form.append('file', input.file);
    return fetch('/api/assets', { method: 'POST', body: form }).then((r) =>
      read<AssetItem & { replaced: boolean }>(r),
    );
  },

  importUrl: (input: {
    type: AssetType;
    name?: string;
    short?: string;
    url: string;
    rights: boolean;
  }) =>
    fetch('/api/assets/url', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...input, rightsConfirmed: input.rights }),
    }).then((r) => read<AssetItem & { replaced: boolean }>(r)),

  remove: (id: string) =>
    fetch(`/api/assets/${encodeURIComponent(id)}`, { method: 'DELETE' }).then((r) =>
      read<{ ok: true }>(r),
    ),

  missing: (matchId: string) =>
    fetch(`/api/assets/missing?matchId=${encodeURIComponent(matchId)}`).then((r) =>
      read<MissingReport>(r),
    ),
};

export const pageCount = (total: number, pageSize: number): number =>
  Math.max(1, Math.ceil(total / Math.max(1, pageSize)));

/** URL of the stored image for an asset (served by the data folder's static route). */
export const assetFileUrl = (item: Pick<AssetItem, 'file'>, bust?: number): string =>
  `/assets/${item.file}${bust ? `?v=${bust}` : ''}`;
