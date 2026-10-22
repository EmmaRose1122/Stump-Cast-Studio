import type { RawUpdate } from '@stumpcast/shared';

/**
 * Paths the score sites use for the two kinds of picture we want. Anything else on the page —
 * sponsor banners, a series logo, a shirt graphic — is not a player photo or a team crest.
 * `/jersey/` is deliberately excluded: crex renders a jersey next to a player, and a shirt is not
 * a face.
 */
const CREST_PATH = '/Teams/';
const PHOTO_PATHS = ['/players/', 'cFancode'];
const NOT_A_PHOTO = '/jersey/';

const norm = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Words crex appends to a picture label ("S Thanikaithasan Logo") that are not part of a name. */
const DECORATION = new Set(['logo', 'photo', 'picture', 'pic', 'image', 'player', 'avatar', 'headshot']);

/**
 * Does this label name this player? crex writes `alt="S Thanikaithasan Logo"` for
 * "Shangeev Thanikaithasan", so an exact match never fires. A label matches when its surname
 * matches and every leading token is either the same word or that word's initial.
 */
const labelNames = (label: string, playerName: string): boolean => {
  const l = norm(label)
    .split(' ')
    .filter((t) => t && !DECORATION.has(t));
  const p = norm(playerName).split(' ').filter(Boolean);
  if (l.length === 0 || p.length === 0) return false;
  const surname = p[p.length - 1]!;
  if (!l.includes(surname)) return false;
  const before = p.slice(0, -1);
  const extras = l.filter((t) => t !== surname);
  return extras.every((t) => before.some((b) => b === t || b.startsWith(t[0] ?? '')));
};

const absolute = (src: string | null, base: string): string | undefined => {
  if (!src) return undefined;
  try {
    const url = new URL(src, base);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined;
  } catch {
    return undefined;
  }
};

const namesOf = (...values: (string | undefined)[]): string[] =>
  values.filter((v): v is string => Boolean(v)).map(norm).filter((v) => v.length > 1);

/**
 * Does this image belong to one of these names? Checked by walking up from the image (a photo sits
 * inside the row that names the player) and by the `alt`/`title` the site writes on it.
 *
 * Pairing by name is deliberate: a positional selector on a page that lists three matches, an ad
 * and a squad would happily attach the wrong face to a batter, and a wrong face on air is far
 * worse than no face.
 */
const belongsTo = (img: HTMLImageElement, names: string[], player?: string): boolean => {
  if (names.length === 0) return false;
  const label = norm(`${img.getAttribute('alt') ?? ''} ${img.getAttribute('title') ?? ''}`);
  if (names.some((n) => label === n || label.includes(n))) return true;
  // Abbreviated labels ("S Thanikaithasan Logo") only ever name one player, so they are matched
  // against the single name we are looking for rather than the team's pair of candidates.
  if (player && label && labelNames(label, player)) return true;
  let node: Element | null = img.parentElement;
  for (let depth = 0; node && depth < 5; depth++) {
    const text = norm(node.textContent ?? '');
    if (names.some((n) => text.includes(n))) return true;
    node = node.parentElement;
  }
  return false;
};

const picturesUnder = (doc: Document, parts: string[], not?: string): HTMLImageElement[] =>
  [...doc.querySelectorAll('img')]
    .filter((img): img is HTMLImageElement => {
      const src = img.getAttribute('src');
      if (typeof src !== 'string') return false;
      if (!parts.some((p) => src.includes(p))) return false;
      return !(not && src.includes(not));
    })
    .map((img) => img);

/**
 * Attaches the crest and player photos the page itself shows to a scraped update, matched by name.
 * The server files whatever arrives here into the asset store, so a new team or a new batter gets
 * its picture on air the first time it appears — no upload, and no invented face.
 */
export const attachPictures = (update: RawUpdate, doc: Document, base: string): void => {
  const f = update.fields;

  const crests = picturesUnder(doc, [CREST_PATH]);
  for (const team of f.teams) {
    const names = namesOf(team.name, team.short);
    const hit = crests.find((img) => belongsTo(img, names));
    const url = absolute(hit?.getAttribute('src') ?? null, base);
    if (url) team.logoUrl = url;
  }

  const photos = picturesUnder(doc, PHOTO_PATHS, NOT_A_PHOTO);
  const find = (name: string | undefined): string | undefined => {
    const names = namesOf(name);
    if (names.length === 0 || !name) return undefined;
    const hit = photos.find((img) => belongsTo(img, names, name));
    return absolute(hit?.getAttribute('src') ?? null, base);
  };
  for (const batter of f.batters) {
    const url = find(batter.name);
    if (url) batter.imageUrl = url;
  }
  if (f.bowler) {
    const url = find(f.bowler.name);
    if (url) f.bowler.imageUrl = url;
  }
};
