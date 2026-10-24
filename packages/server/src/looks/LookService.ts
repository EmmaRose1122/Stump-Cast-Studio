import { eq } from 'drizzle-orm';
import {
  ALL_AVAILABLE_LOOKS,
  ALL_LOOKS,
  ALL_PRO_LOOKS,
  LookSchema,
  describeLook,
  type Look,
} from '@stumpcast/shared';
import { schema, type StumpCastDb } from '../db';

export class LookError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409 = 400,
  ) {
    super(message);
  }
}

export interface LookListing {
  id: string;
  name: string;
  plan: 'free' | 'pro';
  builtin: boolean;
  /** Pro looks are locked until a licence is active. */
  locked: boolean;
  active: boolean;
  /** Background, surface and accent colours for the picker tile. */
  swatches: string[];
  /** 2-4 short phrases naming what this look really does differently. */
  tags: string[];
}

/** Packs are small JSON documents; anything bigger is not a Look. */
export const MAX_LOOK_BYTES = 20_000;
const SLUG = /^[a-z0-9][a-z0-9-]{0,39}$/;
const TOP_KEYS = new Set(['id', 'name', 'plan', 'tokens', 'layoutVariant', 'motion', 'tags']);

/**
 * Installed Looks: the 8 built-ins plus validated user packs (B11). A Look is data only, so
 * importing one can never run code; unknown fields and oversized documents are rejected.
 */
export class LookService {
  constructor(
    private readonly db: StumpCastDb,
    private readonly isLicensed: () => boolean,
  ) {}

  private custom(): Look[] {
    return this.db
      .select()
      .from(schema.looks)
      .all()
      .flatMap((r) => {
        const p = LookSchema.safeParse(r.definition);
        return p.success ? [p.data] : [];
      });
  }

  all(): Look[] {
    return [...ALL_LOOKS, ...this.custom()];
  }

  catalog(): readonly Look[] {
    return ALL_PRO_LOOKS;
  }

  get(id: string): Look | undefined {
    return this.all().find((l) => l.id === id) ?? ALL_AVAILABLE_LOOKS.find((l: Look) => l.id === id);
  }

  list(activeId: string): LookListing[] {
    const builtin = new Set(ALL_LOOKS.map((l) => l.id));
    const licensed = this.isLicensed();
    return this.all().map((l) => ({
      id: l.id,
      name: l.name,
      plan: l.plan,
      builtin: builtin.has(l.id),
      locked: l.plan === 'pro' && !licensed,
      active: l.id === activeId,
      swatches: ('bg surface accent accent2'.split(' ') as string[])
        .map((k) => l.tokens.colors[k])
        .filter((c): c is string => !!c),
      // What this look actually changes on screen. Falls back to deriving the four axis labels
      // from the look itself, so a listing can never advertise a shape the look does not declare.
      tags: l.tags ?? describeLook(l),
    }));
  }

  /**
   * The look to put on air. A Pro look requires a licence, with no exceptions: the old
   * `allowPreview` escape let an unlicensed studio select a Pro look into its own preview window,
   * which is the selection the paid tier exists to gate.
   */
  require(id: string): Look {
    const look = this.get(id);
    if (!look) throw new LookError('Unknown look', 404);
    if (look.plan === 'pro' && !this.isLicensed()) {
      throw new LookError('This look needs a Pro licence', 403);
    }
    return look;
  }

  import(input: unknown): Look {
    const text = JSON.stringify(input) ?? '';
    if (text.length > MAX_LOOK_BYTES) throw new LookError('That look file is too large');
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      throw new LookError('A look must be a JSON object');
    }
    const unknown = Object.keys(input).filter((k) => !TOP_KEYS.has(k));
    if (unknown.length > 0) {
      throw new LookError(`Unknown field${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}`);
    }
    const parsed = LookSchema.safeParse(input);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      throw new LookError(
        `Invalid look: ${first?.path.join('.') ?? ''} ${first?.message ?? ''}`.trim(),
      );
    }
    const look = parsed.data;
    if (!SLUG.test(look.id)) {
      throw new LookError('The look id must be lowercase letters, numbers and dashes');
    }
    if (ALL_LOOKS.some((l) => l.id === look.id) || look.id === 'ink-gold') {
      throw new LookError('That id belongs to a built-in look', 409);
    }
    this.db
      .insert(schema.looks)
      .values({ id: look.id, name: look.name, plan: look.plan, definition: look })
      .onConflictDoUpdate({
        target: schema.looks.id,
        set: { name: look.name, plan: look.plan, definition: look },
      })
      .run();
    return look;
  }

  remove(id: string): void {
    if (ALL_LOOKS.some((l) => l.id === id) || id === 'ink-gold')
      throw new LookError('Built-in looks cannot be removed', 403);
    const existing = this.db.select().from(schema.looks).where(eq(schema.looks.id, id)).get();
    if (!existing) throw new LookError('Unknown look', 404);
    this.db.delete(schema.looks).where(eq(schema.looks.id, id)).run();
  }
}
