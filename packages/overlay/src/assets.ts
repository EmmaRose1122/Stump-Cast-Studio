import { resolveTeam, slug } from '@stumpcast/shared';

/** Bumped when the server announces `asset-updated`, so a replaced image is re-fetched. */
const versions = new Map<string, number>();
let counter = 0;

export const bumpAsset = (id: string): void => {
  versions.set(id, ++counter);
};

/**
 * Crest asset id for a team code/name, or `null` when it is not a team we have art for. Guessing
 * here is what used to put Sierra Leone's flag next to Sri Lanka, so an unknown side gets no crest.
 */
export const teamAssetId = (short: string): string | null => {
  const known = resolveTeam(short);
  if (known) return `team-${known.code}`;
  const s = slug(short);
  return s && s.length === 3 ? `team-${s}` : null;
};

export const assetUrl = (kind: 'players' | 'teams', id: string): string => {
  const v = versions.get(id);
  return `${location.origin}/assets/${kind}/${encodeURIComponent(id)}.webp${v ? `?v=${v}` : ''}`;
};

/**
 * A player photo with every fallback the store can hold: the live feed's id first, the name slug
 * second (the scraper and the asset library do not always agree), and webp → png → svg for each.
 * A feed that only carries `unknown-batter-1` still ends up on the drawn fallback instead of a
 * broken image, and a photo filed under the player's name is still found.
 */
export const attachPlayerPhoto = (host: HTMLElement, ids: string[]): void => {
  const slots = [...new Set(ids.filter((id) => !!id))];
  const candidates: string[] = [];
  for (const ext of ['webp', 'png', 'svg']) {
    for (const id of slots) {
      const v = ext === 'webp' ? versions.get(id) : undefined;
      candidates.push(`${location.origin}/assets/players/${encodeURIComponent(id)}.${ext}${v ? `?v=${v}` : ''}`);
    }
  }
  const next = (i: number): void => {
    if (i >= candidates.length) return;
    const img = document.createElement('img');
    img.alt = '';
    img.decoding = 'async';
    img.className = 'asset-img';
    img.style.display = 'none';
    img.addEventListener('load', () => {
      img.style.display = '';
      host.classList.add('has-image');
    });
    img.addEventListener('error', () => {
      img.remove();
      next(i + 1);
    });
    img.src = candidates[i]!;
    host.append(img);
  };
  next(0);
};

/**
 * Layer an image over a text fallback (initials, a letter). If the file does not exist the
 * request fails quietly and the fallback stays, so a missing photo never shows a broken icon.
 * Handles both local asset URLs and external URLs (Cricbuzz, Crex) with CORS support.
 */
export const attachImage = (host: HTMLElement, src: string): void => {
  const img = document.createElement('img');
  img.alt = '';
  img.decoding = 'async';
  img.className = 'asset-img';
  img.style.display = 'none';
  // Enable CORS for external images (Cricbuzz, Crex player photos)
  if (src.startsWith('http://') || src.startsWith('https://')) {
    img.crossOrigin = 'anonymous';
  }
  let retried = false;
  img.addEventListener('load', () => {
    img.style.display = '';
    host.classList.add('has-image');
  });
  img.addEventListener('error', () => {
    if (!retried && src.includes('.webp')) {
      retried = true;
      img.src = src.replace('.webp', '.svg');
      return;
    }
    img.remove();
  });
  img.src = src;
  host.append(img);
};
