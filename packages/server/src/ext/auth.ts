import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { StumpCastDb } from '../db';
import { schema } from '../db';

const TOKENS_KEY = 'ext.tokens';
const CODE_TTL_MS = 5 * 60_000;
const MAX_ATTEMPTS = 5;

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

/** 6-digit pairing codes (single use, 5 min, 5 wrong tries) and long bearer tokens (hashed). */
export class ExtensionAuth {
  private code: { value: string; expiresAt: number; attempts: number } | null = null;

  constructor(
    private readonly db: StumpCastDb,
    private readonly now: () => number = Date.now,
  ) {}

  createCode(): { code: string; expiresAt: number } {
    const value = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    this.code = { value, expiresAt: this.now() + CODE_TTL_MS, attempts: 0 };
    return { code: value, expiresAt: this.code.expiresAt };
  }

  /** Returns a new token if the code is valid, else null. */
  redeem(code: string): string | null {
    const c = this.code;
    if (!c || this.now() > c.expiresAt) {
      this.code = null;
      return null;
    }
    c.attempts++;
    const ok =
      code.length === c.value.length &&
      crypto.timingSafeEqual(Buffer.from(code), Buffer.from(c.value));
    if (!ok) {
      if (c.attempts >= MAX_ATTEMPTS) this.code = null;
      return null;
    }
    this.code = null; // single use
    const token = crypto.randomBytes(32).toString('base64url');
    this.saveHashes([...this.hashes(), sha256(token)]);
    return token;
  }

  verify(token: string | undefined): boolean {
    if (!token) return false;
    const h = sha256(token);
    return this.hashes().includes(h);
  }

  revokeAll(): void {
    this.saveHashes([]);
  }

  private hashes(): string[] {
    const row = this.db
      .select()
      .from(schema.settings)
      .where(eq(schema.settings.key, TOKENS_KEY))
      .get();
    return Array.isArray(row?.value) ? (row.value as string[]) : [];
  }

  private saveHashes(value: string[]): void {
    this.db
      .insert(schema.settings)
      .values({ key: TOKENS_KEY, value })
      .onConflictDoUpdate({ target: schema.settings.key, set: { value } })
      .run();
  }
}

export const bearerToken = (header: string | undefined): string | undefined => {
  const m = /^Bearer\s+(.+)$/i.exec(header ?? '');
  return m?.[1];
};
