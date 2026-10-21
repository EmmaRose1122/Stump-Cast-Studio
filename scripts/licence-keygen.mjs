#!/usr/bin/env node
// Seller-side licence tool. Runs on YOUR machine; the private key must never ship with the app.
//
//   node scripts/licence-keygen.mjs --init
//   node scripts/licence-keygen.mjs --channel "@mychannel" --plan yearly
//   node scripts/licence-keygen.mjs --channel "@mychannel" --plan monthly --days 45
//   node scripts/licence-keygen.mjs --channel "@mychannel" --plan lifetime
//   node scripts/licence-keygen.mjs --verify "SC1...."
//
// A customer's app only ever holds the public half, so it can check a key but never make one.
import { createHash, generateKeyPairSync, sign, verify } from 'node:crypto';
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

const arg = (name, fallback = undefined) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const has = (name) => process.argv.includes(`--${name}`);

const hexOf = (buf, prefix) => buf.subarray(prefix.length).toString('hex');

const privateKeyHex = () => {
  if (!existsSync(PRIVATE)) {
    console.error(`No private key at ${PRIVATE}.\nRun:  node scripts/licence-keygen.mjs --init`);
    process.exit(1);
  }
  return readFileSync(PRIVATE, 'utf8').trim();
};

const publicKeyHex = () => {
  if (existsSync(PUBLIC)) return readFileSync(PUBLIC, 'utf8').trim();
  // Deriving from the private half keeps --init the only step the seller has to remember.
  const key = createPrivateKeyLike(privateKeyHex());
  return hexOf(key.export({ format: 'der', type: 'spki' }), SPKI);
};

const createPrivateKeyLike = (hex) => {
  const { createPrivateKey } = require_crypto();
  return createPrivateKey({
    key: Buffer.concat([PKCS8, Buffer.from(hex, 'hex')]),
    format: 'der',
    type: 'pkcs8',
  });
};

const require_crypto = () => import('node:crypto');

const daysFor = (plan, explicit) =>
  explicit !== undefined ? Number(explicit) : plan === 'monthly' ? 31 : plan === 'yearly' ? 366 : 0;

const init = async () => {
  if (existsSync(PRIVATE)) {
    const key = (await import('node:crypto')).createPrivateKey({
      key: Buffer.concat([PKCS8, Buffer.from(readFileSync(PRIVATE, 'utf8').trim(), 'hex')]),
      format: 'der',
      type: 'pkcs8',
    });
    const pub = hexOf(key.export({ format: 'der', type: 'spki' }).subarray(SPKI.length), Buffer.alloc(0));
    console.log('A keypair already exists — nothing was changed.');
    console.log(`  private: ${PRIVATE}   (never copy this into the app or an installer)`);
    console.log(`  public : ${pub}`);
    return;
  }
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const priv = hexOf(privateKey.export({ format: 'der', type: 'pkcs8' }), PKCS8);
  const pub = hexOf(publicKey.export({ format: 'der', type: 'spki' }), SPKI);
  mkdirSync(path.dirname(PRIVATE), { recursive: true });
  writeFileSync(PRIVATE, `${priv}\n`);
  writeFileSync(PUBLIC, `${pub}\n`);
  console.log('New Ed25519 keypair written.');
  console.log(`  private: ${PRIVATE}   (KEEP THIS — losing it means every issued key stops working)`);
  console.log(`  public : ${pub}`);
  console.log('\nPut that public hex in packages/server/src/licence/publicKey.ts, rebuild, and only');
  console.log('then issue keys. Customers get the public half; the private half stays here.');
};

const issue = async () => {
  const channel = arg('channel');
  const plan = arg('plan', 'yearly');
  if (!channel || !PLANS.includes(plan)) {
    console.error(
      `Usage: --channel "@handle" --plan ${PLANS.join('|')} [--days N]\n` +
        '       --verify "SC1..."   |   --init',
    );
    process.exit(1);
  }
  const days = daysFor(plan, arg('days'));
  if (plan !== 'lifetime' && (!Number.isInteger(days) || days < 1 || days > 36500)) {
    console.error('--days must be a whole number between 1 and 36500');
    process.exit(1);
  }
  const { createPrivateKey } = await import('node:crypto');
  const key = createPrivateKey({
    key: Buffer.concat([PKCS8, Buffer.from(privateKeyHex(), 'hex')]),
    format: 'der',
    type: 'pkcs8',
  });
  const iat = Math.floor(Date.now() / 1000);
  const payload = { v: 1, channel, plan, iat, ...(plan === 'lifetime' ? {} : { exp: iat + days * 86400 }) };
  const part = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const token = `${PREFIX}.${part}.${sign(null, Buffer.from(part, 'utf8'), key).toString('base64url')}`;
  console.log(token);
  console.error(
    `\n${channel} — ${plan}` +
      (plan === 'lifetime'
        ? ' — never expires'
        : ` — expires ${new Date(payload.exp * 1000).toISOString().slice(0, 10)} (${days} days)`),
  );
  console.error('Send the line above to the customer. It is the licence key they paste in the app.');
};

const check = async () => {
  const token = (arg('verify') ?? '').trim();
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== PREFIX) {
    console.error('Not an SC1 key.');
    process.exit(1);
  }
  const { createPublicKey } = await import('node:crypto');
  const pub = createPublicKey({
    key: Buffer.concat([SPKI, Buffer.from(publicKeyHex(), 'hex')]),
    format: 'der',
    type: 'spki',
  });
  const ok = verify(null, Buffer.from(parts[1], 'utf8'), pub, Buffer.from(parts[2], 'base64url'));
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  const expired = payload.exp !== undefined && payload.exp < Math.floor(Date.now() / 1000);
  console.log(JSON.stringify(payload, null, 2));
  console.error(
    ok ? (expired ? `Signed here, but EXPIRED ${new Date(payload.exp * 1000).toISOString()}` : 'Valid.') : 'BAD SIGNATURE for this keypair.',
  );
  process.exit(ok && !expired ? 0 : 1);
};

if (has('init')) await init();
else if (has('verify')) await check();
else await issue();

// Keep the hash import used so bundlers do not drop it when this file is copied into a tool build.
void createHash;
