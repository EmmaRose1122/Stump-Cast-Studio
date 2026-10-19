import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const overlayTeamsDir = path.resolve('../overlay/public/assets/teams');
const serverTeamsDir = path.resolve('data/assets/teams');

fs.mkdirSync(overlayTeamsDir, { recursive: true });
fs.mkdirSync(serverTeamsDir, { recursive: true });

const flags = {
  'team-rsa': `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" width="300" height="200">
      <defs>
        <clipPath id="c"><rect width="300" height="200" rx="20"/></clipPath>
      </defs>
      <g clip-path="url(#c)">
        <rect width="300" height="100" fill="#E03C31"/>
        <rect y="100" width="300" height="100" fill="#001489"/>
        <path d="M0,0 L120,100 L0,200 Z" fill="#000000"/>
        <path d="M0,0 L120,100 L0,200" fill="none" stroke="#FFB81C" stroke-width="24"/>
        <path d="M0,0 L120,100 L300,100 M120,100 L0,200" fill="none" stroke="#FFFFFF" stroke-width="66"/>
        <path d="M0,0 L120,100 L300,100 M120,100 L0,200" fill="none" stroke="#007749" stroke-width="40"/>
        <path d="M0,0 L120,100 L0,200 Z" fill="#000000"/>
        <path d="M0,0 L120,100 L0,200" fill="none" stroke="#FFB81C" stroke-width="12"/>
      </g>
    </svg>`,

  'team-aus': `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" width="300" height="200">
      <defs>
        <clipPath id="c"><rect width="300" height="200" rx="20"/></clipPath>
        <polygon id="star7" points="0,-12 2.7,-3.7 10.4,-6 5.2,0 11.4,4 3.7,5.5 5,13 0,7.2 -5,13 -3.7,5.5 -11.4,4 -5.2,0 -10.4,-6 -2.7,-3.7" fill="#fff"/>
        <polygon id="star5" points="0,-8 2.4,-2.5 8.3,-2.5 3.5,1 5.3,6.5 0,3.2 -5.3,6.5 -3.5,1 -8.3,-2.5 -2.4,-2.5" fill="#fff"/>
      </defs>
      <g clip-path="url(#c)">
        <rect width="300" height="200" fill="#00008B"/>
        <!-- Union Jack in canton -->
        <g>
          <rect width="150" height="100" fill="#00247D"/>
          <path d="M0,0 L150,100 M150,0 L0,100" stroke="#fff" stroke-width="20"/>
          <path d="M0,0 L150,100 M150,0 L0,100" stroke="#CF142B" stroke-width="12"/>
          <path d="M75,0 V100 M0,50 H150" stroke="#fff" stroke-width="32"/>
          <path d="M75,0 V100 M0,50 H150" stroke="#CF142B" stroke-width="20"/>
        </g>
        <!-- Commonwealth Star -->
        <use href="#star7" transform="translate(75, 150) scale(1.8)"/>
        <!-- Southern Cross -->
        <use href="#star7" transform="translate(225, 160) scale(1.1)"/>
        <use href="#star7" transform="translate(195, 105) scale(1.1)"/>
        <use href="#star7" transform="translate(225, 45) scale(1.1)"/>
        <use href="#star7" transform="translate(258, 85) scale(1.1)"/>
        <use href="#star5" transform="translate(240, 125) scale(0.9)"/>
      </g>
    </svg>`,

  'team-ind': `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" width="300" height="200">
      <defs><clipPath id="c"><rect width="300" height="200" rx="20"/></clipPath></defs>
      <g clip-path="url(#c)">
        <rect width="300" height="66.7" fill="#FF9933"/>
        <rect y="66.7" width="300" height="66.7" fill="#FFFFFF"/>
        <rect y="133.4" width="300" height="66.7" fill="#138808"/>
        <circle cx="150" cy="100" r="24" fill="none" stroke="#000080" stroke-width="3"/>
        <circle cx="150" cy="100" r="4" fill="#000080"/>
        <!-- 24 spokes -->
        ${Array.from({ length: 24 }).map((_, i) => `
          <line x1="150" y1="100" x2="${150 + 24 * Math.cos((i * 15 * Math.PI) / 180)}" y2="${100 + 24 * Math.sin((i * 15 * Math.PI) / 180)}" stroke="#000080" stroke-width="1.5"/>
        `).join('')}
      </g>
    </svg>`,

  'team-pak': `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" width="300" height="200">
      <defs><clipPath id="c"><rect width="300" height="200" rx="20"/></clipPath></defs>
      <g clip-path="url(#c)">
        <rect width="300" height="200" fill="#01411C"/>
        <rect width="75" height="200" fill="#FFFFFF"/>
        <circle cx="195" cy="100" r="48" fill="#FFFFFF"/>
        <circle cx="210" cy="90" r="44" fill="#01411C"/>
        <polygon points="212,68 217,80 230,80 220,88 224,101 212,93 200,101 204,88 194,80 207,80" fill="#FFFFFF"/>
      </g>
    </svg>`,

  'team-eng': `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" width="300" height="200">
      <defs><clipPath id="c"><rect width="300" height="200" rx="20"/></clipPath></defs>
      <g clip-path="url(#c)">
        <rect width="300" height="200" fill="#FFFFFF"/>
        <path d="M130,0 H170 V200 H130 Z M0,80 H300 V120 H0 Z" fill="#CE1124"/>
      </g>
    </svg>`,

  'team-nz': `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" width="300" height="200">
      <defs>
        <clipPath id="c"><rect width="300" height="200" rx="20"/></clipPath>
        <g id="nzstar">
          <polygon points="0,-12 3.5,-3.7 11.4,-3.7 5,1.2 7.5,9 0,4.2 -7.5,9 -5,1.2 -11.4,-3.7 -3.5,-3.7" fill="#fff"/>
          <polygon points="0,-9 2.6,-2.8 8.5,-2.8 3.8,0.9 5.6,6.8 0,3.2 -5.6,6.8 -3.8,0.9 -8.5,-2.8 -2.6,-2.8" fill="#CC142B"/>
        </g>
      </defs>
      <g clip-path="url(#c)">
        <rect width="300" height="200" fill="#00247D"/>
        <!-- Union Jack -->
        <g>
          <rect width="150" height="100" fill="#00247D"/>
          <path d="M0,0 L150,100 M150,0 L0,100" stroke="#fff" stroke-width="20"/>
          <path d="M0,0 L150,100 M150,0 L0,100" stroke="#CF142B" stroke-width="12"/>
          <path d="M75,0 V100 M0,50 H150" stroke="#fff" stroke-width="32"/>
          <path d="M75,0 V100 M0,50 H150" stroke="#CF142B" stroke-width="20"/>
        </g>
        <use href="#nzstar" transform="translate(235, 45)"/>
        <use href="#nzstar" transform="translate(210, 105) scale(0.9)"/>
        <use href="#nzstar" transform="translate(235, 165)"/>
        <use href="#nzstar" transform="translate(265, 95) scale(0.85)"/>
      </g>
    </svg>`,

  'team-wi': `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" width="300" height="200">
      <defs><clipPath id="c"><rect width="300" height="200" rx="20"/></clipPath></defs>
      <g clip-path="url(#c)">
        <rect width="300" height="200" fill="#7A003C"/>
        <!-- Golden shield with palm and wicket -->
        <circle cx="150" cy="100" r="60" fill="#FFC72C"/>
        <circle cx="150" cy="100" r="54" fill="#00A3E0"/>
        <!-- Sun -->
        <circle cx="150" cy="85" r="24" fill="#FFC72C"/>
        <!-- Island -->
        <path d="M105,130 Q150,110 195,130 Z" fill="#007749"/>
        <!-- Palm trunk -->
        <path d="M148,85 Q145,105 146,125" stroke="#7A3C00" stroke-width="6" fill="none"/>
        <circle cx="140" cy="80" r="12" fill="#007749"/>
        <circle cx="155" cy="78" r="14" fill="#007749"/>
        <!-- Stumps -->
        <rect x="142" y="112" width="3" height="18" fill="#FFFFFF"/>
        <rect x="148" y="112" width="3" height="18" fill="#FFFFFF"/>
        <rect x="154" y="112" width="3" height="18" fill="#FFFFFF"/>
        <rect x="140" y="110" width="19" height="3" fill="#FFFFFF"/>
      </g>
    </svg>`,

  'team-sl': `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" width="300" height="200">
      <defs><clipPath id="c"><rect width="300" height="200" rx="20"/></clipPath></defs>
      <g clip-path="url(#c)">
        <rect width="300" height="200" fill="#FFBE29"/>
        <rect x="10" y="10" width="50" height="180" fill="#00534E"/>
        <rect x="65" y="10" width="50" height="180" fill="#EB7400"/>
        <rect x="120" y="10" width="170" height="180" fill="#8D153A"/>
        <!-- Golden Lion Silhouette -->
        <circle cx="195" cy="85" r="20" fill="#FFBE29"/>
        <rect x="180" y="95" width="45" height="30" rx="8" fill="#FFBE29"/>
        <path d="M210,80 L235,65 L228,85 Z" fill="#FFBE29"/>
      </g>
    </svg>`,

  'team-ban': `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" width="300" height="200">
      <defs><clipPath id="c"><rect width="300" height="200" rx="20"/></clipPath></defs>
      <g clip-path="url(#c)">
        <rect width="300" height="200" fill="#006A4E"/>
        <circle cx="135" cy="100" r="60" fill="#F42A41"/>
      </g>
    </svg>`,

  'team-afg': `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" width="300" height="200">
      <defs><clipPath id="c"><rect width="300" height="200" rx="20"/></clipPath></defs>
      <g clip-path="url(#c)">
        <rect width="100" height="200" fill="#000000"/>
        <rect x="100" width="100" height="200" fill="#D32011"/>
        <rect x="200" width="100" height="200" fill="#007A3D"/>
        <!-- Emblem -->
        <circle cx="150" cy="100" r="35" fill="none" stroke="#FFFFFF" stroke-width="4"/>
        <path d="M135,115 H165 V95 H135 Z" fill="#FFFFFF"/>
      </g>
    </svg>`,

  'team-oma': `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" width="300" height="200">
      <defs><clipPath id="c"><rect width="300" height="200" rx="20"/></clipPath></defs>
      <g clip-path="url(#c)">
        <rect width="300" height="66.7" fill="#FFFFFF"/>
        <rect y="66.7" width="300" height="66.7" fill="#DB161B"/>
        <rect y="133.4" width="300" height="66.7" fill="#008000"/>
        <rect width="70" height="200" fill="#DB161B"/>
        <!-- Khanjar emblem -->
        <circle cx="35" cy="35" r="18" fill="none" stroke="#FFFFFF" stroke-width="3"/>
      </g>
    </svg>`,

  'team-mum': `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" width="300" height="200">
      <defs><clipPath id="c"><rect width="300" height="200" rx="20"/></clipPath></defs>
      <g clip-path="url(#c)">
        <rect width="300" height="200" fill="#004B8D"/>
        <!-- Gold razor chakra / hurricane badge -->
        <circle cx="150" cy="100" r="60" fill="none" stroke="#D1AB3E" stroke-width="12"/>
        <circle cx="150" cy="100" r="30" fill="#D1AB3E"/>
        <path d="M150,30 L165,70 L135,70 Z M150,170 L165,130 L135,130 Z M80,100 L120,85 L120,115 Z M220,100 L180,85 L180,115 Z" fill="#D1AB3E"/>
      </g>
    </svg>`,
};

for (const [id, svgContent] of Object.entries(flags)) {
  const cleanSvg = svgContent.trim();
  const svgBuffer = Buffer.from(cleanSvg);

  // Write SVG files
  fs.writeFileSync(path.join(overlayTeamsDir, `${id}.svg`), svgBuffer);
  fs.writeFileSync(path.join(serverTeamsDir, `${id}.svg`), svgBuffer);

  // Convert to high-quality WebP using sharp
  const webpBuffer = await sharp(svgBuffer).webp({ quality: 95 }).toBuffer();
  fs.writeFileSync(path.join(overlayTeamsDir, `${id}.webp`), webpBuffer);
  fs.writeFileSync(path.join(serverTeamsDir, `${id}.webp`), webpBuffer);
  console.log(`Saved ${id}.webp and ${id}.svg`);
}

console.log('All team flags generated successfully!');
