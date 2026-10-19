import { createPublicKey, sign, verify, createPrivateKey, type KeyObject } from 'node:crypto';
import { z } from 'zod';
import { LICENCE_PUBLIC_KEY_HEX } from './publicKey';

/**
 * Offline licence tokens (LC-3). Format: `SC1.<payload>.<signature>`, both base64url.
 * The payload is JSON signed with Ed25519; the app only ever holds the public key.
 */
export const LICENCE_PREFIX = 'SC1';

export const LicencePayloadSchema = z.object({
  v: z.literal(1),
  /** Channel handle the licence is bound to (LC-2). */
  channel: z.string().min(1).max(100),
  plan: z.enum(['monthly', 'yearly', 'lifetime']),
  /** Issued at, epoch seconds. */
  iat: z.number().int().nonnegative(),
  /** Expiry, epoch seconds. Omitted for lifetime plans. */
  exp: z.number().int().positive().optional(),
});
export type LicencePayload = z.infer<typeof LicencePayloadSchema>;

export type LicenceCheck =
  | { valid: true; payload: LicencePayload }
  | { valid: false; reason: 'malformed' | 'bad-signature' | 'expired' | 'invalid-payload' };

const SPKI_ED25519_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
const PKCS8_ED25519_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');

const publicKeyFromHex = (hex: string): KeyObject =>
  createPublicKey({
    key: Buffer.concat([SPKI_ED25519_PREFIX, Buffer.from(hex, 'hex')]),
    format: 'der',
    type: 'spki',
  });

export const verifyLicenceToken = (
  token: string,
  nowSec: number = Math.floor(Date.now() / 1000),
  publicKeyHex: string = process.env.STUMPCAST_LICENCE_PUBLIC_KEY ?? LICENCE_PUBLIC_KEY_HEX,
): LicenceCheck => {
  const parts = token.trim().split('.');
  if (parts.length !== 3 || parts[0] !== LICENCE_PREFIX) return { valid: false, reason: 'malformed' };
  const [, payloadPart, sigPart] = parts as [string, string, string];
  let signature: Buffer;
  try {
    signature = Buffer.from(sigPart, 'base64url');
    const ok = verify(null, Buffer.from(payloadPart, 'utf8'), publicKeyFromHex(publicKeyHex), signature);
    if (!ok) return { valid: false, reason: 'bad-signature' };
  } catch {
    return { valid: false, reason: 'bad-signature' };
  }
  let json: unknown;
  try {
    json = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
  } catch {
    return { valid: false, reason: 'invalid-payload' };
  }
  const parsed = LicencePayloadSchema.safeParse(json);
  if (!parsed.success) return { valid: false, reason: 'invalid-payload' };
  if (parsed.data.exp !== undefined && parsed.data.exp < nowSec) return { valid: false, reason: 'expired' };
  return { valid: true, payload: parsed.data };
};

/** Issuer side (used by scripts/sign-licence.mjs and tests). Never ship the private key. */
export const signLicenceToken = (payload: LicencePayload, privateKeyHex: string): string => {
  const payloadPart = Buffer.from(JSON.stringify(LicencePayloadSchema.parse(payload)), 'utf8').toString('base64url');
  const key = createPrivateKey({
    key: Buffer.concat([PKCS8_ED25519_PREFIX, Buffer.from(privateKeyHex, 'hex')]),
    format: 'der',
    type: 'pkcs8',
  });
  const sig = sign(null, Buffer.from(payloadPart, 'utf8'), key).toString('base64url');
  return `${LICENCE_PREFIX}.${payloadPart}.${sig}`;
};
