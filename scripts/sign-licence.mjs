// Issues a licence token. Run on YOUR machine only; the private key must never ship with the app.
// Usage: node scripts/sign-licence.mjs --channel @handle --plan monthly|yearly|lifetime [--days 30] [--key .secrets/licence-private.key]
import { createPrivateKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const channel = arg('channel');
const plan = arg('plan', 'yearly');
if (!channel || !['monthly', 'yearly', 'lifetime'].includes(plan)) {
  console.error('Usage: node scripts/sign-licence.mjs --channel @handle --plan monthly|yearly|lifetime [--days N] [--key file]');
  process.exit(1);
}
const days = Number(arg('days', plan === 'monthly' ? 31 : 366));
const keyHex = readFileSync(arg('key', '.secrets/licence-private.key'), 'utf8').trim();
const iat = Math.floor(Date.now() / 1000);
const payload = { v: 1, channel, plan, iat, ...(plan === 'lifetime' ? {} : { exp: iat + days * 86400 }) };
const payloadPart = Buffer.from(JSON.stringify(payload)).toString('base64url');
const key = createPrivateKey({
  key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), Buffer.from(keyHex, 'hex')]),
  format: 'der',
  type: 'pkcs8',
});
console.log(`SC1.${payloadPart}.${sign(null, Buffer.from(payloadPart), key).toString('base64url')}`);
