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

const serverAssets = path.join(packages, 'server', 'data', 'assets');
if (existsSync(serverAssets)) {
  mkdirSync(path.join(stage, 'packages', 'server', 'data'), { recursive: true });
  cpSync(serverAssets, path.join(stage, 'packages', 'server', 'data', 'assets'), { recursive: true });
  cpSync(serverAssets, path.join(stage, 'assets'), { recursive: true });
}

if (existsSync(path.join(desktop, 'build', 'splash.html'))) {
  mkdirSync(path.join(stage, 'packages', 'desktop', 'build'), { recursive: true });
  cpSync(path.join(desktop, 'build', 'splash.html'), path.join(stage, 'packages', 'desktop', 'build', 'splash.html'));
}
if (existsSync(path.join(desktop, 'build', 'icons'))) {
  cpSync(path.join(desktop, 'build', 'icons'), path.join(stage, 'packages', 'desktop', 'build', 'icons'), { recursive: true });
}

const server = readJson(path.join(packages, 'server', 'package.json'));
const self = readJson(path.join(desktop, 'package.json'));
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
  execSync(
    `pnpm exec electron-builder --config electron-builder.yml --win${dirOnly} -c.directories.app="${stage}"`,
    { cwd: desktop, stdio: 'inherit' },
  );
}
