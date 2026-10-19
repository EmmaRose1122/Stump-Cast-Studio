// Generates a national-team crest for every ICC member that has no crest yet.
// A crest is the country's flag on the same rounded 300x200 tile the existing crests use.
// Flags come from the MIT-licensed "flag-icons" package; it is NOT a project dependency. Run:
//   npm i flag-icons --prefix <some temp dir>
//   node scripts/generate_world_teams.mjs <temp dir>/node_modules/flag-icons/flags/4x3
// Existing files are never overwritten. Franchise or board logos are trademarks: upload those
// yourself in Players & Logos.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const flagsDir = path.resolve(process.argv[2] ?? '');
if (!process.argv[2] || !fs.existsSync(flagsDir)) {
  console.error('Usage: node scripts/generate_world_teams.mjs <path to flag-icons/flags/4x3>');
  process.exit(1);
}

const overlayTeamsDir = path.resolve('../overlay/public/assets/teams');
const serverTeamsDir = path.resolve('data/assets/teams');
fs.mkdirSync(overlayTeamsDir, { recursive: true });
fs.mkdirSync(serverTeamsDir, { recursive: true });

// [asset short code (becomes team-<code>), flag file, name]
const TEAMS = [
  ['zim', 'zw', 'Zimbabwe'], ['ire', 'ie', 'Ireland'],
  ['arg', 'ar', 'Argentina'], ['aut', 'at', 'Austria'], ['bah', 'bs', 'Bahamas'], ['bhr', 'bh', 'Bahrain'],
  ['bel', 'be', 'Belgium'], ['blz', 'bz', 'Belize'], ['ber', 'bm', 'Bermuda'], ['bhu', 'bt', 'Bhutan'],
  ['bot', 'bw', 'Botswana'], ['bra', 'br', 'Brazil'], ['bul', 'bg', 'Bulgaria'], ['cam', 'kh', 'Cambodia'],
  ['cmr', 'cm', 'Cameroon'], ['can', 'ca', 'Canada'], ['cay', 'ky', 'Cayman Islands'], ['chi', 'cl', 'Chile'],
  ['chn', 'cn', 'China'], ['col', 'co', 'Colombia'], ['cok', 'ck', 'Cook Islands'], ['crc', 'cr', 'Costa Rica'],
  ['cro', 'hr', 'Croatia'], ['cyp', 'cy', 'Cyprus'], ['cze', 'cz', 'Czechia'], ['den', 'dk', 'Denmark'],
  ['swz', 'sz', 'Eswatini'], ['est', 'ee', 'Estonia'], ['fij', 'fj', 'Fiji'], ['fin', 'fi', 'Finland'],
  ['fra', 'fr', 'France'], ['gam', 'gm', 'Gambia'], ['ger', 'de', 'Germany'], ['gha', 'gh', 'Ghana'],
  ['gib', 'gi', 'Gibraltar'], ['gre', 'gr', 'Greece'], ['gue', 'gg', 'Guernsey'], ['hk', 'hk', 'Hong Kong'],
  ['hun', 'hu', 'Hungary'], ['ina', 'id', 'Indonesia'], ['iom', 'im', 'Isle of Man'], ['isr', 'il', 'Israel'],
  ['ita', 'it', 'Italy'], ['jpn', 'jp', 'Japan'], ['jer', 'je', 'Jersey'], ['ken', 'ke', 'Kenya'],
  ['kuw', 'kw', 'Kuwait'], ['les', 'ls', 'Lesotho'], ['lux', 'lu', 'Luxembourg'], ['mwi', 'mw', 'Malawi'],
  ['mas', 'my', 'Malaysia'], ['mdv', 'mv', 'Maldives'], ['mlt', 'mt', 'Malta'], ['mex', 'mx', 'Mexico'],
  ['moz', 'mz', 'Mozambique'], ['mya', 'mm', 'Myanmar'], ['nam', 'na', 'Namibia'], ['nep', 'np', 'Nepal'],
  ['ned', 'nl', 'Netherlands'], ['nga', 'ng', 'Nigeria'], ['nor', 'no', 'Norway'], ['pan', 'pa', 'Panama'],
  ['png', 'pg', 'Papua New Guinea'], ['per', 'pe', 'Peru'], ['phi', 'ph', 'Philippines'], ['por', 'pt', 'Portugal'],
  ['qat', 'qa', 'Qatar'], ['rou', 'ro', 'Romania'], ['rwa', 'rw', 'Rwanda'], ['sam', 'ws', 'Samoa'],
  ['ksa', 'sa', 'Saudi Arabia'], ['sco', 'gb-sct', 'Scotland'], ['sey', 'sc', 'Seychelles'],
  ['sle', 'sl', 'Sierra Leone'], ['sgp', 'sg', 'Singapore'], ['slo', 'si', 'Slovenia'], ['kor', 'kr', 'South Korea'],
  ['esp', 'es', 'Spain'], ['swe', 'se', 'Sweden'], ['sui', 'ch', 'Switzerland'], ['tan', 'tz', 'Tanzania'],
  ['tha', 'th', 'Thailand'], ['tur', 'tr', 'Türkiye'], ['uga', 'ug', 'Uganda'], ['uae', 'ae', 'United Arab Emirates'],
  ['usa', 'us', 'United States'], ['van', 'vu', 'Vanuatu'], ['zam', 'zm', 'Zambia'],
];

const tile = (flagSvg, name) => {
  const inner = flagSvg.replace(/<\?xml[^>]*\?>/g, '').replace(/<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  const viewBox = /viewBox="([^"]+)"/.exec(flagSvg)?.[1] ?? '0 0 640 480';
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 300 200" width="300" height="200" role="img" aria-label="${name}">
  <defs><clipPath id="tile"><rect width="300" height="200" rx="20"/></clipPath></defs>
  <g clip-path="url(#tile)"><svg x="0" y="0" width="300" height="200" viewBox="${viewBox}" preserveAspectRatio="xMidYMid slice">${inner}</svg></g>
</svg>`;
};

let made = 0;
let skipped = 0;
const missing = [];
for (const [code, iso, name] of TEAMS) {
  const flagFile = path.join(flagsDir, `${iso}.svg`);
  if (!fs.existsSync(flagFile)) {
    missing.push(`${name} (${iso})`);
    continue;
  }
  const id = `team-${code}`;
  if (fs.existsSync(path.join(serverTeamsDir, `${id}.svg`))) {
    skipped++;
    continue;
  }
  const svg = tile(fs.readFileSync(flagFile, 'utf8'), name);
  const webp = await sharp(Buffer.from(svg)).resize(300, 200).webp({ quality: 90 }).toBuffer();
  for (const dir of [overlayTeamsDir, serverTeamsDir]) {
    fs.writeFileSync(path.join(dir, `${id}.svg`), svg);
    fs.writeFileSync(path.join(dir, `${id}.webp`), webp);
  }
  made++;
}
console.log(`Created ${made} crests, skipped ${skipped} existing.`);
if (missing.length) console.log(`No flag file for: ${missing.join(', ')}`);
