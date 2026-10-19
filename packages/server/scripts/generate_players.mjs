import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const overlayPlayersDir = path.resolve('../overlay/public/assets/players');
const serverPlayersDir = path.resolve('data/assets/players');

fs.mkdirSync(overlayPlayersDir, { recursive: true });
fs.mkdirSync(serverPlayersDir, { recursive: true });

const players = [
  // South Africa
  { id: 'aiden-markram', name: 'Aiden Markram', team: 'RSA', jersey: '#007A4D', accent: '#FFB81C', hair: '#4a3319', skin: '#e5b88f', beard: true },
  { id: 'ryan-rickelton', name: 'Ryan Rickelton', team: 'RSA', jersey: '#007A4D', accent: '#FFB81C', hair: '#a07842', skin: '#f7d0b5', beard: false },
  { id: 'david-bedingham', name: 'David Bedingham', team: 'RSA', jersey: '#007A4D', accent: '#FFB81C', hair: '#2a1d13', skin: '#ebc09b', beard: true },
  { id: 'temba-bavuma', name: 'Temba Bavuma', team: 'RSA', jersey: '#007A4D', accent: '#FFB81C', hair: '#111111', skin: '#6e472e', beard: true },
  { id: 'tristan-stubbs', name: 'Tristan Stubbs', team: 'RSA', jersey: '#007A4D', accent: '#FFB81C', hair: '#87623a', skin: '#f5cdb0', beard: false },
  { id: 'wiaan-mulder', name: 'Wiaan Mulder', team: 'RSA', jersey: '#007A4D', accent: '#FFB81C', hair: '#594026', skin: '#eec29f', beard: true },
  { id: 'kyle-verreynne', name: 'Kyle Verreynne', team: 'RSA', jersey: '#007A4D', accent: '#FFB81C', hair: '#3d2b1a', skin: '#f3c7a6', beard: true },
  { id: 'marco-jansen', name: 'Marco Jansen', team: 'RSA', jersey: '#007A4D', accent: '#FFB81C', hair: '#9c7347', skin: '#fce2cc', beard: false },
  { id: 'simon-harmer', name: 'Simon Harmer', team: 'RSA', jersey: '#007A4D', accent: '#FFB81C', hair: '#291d12', skin: '#ecc5a5', beard: true },
  { id: 'keshav-maharaj', name: 'Keshav Maharaj', team: 'RSA', jersey: '#007A4D', accent: '#FFB81C', hair: '#121212', skin: '#9e6d49', beard: true },
  { id: 'anrich-nortje', name: 'Anrich Nortje', team: 'RSA', jersey: '#007A4D', accent: '#FFB81C', hair: '#2b1e15', skin: '#e8be9c', beard: true },
  { id: 'heinrich-klaasen', name: 'Heinrich Klaasen', team: 'RSA', jersey: '#007A4D', accent: '#FFB81C', hair: '#574128', skin: '#ecc3a2', beard: true },
  { id: 'kagiso-rabada', name: 'Kagiso Rabada', team: 'RSA', jersey: '#007A4D', accent: '#FFB81C', hair: '#0a0a0a', skin: '#4d2e1a', beard: true },

  // Australia
  { id: 'travis-head', name: 'Travis Head', team: 'AUS', jersey: '#00843D', accent: '#FFCD00', hair: '#3a2717', skin: '#f3c6a3', beard: true },
  { id: 'nic-maddinson', name: 'Nic Maddinson', team: 'AUS', jersey: '#00843D', accent: '#FFCD00', hair: '#523a22', skin: '#f0c4a1', beard: false },
  { id: 'marnus-labuschagne', name: 'Marnus Labuschagne', team: 'AUS', jersey: '#00843D', accent: '#FFCD00', hair: '#402e1c', skin: '#eec29f', beard: false },
  { id: 'steven-smith', name: 'Steven Smith', team: 'AUS', jersey: '#00843D', accent: '#FFCD00', hair: '#8a673c', skin: '#f7d3b9', beard: false },
  { id: 'matt-renshaw', name: 'Matt Renshaw', team: 'AUS', jersey: '#00843D', accent: '#FFCD00', hair: '#6e4f2f', skin: '#f4cca9', beard: false },
  { id: 'alex-carey', name: 'Alex Carey', team: 'AUS', jersey: '#00843D', accent: '#FFCD00', hair: '#332315', skin: '#eec3a1', beard: false },
  { id: 'beau-webster', name: 'Beau Webster', team: 'AUS', jersey: '#00843D', accent: '#FFCD00', hair: '#503820', skin: '#eec19d', beard: true },
  { id: 'pat-cummins', name: 'Pat Cummins', team: 'AUS', jersey: '#00843D', accent: '#FFCD00', hair: '#4a3622', skin: '#f4c9a7', beard: false },
  { id: 'mitchell-starc', name: 'Mitchell Starc', team: 'AUS', jersey: '#00843D', accent: '#FFCD00', hair: '#2b1e13', skin: '#eec19d', beard: true },
  { id: 'nathan-lyon', name: 'Nathan Lyon', team: 'AUS', jersey: '#00843D', accent: '#FFCD00', hair: '#1a140f', skin: '#f2c8a7', beard: true },
  { id: 'josh-hazlewood', name: 'Josh Hazlewood', team: 'AUS', jersey: '#00843D', accent: '#FFCD00', hair: '#3d2b1b', skin: '#f3c7a6', beard: false },

  // Pakistan
  { id: 'babar-azam', name: 'Babar Azam', team: 'PAK', jersey: '#01411C', accent: '#FFFFFF', hair: '#111111', skin: '#bb8860', beard: true },
  { id: 'shaheen-afridi', name: 'Shaheen Afridi', team: 'PAK', jersey: '#01411C', accent: '#FFFFFF', hair: '#111111', skin: '#be8c65', beard: true },
  { id: 'shadab-khan', name: 'Shadab Khan', team: 'PAK', jersey: '#01411C', accent: '#FFFFFF', hair: '#151515', skin: '#b5835c', beard: true },

  // England
  { id: 'joe-root', name: 'Joe Root', team: 'ENG', jersey: '#1E3A8A', accent: '#CE1124', hair: '#9a7545', skin: '#f7d3b9', beard: true },
  { id: 'jamie-smith', name: 'Jamie Smith', team: 'ENG', jersey: '#1E3A8A', accent: '#CE1124', hair: '#44311d', skin: '#f2caa8', beard: false },

  // India
  { id: 'virat-kohli', name: 'Virat Kohli', team: 'IND', jersey: '#0B5ED7', accent: '#FF9933', hair: '#111111', skin: '#b8845c', beard: true },
  { id: 'rohit-sharma', name: 'Rohhit Sharma', team: 'IND', jersey: '#0B5ED7', accent: '#FF9933', hair: '#151515', skin: '#b27f57', beard: true },
  { id: 'jasprit-bumrah', name: 'Jasprit Bumrah', team: 'IND', jersey: '#0B5ED7', accent: '#FF9933', hair: '#0d0d0d', skin: '#9a6b46', beard: true },
  { id: 'ravindra-jadeja', name: 'Ravindra Jadeja', team: 'IND', jersey: '#0B5ED7', accent: '#FF9933', hair: '#0e0e0e', skin: '#ab7850', beard: true },

  // Generic & Pro Look demo players
  { id: 'vedant-gore', name: 'Vedant Gore', team: 'MUM', jersey: '#004B8D', accent: '#D1AB3E', hair: '#141414', skin: '#b8855e', beard: true },
  { id: 'karthik-shaji', name: 'Karthik Shaji', team: 'MUM', jersey: '#004B8D', accent: '#D1AB3E', hair: '#101010', skin: '#a87550', beard: true },
  { id: 'ak-khan', name: 'A.K. Khan', team: 'OMA', jersey: '#DB161B', accent: '#008000', hair: '#181818', skin: '#b5825a', beard: true },
];

for (const p of players) {
  const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
      <defs>
        <clipPath id="circle"><circle cx="100" cy="100" r="96"/></clipPath>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0f172a"/>
          <stop offset="60%" stop-color="#1e293b"/>
          <stop offset="100%" stop-color="${p.jersey}"/>
        </linearGradient>
      </defs>
      <circle cx="100" cy="100" r="98" fill="${p.accent}" stroke="#ffffff" stroke-width="3"/>
      <g clip-path="url(#circle)">
        <rect width="200" height="200" fill="url(#bg)"/>
        <!-- Torso / Jersey -->
        <path d="M30,200 C35,145 65,135 100,135 C135,135 165,145 170,200 Z" fill="${p.jersey}"/>
        <path d="M85,135 L100,165 L115,135 Z" fill="${p.accent}"/>
        <!-- Neck -->
        <rect x="85" y="110" width="30" height="30" rx="6" fill="${p.skin}"/>
        <!-- Head -->
        <ellipse cx="100" cy="85" rx="36" ry="44" fill="${p.skin}"/>
        <!-- Hair -->
        <path d="M64,80 C62,45 80,35 100,35 C120,35 138,45 136,80 C125,50 75,50 64,80 Z" fill="${p.hair}"/>
        <!-- Eyes -->
        <ellipse cx="86" cy="82" rx="4" ry="3" fill="#1e293b"/>
        <ellipse cx="114" cy="82" rx="4" ry="3" fill="#1e293b"/>
        <!-- Eyebrows -->
        <path d="M78,74 Q86,70 94,74" stroke="${p.hair}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
        <path d="M106,74 Q114,70 122,74" stroke="${p.hair}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
        <!-- Nose -->
        <path d="M100,80 L97,94 L104,94" stroke="#d49b70" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <!-- Beard / Mouth -->
        ${p.beard ? `
          <path d="M72,88 C70,122 85,133 100,133 C115,133 130,122 128,88 C122,118 78,118 72,88 Z" fill="${p.hair}" opacity="0.85"/>
          <path d="M92,108 Q100,113 108,108" stroke="#ffffff" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        ` : `
          <path d="M91,108 Q100,114 109,108" stroke="#b86d4a" stroke-width="3" fill="none" stroke-linecap="round"/>
        `}
        <!-- Team Badge on Chest -->
        <circle cx="135" cy="175" r="14" fill="${p.accent}"/>
        <text x="135" y="180" font-family="sans-serif" font-size="10" font-weight="bold" fill="#000000" text-anchor="middle">${p.team}</text>
      </g>
    </svg>`;

  const svgBuffer = Buffer.from(svgContent.trim());
  fs.writeFileSync(path.join(overlayPlayersDir, `${p.id}.svg`), svgBuffer);
  fs.writeFileSync(path.join(serverPlayersDir, `${p.id}.svg`), svgBuffer);

  const webpBuffer = await sharp(svgBuffer).webp({ quality: 95 }).toBuffer();
  fs.writeFileSync(path.join(overlayPlayersDir, `${p.id}.webp`), webpBuffer);
  fs.writeFileSync(path.join(serverPlayersDir, `${p.id}.webp`), webpBuffer);
  console.log(`Saved player: ${p.id}`);
}

console.log('All player images generated successfully!');
