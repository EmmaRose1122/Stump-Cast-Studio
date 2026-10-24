import { createPrivateKey, generateKeyPairSync, sign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { LicencePayloadSchema, verifyLicenceToken, type LicencePayload } from './licence';
import { buildRevocationIndex } from './revoked';

const keys = () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    pub: publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex'),
    priv: privateKey.export({ format: 'der', type: 'pkcs8' }).subarray(-32).toString('hex'),
  };
};
const NOW = 1_800_000_000;

const signTestToken = (payload: LicencePayload, privateKeyHex: string): string => {
  const payloadPart = Buffer.from(JSON.stringify(LicencePayloadSchema.parse(payload)), 'utf8').toString('base64url');
  const privateKey = createPrivateKey({
    key: Buffer.concat([
      Buffer.from('302e020100300506032b657004220420', 'hex'),
      Buffer.from(privateKeyHex, 'hex'),
    ]),
    format: 'der',
    type: 'pkcs8',
  });
  const signature = sign(null, Buffer.from(payloadPart, 'utf8'), privateKey).toString('base64url');
  return `SC1.${payloadPart}.${signature}`;
};

describe('licence tokens', () => {
  const { pub, priv } = keys();
  const token = signTestToken({ v: 1, channel: '@mychannel', plan: 'yearly', iat: NOW, exp: NOW + 1000 }, priv);

  it('accepts a correctly signed token', () => {
    const r = verifyLicenceToken(token, NOW, pub);
    expect(r).toMatchObject({ valid: true, payload: { channel: '@mychannel', plan: 'yearly' } });
  });

  it('rejects an expired token', () => {
    expect(verifyLicenceToken(token, NOW + 2000, pub)).toEqual({ valid: false, reason: 'expired' });
  });

  it('lifetime tokens never expire', () => {
    const t = signTestToken({ v: 1, channel: 'x', plan: 'lifetime', iat: NOW }, priv);
    expect(verifyLicenceToken(t, NOW * 10, pub).valid).toBe(true);
  });

  it('rejects a tampered payload', () => {
    const [p, payload, sig] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ v: 1, channel: 'thief', plan: 'lifetime', iat: NOW })).toString('base64url');
    expect(verifyLicenceToken(`${p}.${forged}.${sig}`, NOW, pub)).toEqual({ valid: false, reason: 'bad-signature' });
    expect(payload).toBeTruthy();
  });

  it('rejects a token signed by another key', () => {
    expect(verifyLicenceToken(token, NOW, keys().pub)).toEqual({ valid: false, reason: 'bad-signature' });
  });

  it('rejects a key the seller expired by hand, even while it is still in date', () => {
    const byToken = buildRevocationIndex([{ token }], 'revoked.json');
    expect(verifyLicenceToken(token, NOW, pub, byToken)).toEqual({ valid: false, reason: 'revoked' });

    const byIdentity = buildRevocationIndex([{ channel: '@mychannel', iat: NOW }], 'revoked.json');
    expect(verifyLicenceToken(token, NOW, pub, byIdentity).valid).toBe(false);

    const lifetime = signTestToken({ v: 1, channel: '@mine', plan: 'lifetime', iat: NOW }, priv);
    const revokedLifetime = buildRevocationIndex([{ token: lifetime }], 'revoked.json');
    expect(verifyLicenceToken(lifetime, NOW, pub, revokedLifetime)).toEqual({ valid: false, reason: 'revoked' });
    // An empty list must not gate anything: only the entry the admin clicked goes dark.
    expect(verifyLicenceToken(lifetime, NOW, pub, buildRevocationIndex([], null)).valid).toBe(true);
  });

  it('enforces machine ID locking when token carries mid', () => {
    const midKey = signTestToken(
      { v: 1, channel: '@locked', plan: 'yearly', iat: NOW, mid: 'SC-E3AB-A4F4-48BB-8A55' },
      priv,
    );

    // Matching machine ID (even with different casing, whitespace or formatting)
    expect(verifyLicenceToken(midKey, NOW, pub, undefined, 'e3aba4f448bb8a55').valid).toBe(true);
    expect(verifyLicenceToken(midKey, NOW, pub, undefined, 'SC-E3AB-A4F4-48BB-8A55').valid).toBe(true);
    expect(verifyLicenceToken(midKey, NOW, pub, undefined, '  e3ab-a4f4-48bb-8a55  ').valid).toBe(true);

    // Mismatched machine ID
    expect(verifyLicenceToken(midKey, NOW, pub, undefined, 'DIFFERENT-MACHINE-ID')).toEqual({
      valid: false,
      reason: 'machine-mismatch',
    });

    // Missing expected machine ID when token requires one
    expect(verifyLicenceToken(midKey, NOW, pub)).toEqual({
      valid: false,
      reason: 'machine-mismatch',
    });
  });

  it('rejects garbage and the old accept-anything keys', () => {
    for (const bad of ['', 'abcd', 'PRO-1234', 'SC1.a', 'SC1.a.b.c']) {
      expect(verifyLicenceToken(bad, NOW, pub).valid).toBe(false);
    }
  });
});
