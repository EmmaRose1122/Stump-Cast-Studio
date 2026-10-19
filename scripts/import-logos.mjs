// Bulk-imports REAL team logos you already have into StumpCast's asset library.
// You are responsible for holding the rights to the images you import.
//
//   From a folder (file name = team code, e.g. csk.png, mi.svg, rcb.webp):
//     node scripts/import-logos.mjs --dir "C:\logos" --i-have-the-rights
//   From links (a JSON file: { "csk": "https://.../csk.png", "mi": "https://..." }):
//     node scripts/import-logos.mjs --urls logos.json --i-have-the-rights
//
// Options: --type team|player|background (default team), --server http://127.0.0.1:4000
// A logo replaces any existing crest with the same code, so the generated placeholders are
// swapped for the real ones. Run with the StumpCast server running.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const flag = (name) => process.argv.includes(`--${name}`);

const server = arg('server') ?? 'http://127.0.0.1:4000';
const type = arg('type') ?? 'team';
const dir = arg('dir');
const urlsFile = arg('urls');

if ((!dir && !urlsFile) || !flag('i-have-the-rights')) {
  console.error(
    'Usage: node scripts/import-logos.mjs (--dir <folder> | --urls <file.json>) --i-have-the-rights\n' +
      'The last flag confirms you hold the rights to the images you are importing.',
  );
  process.exit(1);
}

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const field = type === 'team' ? 'short' : 'name';
const jobs = [];

if (dir) {
  for (const file of readdirSync(dir)) {
    const ext = path.extname(file).toLowerCase();
    if (!MIME[ext]) continue;
    jobs.push({ code: path.basename(file, ext), run: (code) => upload(code, readFileSync(path.join(dir, file)), MIME[ext], file) });
  }
}
if (urlsFile) {
  for (const [code, url] of Object.entries(JSON.parse(readFileSync(urlsFile, 'utf8')))) {
    jobs.push({ code, run: (c) => post('/api/assets/url', { type, [field]: c, url, rightsConfirmed: true }) });
  }
}

async function upload(code, buffer, mime, filename) {
  const form = new FormData(); // fields first, then the file (the server reads them in order)
  form.set('type', type);
  form.set(field, code);
  form.set('rightsConfirmed', 'true');
  form.set('file', new Blob([buffer], { type: mime }), filename);
  const res = await fetch(`${server}/api/assets`, { method: 'POST', body: form });
  return { ok: res.ok, body: await res.json().catch(() => ({})) };
}

async function post(route, body) {
  const res = await fetch(`${server}${route}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, body: await res.json().catch(() => ({})) };
}

let done = 0;
const failed = [];
for (const job of jobs) {
  try {
    const r = await job.run(job.code);
    if (r.ok) {
      done++;
      console.log(`OK    ${job.code} -> ${r.body.id}${r.body.replaced ? ' (replaced)' : ''}`);
    } else {
      failed.push(job.code);
      console.log(`FAIL  ${job.code}: ${r.body.error ?? 'unknown error'}`);
    }
  } catch (err) {
    failed.push(job.code);
    console.log(`FAIL  ${job.code}: ${err.message} (is the server running?)`);
  }
}
console.log(`\nImported ${done} of ${jobs.length}.${failed.length ? ` Failed: ${failed.join(', ')}` : ''}`);
