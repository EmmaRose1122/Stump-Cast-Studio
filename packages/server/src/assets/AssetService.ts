import fs from 'node:fs';
import path from 'node:path';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import sharp, { type Sharp } from 'sharp';
import { slug } from '@stumpcast/shared';
import { schema, type StumpCastDb } from '../db';
import { safeFetchImage, type FetchedImage } from './safeFetch';

export type AssetType = 'player' | 'team' | 'background';

export class AssetError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 | 413 = 400,
  ) {
    super(message);
  }
}

export interface AssetRecord {
  id: string;
  type: AssetType;
  /** Path under the data dir's assets folder, e.g. players/aiden-markram.webp */
  file: string;
  png: string;
  rightsConfirmed: boolean;
  createdAt: number;
}

export interface ListOptions {
  type?: AssetType;
  q?: string;
  page?: number;
  pageSize?: number;
  sort?: 'newest' | 'oldest' | 'name';
}

const FOLDERS: Record<AssetType, string> = {
  player: 'players',
  team: 'teams',
  background: 'backgrounds',
};

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_PIXELS = 50_000_000;
const SVG_FORBIDDEN =
  /<\s*(script|image|use|foreignObject)\b|xlink:href|href\s*=|file:|javascript:/i;

/** Player id = slug of the name; team id = `team-<short>`; backgrounds use a slug. */
export const assetIdFor = (type: AssetType, input: { name?: string; short?: string }): string => {
  if (type === 'team') {
    const s = slug(input.short ?? '');
    if (!s) throw new AssetError('A team short name is required');
    return `team-${s}`;
  }
  const s = slug(input.name ?? '');
  if (!s) throw new AssetError('A name is required');
  return s;
};

export class AssetService {
  readonly root: string;

  constructor(
    private readonly db: StumpCastDb,
    dataDir: string,
    private readonly fetchImage: (url: string) => Promise<FetchedImage> = safeFetchImage,
    private readonly now: () => number = Date.now,
  ) {
    this.root = path.join(dataDir, 'assets');
    for (const f of Object.values(FOLDERS))
      fs.mkdirSync(path.join(this.root, f), { recursive: true });
    fs.mkdirSync(path.join(this.root, 'sounds'), { recursive: true });
  }

  // ---- images -----------------------------------------------------------------------------

  /** Validate, normalise (auto-trim, fit) and store an image as WebP + PNG. */
  async saveImage(input: {
    type: AssetType;
    id: string;
    buffer: Buffer;
    rightsConfirmed: boolean;
  }): Promise<{ asset: AssetRecord; replaced: boolean }> {
    if (!input.rightsConfirmed) {
      throw new AssetError('Please confirm you have the rights to use this image');
    }
    if (input.buffer.length === 0) throw new AssetError('The file is empty');
    if (input.buffer.length > MAX_UPLOAD_BYTES)
      throw new AssetError('That image is too large', 413);
    if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(input.id)) throw new AssetError('Invalid asset id');

    const head = input.buffer.subarray(0, 512).toString('utf8');
    if (head.includes('<svg') || head.includes('<?xml')) {
      if (SVG_FORBIDDEN.test(input.buffer.toString('utf8'))) {
        throw new AssetError('That SVG contains elements that are not allowed');
      }
    }

    const existing = this.db
      .select()
      .from(schema.assets)
      .where(eq(schema.assets.id, input.id))
      .get();
    if (existing && existing.type !== input.type) {
      throw new AssetError(`The id "${input.id}" is already used by a ${existing.type}`, 409);
    }

    const pipeline = (() => {
      let p: Sharp;
      try {
        p = sharp(input.buffer, { limitInputPixels: MAX_PIXELS, failOn: 'error' });
      } catch {
        throw new AssetError('That file is not a supported image');
      }
      return p;
    })();

    let webp: Buffer;
    let png: Buffer;
    try {
      const base = pipeline.rotate();
      let shaped: Sharp;
      if (input.type === 'player') {
        // Face is near the top: crop from the top, never the middle.
        shaped = base.trim().resize(512, 512, { fit: 'cover', position: 'top' });
      } else if (input.type === 'team') {
        shaped = base.trim().resize(256, 256, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        });
      } else {
        shaped = base.resize(1920, 1080, { fit: 'inside', withoutEnlargement: true });
      }
      const raw = await shaped.toBuffer();
      webp = await sharp(raw).webp({ quality: 86 }).toBuffer();
      png = await sharp(raw).png({ compressionLevel: 9 }).toBuffer();
    } catch (err) {
      if (err instanceof AssetError) throw err;
      throw new AssetError('That file could not be read as an image');
    }

    const folder = FOLDERS[input.type];
    const webpRel = `${folder}/${input.id}.webp`;
    const pngRel = `${folder}/${input.id}.png`;
    fs.writeFileSync(path.join(this.root, webpRel), webp);
    fs.writeFileSync(path.join(this.root, pngRel), png);

    const createdAt = this.now();
    this.db
      .insert(schema.assets)
      .values({
        id: input.id,
        type: input.type,
        file: webpRel,
        rightsConfirmed: true,
        createdAt,
      })
      .onConflictDoUpdate({
        target: schema.assets.id,
        set: { file: webpRel, rightsConfirmed: true, createdAt },
      })
      .run();

    return {
      asset: {
        id: input.id,
        type: input.type,
        file: webpRel,
        png: pngRel,
        rightsConfirmed: true,
        createdAt,
      },
      replaced: !!existing,
    };
  }

  async importUrl(input: { type: AssetType; id: string; url: string; rightsConfirmed: boolean }) {
    if (!input.rightsConfirmed) {
      throw new AssetError('Please confirm you have the rights to use this image');
    }
    let fetched: FetchedImage;
    try {
      fetched = await this.fetchImage(input.url);
    } catch (err) {
      throw new AssetError(err instanceof Error ? err.message : 'Could not download that image');
    }
    return this.saveImage({
      type: input.type,
      id: input.id,
      buffer: fetched.buffer,
      rightsConfirmed: input.rightsConfirmed,
    });
  }

  /**
   * Registers images that exist in the assets folders but have no library row (the bundled
   * default crests and photos are copied in as plain files). Existing rows are left alone, so
   * this is safe to run on every start and again from the admin.
   */
  syncFromDisk(): { added: number } {
    let added = 0;
    for (const [type, folder] of Object.entries(FOLDERS) as [AssetType, string][]) {
      const dir = path.join(this.root, folder);
      for (const name of fs.readdirSync(dir)) {
        const m = /^([a-z0-9][a-z0-9-]{0,79})\.webp$/.exec(name);
        if (!m?.[1] || this.has(m[1])) continue;
        this.db
          .insert(schema.assets)
          .values({ id: m[1], type, file: `${folder}/${name}`, rightsConfirmed: true, createdAt: this.now() })
          .onConflictDoNothing()
          .run();
        added++;
      }
    }
    return { added };
  }

  // ---- queries ----------------------------------------------------------------------------

  list(opts: ListOptions = {}) {
    const pageSize = Math.min(Math.max(opts.pageSize ?? 24, 1), 200);
    const page = Math.max(opts.page ?? 1, 1);
    const conds = [];
    if (opts.type) conds.push(eq(schema.assets.type, opts.type));
    if (opts.q) {
      // LIKE wildcards in user input are escaped so a search for "50%" means 50%.
      const escaped = opts.q.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`);
      conds.push(sql`lower(${schema.assets.id}) LIKE ${`%${escaped}%`} ESCAPE '\\'`);
    }
    const where = conds.length ? and(...conds) : undefined;
    const order =
      opts.sort === 'name'
        ? asc(schema.assets.id)
        : opts.sort === 'oldest'
          ? asc(schema.assets.createdAt)
          : desc(schema.assets.createdAt);

    const total =
      this.db
        .select({ n: sql<number>`count(*)` })
        .from(schema.assets)
        .where(where)
        .get()?.n ?? 0;
    const rows = this.db
      .select()
      .from(schema.assets)
      .where(where)
      .orderBy(order)
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .all();

    return {
      total,
      page,
      pageSize,
      items: rows.map((r) => this.record(r)),
    };
  }

  get(id: string): AssetRecord | undefined {
    const r = this.db.select().from(schema.assets).where(eq(schema.assets.id, id)).get();
    return r ? this.record(r) : undefined;
  }

  has(id: string): boolean {
    return this.db.select().from(schema.assets).where(eq(schema.assets.id, id)).get() !== undefined;
  }

  delete(id: string): void {
    const r = this.get(id);
    if (!r) throw new AssetError('Unknown asset', 404);
    for (const rel of [r.file, r.png]) fs.rmSync(path.join(this.root, rel), { force: true });
    this.db.delete(schema.assets).where(eq(schema.assets.id, id)).run();
  }

  /** Players and teams that are in the match but have no image yet. */
  missing(input: {
    players: { id: string; name: string; teamId?: string }[];
    teams: { id: string; short: string; name: string }[];
  }) {
    const seen = new Set<string>();
    const players = input.players.filter((p) => {
      if (seen.has(p.id) || p.name === '—') return false;
      seen.add(p.id);
      return !this.has(p.id);
    });
    const teams = input.teams
      .map((t) => ({ ...t, assetId: `team-${slug(t.short)}` }))
      .filter((t) => !this.has(t.assetId));
    return { players, teams };
  }

  private record(r: typeof schema.assets.$inferSelect): AssetRecord {
    return {
      id: r.id,
      type: r.type as AssetType,
      file: r.file,
      png: r.file.replace(/\.webp$/, '.png'),
      rightsConfirmed: r.rightsConfirmed,
      createdAt: r.createdAt,
    };
  }
}
