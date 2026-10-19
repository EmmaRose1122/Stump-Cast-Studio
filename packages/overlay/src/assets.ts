import { slug } from '@stumpcast/shared';

/** Bumped when the server announces `asset-updated`, so a replaced image is re-fetched. */
const versions = new Map<string, number>();
let counter = 0;

export const bumpAsset = (id: string): void => {
  versions.set(id, ++counter);
};

export const teamAssetId = (short: string): string => `team-${slug(short)}`;

export const assetUrl = (kind: 'players' | 'teams', id: string): string => {
  const v = versions.get(id);
  return `${location.origin}/assets/${kind}/${encodeURIComponent(id)}.webp${v ? `?v=${v}` : ''}`;
};

/**
 * Layer an image over a text fallback (initials, a letter). If the file does not exist the
 * request fails quietly and the fallback stays, so a missing photo never shows a broken icon.
 */
export const attachImage = (host: HTMLElement, src: string): void => {
  const img = document.createElement('img');
  img.alt = '';
  img.decoding = 'async';
  img.className = 'asset-img';
  img.style.display = 'none';
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
