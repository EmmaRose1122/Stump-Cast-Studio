import { createPrivateKey, sign } from 'node:crypto';
import {
  type SelectorBundle,
  type SignedSelectorBundle,
} from './selectors';

/**
 * Developer test signing key strictly for local builds and unit tests.
 * Production keys are kept on server / CLI only (.secrets/selectors-private.key or STUMPCAST_SELECTORS_PRIVATE_KEY).
 */
export const TEST_SELECTORS_PRIVATE_KEY =
  process.env.STUMPCAST_SELECTORS_PRIVATE_KEY ??
  '59aff2b36e2243cda58af14c6bdd7b515ef547900004b910c24135d75ddc7f6b';

export async function signSelectorBundle(
  bundle: SelectorBundle,
  privateKeyHex: string = TEST_SELECTORS_PRIVATE_KEY,
): Promise<SignedSelectorBundle> {
  const payload = JSON.stringify(bundle);
  const dataBytes = Buffer.from(payload, 'utf8');

  const pkcs8Prefix = Buffer.from('302e020100300506032b657004220420', 'hex');
  const rawPriv = Buffer.from(privateKeyHex, 'hex');
  const pkcs8Key = Buffer.concat([pkcs8Prefix, rawPriv]);
  const privKey = createPrivateKey({ key: pkcs8Key, format: 'der', type: 'pkcs8' });
  const sig = sign(null, dataBytes, privKey);

  return {
    payload,
    signature: sig.toString('hex'),
    version: bundle.version,
    updatedAt: bundle.updatedAt,
  };
}
