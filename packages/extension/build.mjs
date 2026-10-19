// Bundles the extension into the workspace extension/ folder for Chrome's Load unpacked flow.
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';

const root = import.meta.dirname;
const out = path.resolve(root, '..', '..', 'extension');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

await build({
  entryPoints: {
    content: path.join(root, 'src/content/index.ts'),
    'page-world': path.join(root, 'src/content/page-world.ts'),
    background: path.join(root, 'src/background/worker.ts'),
    options: path.join(root, 'src/options.ts'),
  },
  outdir: out,
  bundle: true,
  format: 'iife',
  target: 'chrome110',
  minify: false,
  logLevel: 'info',
});
fs.copyFileSync(path.join(root, 'manifest.json'), path.join(out, 'manifest.json'));
fs.copyFileSync(path.join(root, 'options.html'), path.join(out, 'options.html'));
fs.cpSync(path.join(root, 'icons'), path.join(out, 'icons'), { recursive: true });

// Also mirror to packages/extension for backwards compatibility if loaded from either path
for (const file of ['content.js', 'page-world.js', 'background.js', 'options.js']) {
  fs.copyFileSync(path.join(out, file), path.join(root, file));
}
