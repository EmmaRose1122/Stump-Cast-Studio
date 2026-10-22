import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, '..', 'data', 'stumpcast.db');
const db = new Database(dbPath);

db.prepare("DELETE FROM sounds WHERE id LIKE 'sample-%'").run();

const presets = [
  { id: 'stadium-murmur', title: 'Stadium Crowd Ambient (Loop)', file: 'sounds/stadium-murmur.mp3', loop: 1, vol: 0.85 },
  { id: 'crowd-cheer-roar', title: 'Massive Crowd Roar & Cheering', file: 'sounds/crowd-cheer-roar.mp3', loop: 0, vol: 0.95 },
  { id: 'crowd-chants-claps', title: 'Stadium Chants & Claps', file: 'sounds/crowd-chants-claps.mp3', loop: 0, vol: 0.9 },
  { id: 'boundary-four-burst', title: 'Boundary Four Celebration', file: 'sounds/boundary-four-burst.mp3', loop: 0, vol: 0.95 },
  { id: 'wicket-fall-gasp', title: 'Wicket Fall Roar & Gasp', file: 'sounds/wicket-fall-gasp.mp3', loop: 0, vol: 0.95 },
  { id: 'stadium-whistles-applause', title: 'Stadium Whistles & Ovation', file: 'sounds/stadium-whistles-applause.mp3', loop: 0, vol: 0.9 },
];

for (const p of presets) {
  db.prepare("INSERT OR REPLACE INTO sounds (id, title, file, include_in_loop, volume) VALUES (?, ?, ?, ?, ?)").run(p.id, p.title, p.file, p.loop, p.vol);
}

console.log('Seeded sounds successfully into SQLite:');
console.table(db.prepare('SELECT id, title, file, include_in_loop, volume FROM sounds').all());
