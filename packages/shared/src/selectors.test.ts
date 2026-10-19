import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SELECTORS_PUBLIC_KEY,
  verifySignedSelectorBundle,
  type SelectorBundle,
} from './selectors';
import { signSelectorBundle } from './sign';

describe('Selector signing and verification', () => {
  const sampleBundle: SelectorBundle = {
    version: 20260401,
    updatedAt: 1775000000000,
    selectors: {
      cricbuzz: {
        version: 1,
        site: 'cricbuzz',
        urlPatterns: ['^https://www\\.cricbuzz\\.com/live-cricket-scores/\\d+'],
        dom: {
          title: { selectors: ['.cb-nav-hdr'] },
        },
      },
      crex: {
        version: 1,
        site: 'crex',
        urlPatterns: ['^https://crex\\.live/scoreboard/\\d+'],
        dom: {
          title: { selectors: ['.match-info-title'] },
        },
      },
    },
  };

  it('signs and verifies a valid bundle', async () => {
    const signed = await signSelectorBundle(sampleBundle);
    expect(signed.version).toBe(sampleBundle.version);
    expect(signed.signature).toMatch(/^[0-9a-f]{128}$/i);

    const verified = await verifySignedSelectorBundle(signed, DEFAULT_SELECTORS_PUBLIC_KEY);
    expect(verified.valid).toBe(true);
    expect(verified.bundle).toEqual(sampleBundle);
  });

  it('rejects a tampered payload', async () => {
    const signed = await signSelectorBundle(sampleBundle);
    // Tamper with payload
    const tamperedPayload = signed.payload.replace('.cb-nav-hdr', '.tampered-selector');
    const tampered = { ...signed, payload: tamperedPayload };

    const verified = await verifySignedSelectorBundle(tampered, DEFAULT_SELECTORS_PUBLIC_KEY);
    expect(verified.valid).toBe(false);
    expect(verified.error).toBeDefined();
  });

  it('rejects a tampered signature', async () => {
    const signed = await signSelectorBundle(sampleBundle);
    // Tamper with signature
    const badSig =
      signed.signature.slice(0, 10) +
      (signed.signature[10] === 'a' ? 'b' : 'a') +
      signed.signature.slice(11);
    const tampered = { ...signed, signature: badSig };

    const verified = await verifySignedSelectorBundle(tampered, DEFAULT_SELECTORS_PUBLIC_KEY);
    expect(verified.valid).toBe(false);
  });

  it('rejects an envelope with mismatched version metadata', async () => {
    const signed = await signSelectorBundle(sampleBundle);
    const mismatched = { ...signed, version: 9999999 };

    const verified = await verifySignedSelectorBundle(mismatched, DEFAULT_SELECTORS_PUBLIC_KEY);
    expect(verified.valid).toBe(false);
  });

  it('rejects verification with wrong public key', async () => {
    const signed = await signSelectorBundle(sampleBundle);
    const wrongKey = '0000000000000000000000000000000000000000000000000000000000000000';

    const verified = await verifySignedSelectorBundle(signed, wrongKey);
    expect(verified.valid).toBe(false);
  });
});
