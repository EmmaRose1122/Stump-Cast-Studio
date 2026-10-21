import { slug, type MatchState, type RawUpdate } from '@stumpcast/shared';
import { assetIdFor, type AssetService } from './AssetService';

/**
 * Hosts a crest or photo may come from. The scraped page decides which image to show, so without
 * an allow list any page that renders an `<img>` could point the studio's own server at an
 * arbitrary address. These are the CDNs the supported score sites actually use.
 */
const ALLOWED_HOSTS = [
  /\.akamaized\.net$/i, // crex crests (cricketvectors.akamaized.net/Teams/<id>.png)
  /\.crex\.com$/i,
  /\.crex\.live$/i,
  /\.cricbuzz\.com$/i,
  /\.cricketeams\.com$/i,
];

const allowed = (url: string | undefined): url is string => {
  if (!url) return false;
  try {
    return ALLOWED_HOSTS.some((re) => re.test(new URL(url).hostname));
  } catch {
    return false;
  }
};

const sameName = (a: string | undefined, b: string | undefined): boolean =>
  !!a && !!b && a.trim().toLowerCase().replace(/\s+/g, ' ') === b.trim().toLowerCase().replace(/\s+/g, ' ');

interface Wanted {
  id: string;
  url: string;
  type: 'team' | 'player';
}

/**
 * Files the pictures the live page already shows.
 *
 * The studio never guesses where a team's crest lives: the page the operator is watching carries
 * it, and the first time an unknown side or batter appears on air its image is downloaded into the
 * asset store under the same id the overlay already asks for. From then on it is local, so a
 * broadcast does not depend on the score site being reachable.
 */
export class AutoAssets {
  /** Ids already fetched or already known to have failed — one attempt per id per run. */
  private readonly attempted = new Set<string>();
  private chain: Promise<void> = Promise.resolve();
  private addedCount = 0;

  constructor(
    private readonly assets: AssetService,
    private readonly opts: {
      enabled: () => boolean;
      onAdded?: (kind: 'team' | 'player', id: string) => void;
      onError?: (id: string, err: unknown) => void;
    } = { enabled: () => true },
  ) {}

  /**
   * Called with every scraped update and the state it produced. Cheap and synchronous: the work
   * itself is queued, because a slow image download must never delay a score going on air.
   */
  consider(raw: RawUpdate, state: MatchState): void {
    if (!this.opts.enabled()) return;
    for (const w of this.wanted(raw, state)) {
      if (this.attempted.has(w.id) || this.assets.has(w.id)) continue;
      this.attempted.add(w.id);
      this.chain = this.chain.then(() => this.fetch(w));
    }
  }

  /** Await everything queued so far. Used by tests and by a clean shutdown. */
  idle(): Promise<void> {
    return this.chain;
  }

  get added(): number {
    return this.addedCount;
  }

  private wanted(raw: RawUpdate, state: MatchState): Wanted[] {
    const out: Wanted[] = [];
    const f = raw.fields;

    for (const team of state.teams) {
      const scraped = f.teams.find((t) => sameName(t.name, team.name) || sameName(t.short, team.short));
      const url = scraped?.logoUrl;
      if (!allowed(url)) continue;
      // The overlay asks for `team-<code>` for a known side and `team-<short>` otherwise; storing
      // under any other id would download a crest nobody ever requests.
      out.push({ type: 'team', id: team.logoAssetId ?? `team-${slug(team.short)}`, url });
    }

    const pictures = new Map<string, string>();
    for (const b of f.batters ?? []) if (allowed(b.imageUrl)) pictures.set(b.name.toLowerCase(), b.imageUrl);
    if (allowed(f.bowler?.imageUrl) && f.bowler) pictures.set(f.bowler.name.toLowerCase(), f.bowler.imageUrl);

    const seen = new Set<string>();
    for (const p of [...(state.batters ?? []), state.bowler]) {
      const url = p && pictures.get(p.name.toLowerCase().replace(/\s+/g, ' '));
      if (!p || !url || seen.has(p.playerId)) continue;
      seen.add(p.playerId);
      out.push({ type: 'player', id: assetIdFor('player', { name: p.name }), url });
    }
    return out;
  }

  private async fetch(w: Wanted): Promise<void> {
    try {
      await this.assets.importUrl({ type: w.type, id: w.id, url: w.url, rightsConfirmed: true });
      this.addedCount++;
      this.opts.onAdded?.(w.type, w.id);
    } catch (err) {
      // A page that shows a broken image, a 404, a hotlink block: none of them are worth
      // retrying every ball, and none of them should touch the score.
      this.opts.onError?.(w.id, err);
    }
  }
}
