#!/usr/bin/env node
// Seller-side licence tool. Runs on YOUR machine; the private key must never ship with the app.
//
//   node scripts/licence-keygen.mjs --init
//   node scripts/licence-keygen.mjs --channel "@mychannel" --plan yearly [--days 45]
//   node scripts/licence-keygen.mjs --channel "@mychannel" --plan lifetime
//   node scripts/licence-keygen.mjs --verify "SC1...."
//
// A customer's app only ever holds the public half, so it can check a key but never make one.
import {
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
const PREFIX = 'SC1';
const PKCS8 = Buffer.from('302e020100300506032b657004220420', 'hex');
const SPKI = Buffer.from('302a300506032b6570032100', 'hex');
const PLANS = ['monthly', 'yearly', 'lifetime'];

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const has = (name) => process.argv.includes(`--${name}`);

const readHex = (file) => readFileSync(file, 'utf8').trim();
/** DER prefixes are fixed for Ed25519, so the raw half is whatever follows them. */
const rawHalf = (der, prefix) => der.subarray(prefix.length).toString('hex');
const privateKeyFrom = (hex) =>
  createPrivateKey({ key: Buffer.concat([PKCS8, Buffer.from(hex, 'hex')]), format: 'der', type: 'pkcs8' });
const publicKeyFrom = (hex) =>
  createPublicKey({ key: Buffer.concat([SPKI, Buffer.from(hex, 'hex')]), format: 'der', type: 'spki' });

const needPrivateKey = () => {
  if (!existsSync(PRIVATE)) {
    console.error(`No private key at ${PRIVATE}.\nCreate one first:  node scripts/licence-keygen.mjs --init`);
    process.exit(1);
  }
  return readHex(PRIVATE);
};

/** The shipped public half, derived from the private one when it was not saved separately. */
const publicKeyHex = (privateHex) =>
  existsSync(PUBLIC)
    ? readHex(PUBLIC)
    // A private key cannot be exported as SPKI; ask Node for its public half first.
    : rawHalf(
        createPublicKey(privateKeyFrom(privateHex)).export({ format: 'der', type: 'spki' }),
        SPKI,
      );

const init = () => {
  if (existsSync(PRIVATE)) {
    const pub = publicKeyHex(readHex(PRIVATE));
    console.log('A keypair already exists — nothing was changed.');
    console.log(`  private: ${PRIVATE}   (never copy this into the app or an installer)`);
    console.log(`  public : ${pub}`);
    return;
  }
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const priv = rawHalf(privateKey.export({ format: 'der', type: 'pkcs8' }), PKCS8);
  const pub = rawHalf(publicKey.export({ format: 'der', type: 'spki' }), SPKI);
  mkdirSync(path.dirname(PRIVATE), { recursive: true });
  writeFileSync(PRIVATE, `${priv}\n`);
  writeFileSync(PUBLIC, `${pub}\n`);
  console.log('New Ed25519 keypair written.');
  console.log(`  private: ${PRIVATE}   (KEEP THIS — if it is lost, every issued key stops working)`);
  console.log(`  public : ${pub}`);
  console.log('\nPut that public hex in packages/server/src/licence/publicKey.ts and rebuild the app');
  console.log('BEFORE issuing keys: a key signed here is worthless to an app built for another pair.');
};

const issue = () => {
  const channel = arg('channel');
  const plan = arg('plan', 'yearly');
  if (!channel || !PLANS.includes(plan)) {
    console.error(
      'Usage: node scripts/licence-keygen.mjs --channel "@handle" --plan ' +
        `${PLANS.join('|')} [--days N]\n` +
        '   or: node scripts/licence-keygen.mjs --init\n' +
        '   or: node scripts/licence-keygen.mjs --verify "SC1..."',
    );
    process.exit(1);
  }
  const days = arg('days') !== undefined ? Number(arg('days')) : plan === 'monthly' ? 31 : 366;
  if (plan !== 'lifetime' && (!Number.isInteger(days) || days < 1 || days > 36_500)) {
    console.error('--days must be a whole number between 1 and 36500');
    process.exit(1);
  }
  const key = privateKeyFrom(needPrivateKey());
  const iat = Math.floor(Date.now() / 1000);
  const payload = { v: 1, channel, plan, iat, ...(plan === 'lifetime' ? {} : { exp: iat + days * 86_400 }) };
  const part = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const token = `${PREFIX}.${part}.${sign(null, Buffer.from(part, 'utf8'), key).toString('base64url')}`;
  console.log(token);
  console.error(
    plan === 'lifetime'
      ? `\n${channel} — lifetime licence, never expires.`
      : `\n${channel} — ${plan} licence, expires ${new Date(payload.exp * 1000).toISOString().slice(0, 10)} (${days} days).`,
  );
  console.error('Send the line above to the customer: it is what they paste into the app.');
};

const check = () => {
  const token = (arg('verify') ?? '').trim();
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== PREFIX) {
    console.error('That is not an SC1 key.');
    process.exit(1);
  }
  const pub = publicKeyFrom(publicKeyHex(needPrivateKey()));
  const signatureOk = verify(null, Buffer.from(parts[1], 'utf8'), pub, Buffer.from(parts[2], 'base64url'));
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  const expired = payload.exp !== undefined && payload.exp < Math.floor(Date.now() / 1000);
  console.log(JSON.stringify(payload, null, 2));
  if (!signatureOk) console.error('BAD SIGNATURE — this key was not issued by this keypair.');
  else if (expired) console.error(`Signed here, but expired ${new Date(payload.exp * 1000).toISOString()}.`);
  else console.error('Valid.');
  process.exit(signatureOk && !expired ? 0 : 1);
};

if (has('init')) init();
else if (has('verify')) check();
else issue();
