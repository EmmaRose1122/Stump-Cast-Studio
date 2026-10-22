#!/usr/bin/env node
// Seller-side licence tool. Runs on YOUR machine; the private key must never ship with the app.
//
//   node scripts/licence-keygen.mjs --init
//   node scripts/licence-keygen.mjs --channel "@mychannel" --plan yearly [--days 45]
//   node scripts/licence-keygen.mjs --channel "@mychannel" --plan lifetime
//   node scripts/licence-keygen.mjs --verify "SC1...."
//
// A customer's app only ever holds the public half, so it can check a key but never make one.
// All crypto lives in licence-keygen-core.mjs, which the "key generator" desktop app imports too
// — one implementation, so a key minted by either front-end verifies in the other.
// stdout carries the token only (licence-keygen.bat pipes it to the clipboard); notes go to stderr.
import {
  PLANS,
  fingerprintOf,
  hasPrivateKey,
  initKeypair,
  issueToken,
  privateKeyPath,
  verifyToken,
} from './licence-keygen-core.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const has = (name) => process.argv.includes(`--${name}`);

const usage = () => {
  console.error(
    'Usage: node scripts/licence-keygen.mjs --channel "@handle" --plan ' +
      `${PLANS.join('|')} [--days N]\n` +
      '   or: node scripts/licence-keygen.mjs --init\n' +
      '   or: node scripts/licence-keygen.mjs --verify "SC1..."',
  );
  process.exit(1);
};

const init = () => {
  const { created, publicHex } = initKeypair();
  if (!created) {
    console.log('A keypair already exists — nothing was changed.');
    console.log(`  private: ${privateKeyPath}   (never copy this into the app or an installer)`);
    console.log(`  public : ${publicHex}`);
    return;
  }
  console.log('New Ed25519 keypair written.');
  console.log(`  private: ${privateKeyPath}   (KEEP THIS — if it is lost, every issued key stops working)`);
  console.log(`  public : ${publicHex}`);
  console.log('\nPut that public hex in packages/server/src/licence/publicKey.ts and rebuild the app');
  console.log('BEFORE issuing keys: a key signed here is worthless to an app built for another pair.');
};

const issue = () => {
  const channel = arg('channel');
  const plan = arg('plan');
  const days = arg('days');
  const mid = arg('mid') ?? arg('machine');
  if (!channel || !PLANS.includes(plan)) return usage();
  try {
    const { token, payload, days: usedDays } = issueToken({ channel, plan, days: days === undefined ? undefined : Number(days), mid });
    console.log(token);
    console.error(
      plan === 'lifetime'
        ? `\n${channel} — lifetime licence, never expires.${payload.mid ? `  [Machine ID: ${payload.mid}]` : ''}  [${fingerprintOf(token)}]`
        : `\n${channel} — ${plan} licence, expires ${new Date(payload.exp * 1000).toISOString().slice(0, 10)} (${usedDays} days).${payload.mid ? `  [Machine ID: ${payload.mid}]` : ''}  [${fingerprintOf(token)}]`,
    );
    console.error('Send the line above to the customer: it is what they paste into the app.');
  } catch (err) {
    console.error(String(err.message ?? err));
    process.exit(1);
  }
};

const check = () => {
  const token = (arg('verify') ?? '').trim();
  if (!hasPrivateKey()) {
    console.error(`No private key at ${privateKeyPath}.\nCreate one first:  node scripts/licence-keygen.mjs --init`);
    process.exit(1);
  }
  const result = verifyToken(token);
  if (result.reason === 'malformed') {
    console.error('That is not an SC1 key.');
    process.exit(1);
  }
  console.log(JSON.stringify(result.payload, null, 2));
  if (!result.signatureOk) console.error('BAD SIGNATURE — this key was not issued by this keypair.');
  else if (result.reason === 'expired') console.error(`Signed here, but expired ${new Date(result.payload.exp * 1000).toISOString()}.`);
  else console.error('Valid.');
  process.exit(result.ok ? 0 : 1);
};

if (has('init')) init();
else if (has('verify')) check();
else issue();
