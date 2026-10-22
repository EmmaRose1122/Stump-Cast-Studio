// Shared licence crypto — the single source of truth for StumpCast SC1 keys.
//
// Two front-ends read this file, so neither can drift from the other:
//   * scripts/licence-keygen.mjs            (the seller CLI, and licence-keygen.bat)
//   * ../key generator/server.mjs    (the desktop key-generator app, outside the pnpm workspace)
//
// The private half lives in .secrets/licence-private.key on the seller's machine and must never
// be printed, logged, shipped or handed to a UI. This module therefore exposes the private key
// only as a PATH and as a boolean; only issueToken() ever touches the secret itself.
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign,
  verify,
} from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PRIVATE = path.join(ROOT, '.secrets', 'licence-private.key');
const PUBLIC = path.join(ROOT, '.secrets', 'licence-public.key');

export const PREFIX = 'SC1';
export const PLANS = ['monthly', 'yearly', 'lifetime'];
export const DEFAULT_DAYS = { monthly: 31, yearly: 366 };
/** Path is safe to show; the contents never are. */
export const privateKeyPath = PRIVATE;
export const publicKeyPath = PUBLIC;

const PKCS8 = Buffer.from('302e020100300506032b657004220420', 'hex');
const SPKI = Buffer.from('302a300506032b6570032100', 'hex');

const readHex = (file) => readFileSync(file, 'utf8').trim();
/** DER prefixes are fixed for Ed25519, so the raw half is whatever follows them. */
const rawHalf = (der, prefix) => der.subarray(prefix.length).toString('hex');
const privateKeyFrom = (hex) =>
  createPrivateKey({ key: Buffer.concat([PKCS8, Buffer.from(hex, 'hex')]), format: 'der', type: 'pkcs8' });
const publicKeyFrom = (hex) =>
  createPublicKey({ key: Buffer.concat([SPKI, Buffer.from(hex, 'hex')]), format: 'der', type: 'spki' });

export const hasPrivateKey = () => existsSync(PRIVATE);

/** Throws instead of exiting: a caller in a server can catch this, a CLI cannot. */
const needPrivateKey = () => {
  if (!hasPrivateKey()) {
    throw new Error(
      `No private key at ${PRIVATE}.\nCreate one first:  node scripts/licence-keygen.mjs --init`,
    );
  }
  return readHex(PRIVATE);
};

/** The shipped public half, derived from the private one when it was not saved separately. */
export const publicKeyHex = (privateHex = needPrivateKey()) =>
  existsSync(PUBLIC)
    ? readHex(PUBLIC)
    // A private key cannot be exported as SPKI; ask Node for its public half first.
    : rawHalf(
        createPublicKey(privateKeyFrom(privateHex)).export({ format: 'der', type: 'spki' }),
        SPKI,
      );

/**
 * Writes a fresh Ed25519 keypair unless one already exists.
 * Returns the public hex and both paths; the private hex is deliberately not returned.
 */
export const initKeypair = () => {
  if (hasPrivateKey()) {
    return { created: false, publicHex: publicKeyHex(readHex(PRIVATE)), privatePath: PRIVATE, publicPath: PUBLIC };
  }
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const priv = rawHalf(privateKey.export({ format: 'der', type: 'pkcs8' }), PKCS8);
  const pub = rawHalf(publicKey.export({ format: 'der', type: 'spki' }), SPKI);
  mkdirSync(path.dirname(PRIVATE), { recursive: true });
  writeFileSync(PRIVATE, `${priv}\n`);
  writeFileSync(PUBLIC, `${pub}\n`);
  return { created: true, publicHex: pub, privatePath: PRIVATE, publicPath: PUBLIC };
};

export const normalizeMachineId = (id) =>
  String(id ?? '')
    .trim()
    .toUpperCase()
    .replace(/^SC-?/, '')
    .replace(/[^A-Z0-9]/g, '');

/** Mints an SC1 token. `days` is ignored for lifetime plans. Optional `mid` locks the key to a machine ID. */
export const issueToken = ({ channel, plan, days, mid, nowSec = Math.floor(Date.now() / 1000) }) => {
  if (typeof channel !== 'string' || channel.trim() === '') {
    throw new TypeError('A channel is required');
  }
  if (!PLANS.includes(plan)) throw new TypeError(`Plan must be one of ${PLANS.join(', ')}`);
  const trimmed = channel.trim();
  if (trimmed.length > 100) throw new RangeError('Channel must be 100 characters or fewer');

  let normalizedMid = null;
  if (mid !== undefined && mid !== null && String(mid).trim() !== '') {
    normalizedMid = normalizeMachineId(mid);
    if (normalizedMid.length < 4) {
      throw new RangeError('Machine ID is too short');
    }
  }

  let resolvedDays;
  if (plan === 'lifetime') {
    resolvedDays = null;
  } else {
    resolvedDays = days === undefined || days === null || days === '' ? DEFAULT_DAYS[plan] : Number(days);
    if (!Number.isInteger(resolvedDays) || resolvedDays < 1 || resolvedDays > 36_500) {
      throw new RangeError('days must be a whole number between 1 and 36500');
    }
  }

  const payload = {
    v: 1,
    channel: trimmed,
    plan,
    iat: nowSec,
    ...(normalizedMid ? { mid: normalizedMid } : {}),
    ...(resolvedDays === null ? {} : { exp: nowSec + resolvedDays * 86_400 }),
  };
  const part = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const token = `${PREFIX}.${part}.${sign(null, Buffer.from(part, 'utf8'), privateKeyFrom(needPrivateKey())).toString('base64url')}`;
  return { token, payload, days: resolvedDays };
};

/** Decodes a token WITHOUT trusting it — payload-only, for the ledger and the UI. */
export const decodeToken = (token) => {
  const parts = String(token ?? '').trim().split('.');
  if (parts.length !== 3 || parts[0] !== PREFIX) throw new TypeError('That is not an SC1 key');
  return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
};

/** Signature + expiry check against this keypair. Optional expectedMachineId validates hardware lock. */
export const verifyToken = (token, nowSec = Math.floor(Date.now() / 1000), expectedMachineId = null) => {
  const parts = String(token ?? '').trim().split('.');
  if (parts.length !== 3 || parts[0] !== PREFIX) return { ok: false, reason: 'malformed', payload: null };
  const signatureOk = (() => {
    try {
      return verify(null, Buffer.from(parts[1], 'utf8'), publicKeyFrom(publicKeyHex()), Buffer.from(parts[2], 'base64url'));
    } catch {
      return false;
    }
  })();
  let payload;
  try {
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'invalid-payload', payload: null, signatureOk };
  }
  const expired = payload?.exp !== undefined && payload.exp < nowSec;
  const machineMismatch =
    payload?.mid &&
    expectedMachineId &&
    normalizeMachineId(payload.mid) !== normalizeMachineId(expectedMachineId);

  const ok = signatureOk && !expired && !machineMismatch;
  const reason = !signatureOk
    ? 'bad-signature'
    : expired
      ? 'expired'
      : machineMismatch
        ? 'machine-mismatch'
        : null;

  return { ok, reason, payload, signatureOk, machineMismatch: Boolean(machineMismatch) };
};

/**
 * Stable identity for a token, used to match a revocation to the row the admin clicked.
 * sha256 over the whole token, first 16 hex characters. The server mirrors this exact recipe in
 * packages/server/src/licence/revoked.ts; revoked.json also stores the full token so an
 * agreement on the hash is never the only thing standing between a revoked key and the free tier.
 */
export const fingerprintOf = (token) =>
  createHash('sha256').update(String(token)).digest('hex').slice(0, 16);

export default { PREFIX, PLANS, issueToken, verifyToken, decodeToken, initKeypair, publicKeyHex, hasPrivateKey, privateKeyPath, fingerprintOf, normalizeMachineId };
