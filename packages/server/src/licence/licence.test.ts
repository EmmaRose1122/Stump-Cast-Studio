import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { signLicenceToken, verifyLicenceToken } from './licence';

const keys = () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    pub: publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex'),
    priv: privateKey.export({ format: 'der', type: 'pkcs8' }).subarray(-32).toString('hex'),
  };
};
const NOW = 1_800_000_000;

describe('licence tokens', () => {
  const { pub, priv } = keys();
  const token = signLicenceToken({ v: 1, channel: '@mychannel', plan: 'yearly', iat: NOW, exp: NOW + 1000 }, priv);

  it('accepts a correctly signed token', () => {
    const r = verifyLicenceToken(token, NOW, pub);
    expect(r).toMatchObject({ valid: true, payload: { channel: '@mychannel', plan: 'yearly' } });
  });

  it('rejects an expired token', () => {
    expect(verifyLicenceToken(token, NOW + 2000, pub)).toEqual({ valid: false, reason: 'expired' });
  });

  it('lifetime tokens never expire', () => {
    const t = signLicenceToken({ v: 1, channel: 'x', plan: 'lifetime', iat: NOW }, priv);
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

  it('rejects garbage and the old accept-anything keys', () => {
    for (const bad of ['', 'abcd', 'PRO-1234', 'SC1.a', 'SC1.a.b.c']) {
      expect(verifyLicenceToken(bad, NOW, pub).valid).toBe(false);
    }
  });
});
