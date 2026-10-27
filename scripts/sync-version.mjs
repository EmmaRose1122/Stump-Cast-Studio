import fs from 'node:fs';
import path from 'node:path';

/**
 * Single source of truth for the running version: the root package.json. The shared constant was
 * hand-edited to 1.3.0 four releases ago, so the studio header, the update check and the splash
 * all disagreed with the installer. Generating it at build/dev time makes drift impossible, and
 * admin.test.tsx fails if the generated file is stale.
 */
const root = path.resolve(import.meta.dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const target = path.join(root, 'packages', 'shared', 'src', 'version.ts');
const body = `/** Generated from package.json by scripts/sync-version.mjs — do not edit by hand. */\nexport const APP_VERSION = '${pkg.version}';\n`;

const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
if (current !== body) {
  fs.writeFileSync(target, body, 'utf8');
  console.log(`APP_VERSION -> ${pkg.version}`);
} else {
  console.log(`APP_VERSION ${pkg.version} (unchanged)`);
}
