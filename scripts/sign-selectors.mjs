#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_SELECTORS_PUBLIC_KEY,
  verifySignedSelectorBundle,
} from '../packages/shared/dist/selectors.js';
import { signSelectorBundle, TEST_SELECTORS_PRIVATE_KEY } from '../packages/shared/dist/sign.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// CLI args parsing
const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf(name);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
};

const cricbuzzPath =
  getArg('--cricbuzz') ||
  path.join(root, 'packages', 'extension', 'src', 'config', 'selectors.cricbuzz.json');
const crexPath =
  getArg('--crex') ||
  path.join(root, 'packages', 'extension', 'src', 'config', 'selectors.crex.json');
const outPath =
  getArg('--out') || path.join(root, 'data', 'selectors', 'bundle.signed.json');
const privKey =
  getArg('--key') ||
  process.env.STUMPCAST_SELECTORS_PRIVATE_KEY ||
  (() => {
    try {
      const p = path.join(root, '.secrets', 'selectors-private.key');
      if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim();
    } catch {
      /* fallback to test key */
    }
    return TEST_SELECTORS_PRIVATE_KEY;
  })();

if (!fs.existsSync(cricbuzzPath)) {
  console.error(`Error: Cricbuzz config not found at ${cricbuzzPath}`);
  process.exit(1);
}
if (!fs.existsSync(crexPath)) {
  console.error(`Error: Crex config not found at ${crexPath}`);
  process.exit(1);
}

const cricbuzz = JSON.parse(fs.readFileSync(cricbuzzPath, 'utf8'));
const crex = JSON.parse(fs.readFileSync(crexPath, 'utf8'));

const versionArg = getArg('--version');
const version = versionArg ? Number(versionArg) : Math.max(cricbuzz.version || 1, crex.version || 1);

const bundle = {
  version,
  updatedAt: Date.now(),
  selectors: {
    cricbuzz,
    crex,
  },
};

const signed = await signSelectorBundle(bundle, privKey);
const verify = await verifySignedSelectorBundle(signed, DEFAULT_SELECTORS_PUBLIC_KEY);

if (!verify.valid) {
  console.error('Fatal: Signature self-check failed!', verify.error);
  process.exit(1);
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(signed, null, 2), 'utf8');

console.log(`[StumpCast] Successfully signed selector bundle v${version}`);
console.log(`  Source: ${cricbuzzPath}, ${crexPath}`);
console.log(`  Output: ${outPath}`);
console.log(`  Signature: ${signed.signature.slice(0, 16)}...${signed.signature.slice(-16)}`);
