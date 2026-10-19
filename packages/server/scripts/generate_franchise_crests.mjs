// Generates ORIGINAL generic crests for franchise teams: a colour tile with a monogram and the
// league name. These are NOT the real club logos (those are trademarks); they use each team's
// well-known colours so a stream always has something tidy to show until the real logo is
// uploaded in Players & Logos. Existing files are never overwritten.
//   node scripts/generate_franchise_crests.mjs
// Edit the TEAMS table to add a team or fix a colour/code, then run it again.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const overlayTeamsDir = path.resolve('../overlay/public/assets/teams');
const serverTeamsDir = path.resolve('data/assets/teams');
fs.mkdirSync(overlayTeamsDir, { recursive: true });
fs.mkdirSync(serverTeamsDir, { recursive: true });

// [asset codes (first is the main id, the rest are aliases other sites use), league, monogram, name, base, accent, text]
const TEAMS = [
  // Indian Premier League
  [['csk'], 'IPL', 'CSK', 'Chennai Super Kings', '#F9CD05', '#0B4EA2', '#0B4EA2'],
  [['mi'], 'IPL', 'MI', 'Mumbai Indians', '#004BA0', '#D1AB3E', '#FFFFFF'],
  [['rcb'], 'IPL', 'RCB', 'Royal Challengers Bengaluru', '#D1171B', '#1C1C1C', '#FFFFFF'],
  [['kkr'], 'IPL', 'KKR', 'Kolkata Knight Riders', '#3A225D', '#D4AF37', '#FFFFFF'],
  [['dc'], 'IPL', 'DC', 'Delhi Capitals', '#17449B', '#EF1B23', '#FFFFFF'],
  [['srh'], 'IPL', 'SRH', 'Sunrisers Hyderabad', '#F26522', '#1C1C1C', '#FFFFFF'],
  [['rr', 'rjr'], 'IPL', 'RR', 'Rajasthan Royals', '#EA1A85', '#254AA5', '#FFFFFF'],
  [['pbks', 'kxip'], 'IPL', 'PBKS', 'Punjab Kings', '#D71920', '#A7A9AC', '#FFFFFF'],
  [['gt'], 'IPL', 'GT', 'Gujarat Titans', '#1B2A4A', '#B59A5B', '#FFFFFF'],
  [['lsg'], 'IPL', 'LSG', 'Lucknow Super Giants', '#1F6FB5', '#F2A900', '#FFFFFF'],
  // Pakistan Super League
  [['isu'], 'PSL', 'ISU', 'Islamabad United', '#D8232A', '#1C1C1C', '#FFFFFF'],
  [['krk', 'kk'], 'PSL', 'KK', 'Karachi Kings', '#1E5BA8', '#F2A900', '#FFFFFF'],
  [['lhq', 'lq'], 'PSL', 'LQ', 'Lahore Qalandars', '#00A650', '#D8232A', '#FFFFFF'],
  [['ms'], 'PSL', 'MS', 'Multan Sultans', '#4C9A2A', '#F2C200', '#FFFFFF'],
  [['psz', 'pz'], 'PSL', 'PZ', 'Peshawar Zalmi', '#F7D117', '#1C1C1C', '#1C1C1C'],
  [['qtg', 'qg'], 'PSL', 'QG', 'Quetta Gladiators', '#5E2D79', '#D4AF37', '#FFFFFF'],
  // Big Bash League
  [['ads'], 'BBL', 'ADS', 'Adelaide Strikers', '#0A6EC8', '#F7D117', '#FFFFFF'],
  [['brh'], 'BBL', 'BRH', 'Brisbane Heat', '#E8501B', '#00A99D', '#FFFFFF'],
  [['hbh'], 'BBL', 'HBH', 'Hobart Hurricanes', '#5B2C83', '#F2A900', '#FFFFFF'],
  [['mlr'], 'BBL', 'MLR', 'Melbourne Renegades', '#E31B23', '#1C1C1C', '#FFFFFF'],
  [['mls'], 'BBL', 'MLS', 'Melbourne Stars', '#1A8F3C', '#F2C200', '#FFFFFF'],
  [['prs'], 'BBL', 'PRS', 'Perth Scorchers', '#F68B1F', '#1C1C1C', '#1C1C1C'],
  [['sys'], 'BBL', 'SYS', 'Sydney Sixers', '#E5007D', '#1C1C1C', '#FFFFFF'],
  [['syt'], 'BBL', 'SYT', 'Sydney Thunder', '#8DC63F', '#1C1C1C', '#1C1C1C'],
];

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const crest = ([, league, mono, name, base, accent, text]) => {
  const size = mono.length >= 4 ? 62 : mono.length === 3 ? 74 : 96;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" width="300" height="200" role="img" aria-label="${esc(name)}">
  <defs>
    <clipPath id="tile"><rect width="300" height="200" rx="20"/></clipPath>
    <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient>
  </defs>
  <g clip-path="url(#tile)">
    <rect width="300" height="200" fill="${base}"/>
    <path d="M-20 160 L120 -20 L190 -20 L50 200 L-20 200 Z" fill="${accent}" opacity=".9"/>
    <rect width="300" height="200" fill="url(#shade)"/>
    <text x="150" y="112" text-anchor="middle" font-family="Arial Black, Arial, Helvetica, sans-serif" font-weight="900" font-size="${size}" fill="${text}" stroke="${base === text ? accent : 'none'}">${esc(mono)}</text>
    <rect x="95" y="136" width="110" height="3" rx="1.5" fill="${text}" opacity=".7"/>
    <text x="150" y="168" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="22" letter-spacing="6" fill="${text}" opacity=".9">${esc(league)}</text>
  </g>
</svg>`;
};

let made = 0;
let skipped = 0;
for (const team of TEAMS) {
  const svg = crest(team);
  const webp = await sharp(Buffer.from(svg)).resize(300, 200).webp({ quality: 90 }).toBuffer();
  for (const code of team[0]) {
    const id = `team-${code}`;
    if (fs.existsSync(path.join(serverTeamsDir, `${id}.svg`))) {
      skipped++;
      continue;
    }
    for (const dir of [overlayTeamsDir, serverTeamsDir]) {
      fs.writeFileSync(path.join(dir, `${id}.svg`), svg);
      fs.writeFileSync(path.join(dir, `${id}.webp`), webp);
    }
    made++;
  }
}
console.log(`Created ${made} franchise crests, skipped ${skipped} existing.`);
