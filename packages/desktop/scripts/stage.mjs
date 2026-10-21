// Assembles build/stage: the folder electron-builder packages into the installer.
//   stage/package.json                      (name, version, main, native + updater dependencies)
//   stage/packages/desktop/dist/*           (compiled Electron main + preload)
//   stage/packages/server/dist/index.mjs    (server bundled; only native modules stay external)
//   stage/packages/{overlay,admin}/dist     (built UIs)
// The layout mirrors the repo so desktop/src/index.ts finds everything relative to itself.
import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const desktop = path.resolve(here, '..');
const packages = path.resolve(desktop, '..');
// A fresh folder per run: on Windows another process (editor, terminal, indexer) can hold an old
// stage folder open, which makes deleting or reusing it fail with EPERM.
const stage = path.join(desktop, 'build', `stage-${Date.now()}`);
const buildArgs = process.argv.slice(2); // e.g. --dir ; omit to only stage
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

for (const dir of [path.join(desktop, 'dist', 'index.js'), path.join(packages, 'overlay', 'dist', 'index.html'), path.join(packages, 'admin', 'dist', 'index.html')]) {
  if (!existsSync(dir)) throw new Error(`Missing ${dir}. Run "pnpm build" first.`);
}

for (const old of readdirSync(path.join(desktop, 'build')).filter((n) => n.startsWith('stage'))) {
  try {
    rmSync(path.join(desktop, 'build', old), { recursive: true, force: true });
  } catch {
    // still locked by another program; harmless, it is simply left behind
  }
}
mkdirSync(path.join(stage, 'packages', 'server', 'dist'), { recursive: true });

await build({
  entryPoints: [path.join(packages, 'server', 'src', 'index.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  external: ['better-sqlite3', 'sharp'],
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  outfile: path.join(stage, 'packages', 'server', 'dist', 'index.mjs'),
  logLevel: 'warning',
});

cpSync(path.join(desktop, 'dist'), path.join(stage, 'packages', 'desktop', 'dist'), {
  recursive: true,
  filter: (src) => !/\.(map|tsbuildinfo)$|\.d\.ts$|\.test\./.test(src),
});
cpSync(path.join(packages, 'overlay', 'dist'), path.join(stage, 'packages', 'overlay', 'dist'), { recursive: true });
cpSync(path.join(packages, 'admin', 'dist'), path.join(stage, 'packages', 'admin', 'dist'), { recursive: true });
if (existsSync(path.join(packages, 'license-admin', 'dist'))) {
  cpSync(path.join(packages, 'license-admin', 'dist'), path.join(stage, 'packages', 'license-admin', 'dist'), { recursive: true });
}
// The signing halves stay on the seller's machine. Copying `.secrets` into the installer handed
// every customer the private keys for licences and selector bundles, which is the whole paid
// model handed back to them. The customer's own secrets (Gemini key) live in the encrypted store
// under the data directory, which this does not touch.
if (existsSync(path.join(packages, '..', '.secrets'))) {
  console.log('stage: leaving .secrets out of the package (licence/selector signing is seller-side)');
}

const serverAssets = path.join(packages, 'server', 'data', 'assets');
if (existsSync(serverAssets)) {
  mkdirSync(path.join(stage, 'packages', 'server', 'data'), { recursive: true });
  cpSync(serverAssets, path.join(stage, 'packages', 'server', 'data', 'assets'), { recursive: true });
  cpSync(serverAssets, path.join(stage, 'assets'), { recursive: true });
}

const server = readJson(path.join(packages, 'server', 'package.json'));
const self = readJson(path.join(desktop, 'package.json'));
const appVersion = process.env.STUMPCAST_VERSION ?? self.version;

if (existsSync(path.join(desktop, 'build', 'splash.html'))) {
  mkdirSync(path.join(stage, 'packages', 'desktop', 'build'), { recursive: true });
  let splashContent = readFileSync(path.join(desktop, 'build', 'splash.html'), 'utf8');
  splashContent = splashContent.replace(/<div class="version"[^>]*>.*?<\/div>/, `<div class="version" id="appVersion">v${appVersion}</div>`);
  writeFileSync(path.join(stage, 'packages', 'desktop', 'build', 'splash.html'), splashContent, 'utf8');
  writeFileSync(path.join(stage, 'packages', 'desktop', 'splash.html'), splashContent, 'utf8');
  writeFileSync(path.join(stage, 'splash.html'), splashContent, 'utf8');
}
if (existsSync(path.join(desktop, 'build', 'icons'))) {
  cpSync(path.join(desktop, 'build', 'icons'), path.join(stage, 'packages', 'desktop', 'build', 'icons'), { recursive: true });
}

writeFileSync(
  path.join(stage, 'package.json'),
  JSON.stringify(
    {
      name: 'stumpcast-studio',
      productName: 'StumpCast Studio',
      version: process.env.STUMPCAST_VERSION ?? self.version,
      description: 'Live cricket broadcast graphics for OBS',
      author: 'StumpCast',
      type: 'module',
      main: 'packages/desktop/dist/index.js',
      dependencies: {
        'better-sqlite3': server.dependencies['better-sqlite3'],
        sharp: server.dependencies.sharp,
        'electron-updater': self.dependencies['electron-updater'],
      },
    },
    null,
    2,
  ),
);

// Plain npm so the staged folder has a normal node_modules (no pnpm symlinks inside the installer).
execSync('npm install --omit=dev --no-audit --no-fund --no-package-lock', { cwd: stage, stdio: 'inherit' });
console.log(`Staged at ${stage}`);

if (buildArgs.includes('--pack')) {
  const dirOnly = buildArgs.includes('--dir') ? ' --dir' : '';
  const finalOut = path.resolve(desktop, '..', '..', 'release');
  const tempOut = path.join(process.env.TEMP || 'C:\\Windows\\Temp', `stumpcast-rel-${Date.now()}`);
  mkdirSync(tempOut, { recursive: true });
  mkdirSync(finalOut, { recursive: true });

  execSync(
    `pnpm exec electron-builder --config electron-builder.yml --win${dirOnly} -c.directories.app="${stage}" -c.directories.output="${tempOut}"`,
    { cwd: desktop, stdio: 'inherit' },
  );

  for (const item of readdirSync(tempOut)) {
    try {
      cpSync(path.join(tempOut, item), path.join(finalOut, item), { recursive: true, force: true });
    } catch (err) {
      console.warn(`Could not copy ${item} to release:`, err.message);
    }
  }
  try {
    rmSync(tempOut, { recursive: true, force: true });
  } catch {
    // harmless if temp folder cleans up on reboot
  }
}
