// Fails if a required fixture state is missing for any supported site.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', 'fixtures');
const SITES = ['cricbuzz', 'crex'];
const STATES = ['pre-match', 'live-t20', 'live-test', 'innings-break', 'result'];

const problems = [];
for (const site of SITES) {
  for (const state of STATES) {
    for (const ext of ['.html', '.expected.json']) {
      const file = path.join(root, site, `${state}${ext}`);
      if (!fs.existsSync(file)) problems.push(`${site}/${state}${ext}`);
    }
  }
}

if (problems.length) {
  console.error(`Missing ${problems.length} fixture file(s):`);
  for (const p of problems) console.error(`  - fixtures/${p}`);
  console.error('\nSee fixtures/README.md for how to save them.');
  process.exit(1);
}
console.log(`All fixtures present (${SITES.length} sites x ${STATES.length} states).`);
