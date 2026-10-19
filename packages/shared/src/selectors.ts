import { z } from 'zod';

export const DEFAULT_SELECTORS_PUBLIC_KEY =
  '4574bdfef7bd3781d6ed3b172374e7af44c92a9c2655276da4931e3311799c5a';

export const SelectorBundleSchema = z.object({
  version: z.number().int().positive(),
  updatedAt: z.number().int().nonnegative(),
  selectors: z.record(z.string(), z.any()),
});
export type SelectorBundle = z.infer<typeof SelectorBundleSchema>;

export const SignedSelectorBundleSchema = z.object({
  payload: z.string().min(1),
  signature: z.string().regex(/^[0-9a-fA-F]+$/),
  version: z.number().int().positive(),
  updatedAt: z.number().int().nonnegative(),
});
export type SignedSelectorBundle = z.infer<typeof SignedSelectorBundleSchema>;

export const SelectorStatusSchema = z.object({
  version: z.number().int().positive(),
  updatedAt: z.number().int().nonnegative(),
  source: z.enum(['bundled', 'remote']),
  hasUpdate: z.boolean(),
  lastCheckedAt: z.number().int().nonnegative().optional(),
});
export type SelectorStatus = z.infer<typeof SelectorStatusSchema>;

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim();
  if (clean.length % 2 !== 0) throw new Error('Invalid hex string');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16);
  }
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b !== undefined) {
      hex += b.toString(16).padStart(2, '0');
    }
  }
  return hex;
}

export async function verifySignedSelectorBundle(
  signed: unknown,
  publicKeyHex: string = DEFAULT_SELECTORS_PUBLIC_KEY,
): Promise<{ valid: boolean; bundle?: SelectorBundle; error?: string }> {
  const parsed = SignedSelectorBundleSchema.safeParse(signed);
  if (!parsed.success) {
    return { valid: false, error: 'Malformed signed selector envelope' };
  }

  const { payload, signature, version, updatedAt } = parsed.data;

  let bundle: SelectorBundle;
  try {
    const raw = JSON.parse(payload);
    const bundleParsed = SelectorBundleSchema.safeParse(raw);
    if (!bundleParsed.success) {
      return { valid: false, error: 'Malformed bundle JSON payload' };
    }
    bundle = bundleParsed.data;
  } catch {
    return { valid: false, error: 'Invalid JSON payload' };
  }

  if (bundle.version !== version || bundle.updatedAt !== updatedAt) {
    return { valid: false, error: 'Envelope metadata does not match payload' };
  }

  const rawPubBytes = hexToBytes(publicKeyHex);
  const sigBytes = hexToBytes(signature);
  const dataBytes = new TextEncoder().encode(payload);

  try {
    if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
      // Cast to any to avoid requiring DOM lib BufferSource types in pure shared package
      const subtle = globalThis.crypto.subtle as {
        importKey: (...args: unknown[]) => Promise<unknown>;
        verify: (...args: unknown[]) => Promise<boolean>;
      };
      const pubKey = await subtle.importKey(
        'raw',
        rawPubBytes,
        { name: 'Ed25519' },
        false,
        ['verify'],
      );
      const ok = await subtle.verify(
        { name: 'Ed25519' },
        pubKey,
        sigBytes,
        dataBytes,
      );
      if (ok) return { valid: true, bundle };
    }
  } catch {
    // subtle verify failed
  }

  return { valid: false, error: 'Signature verification failed (tampered bundle)' };
}
