/**
 * Canonical team identities.
 *
 * A scraped page gives a free-text name ("South Africa", "RSA", "Super Kings"), and every crest
 * file on disk is keyed by one short code. Without a single table mapping the two, each code path
 * invented its own key — and a wrong key can still hit a real file (`sle` is Sierra Leone, not
 * Sri Lanka), which puts the *wrong flag* on air. Resolution therefore returns nothing rather
 * than guessing.
 */
export interface TeamIdentity {
  /** The asset code: crest files are `team-<code>.webp`. */
  code: string;
  name: string;
  /** Every spelling/abbreviation seen from feeds and operators. */
  aliases: string[];
  /** Broadcast colours: [primary, secondary]. */
  colors: [string, string];
  kind: 'international' | 'franchise';
}

const T = (
  code: string,
  name: string,
  aliases: string[],
  colors: [string, string],
  kind: TeamIdentity['kind'] = 'international',
): TeamIdentity => ({ code, name, aliases, colors, kind });

export const TEAM_REGISTRY: readonly TeamIdentity[] = [
  // ---- Full members -------------------------------------------------------------------------
  T('rsa', 'South Africa', ['rsa', 'south africa', 'southafrica', 'sa', 'proteas'], ['#007A4D', '#FFB81C']),
  T('aus', 'Australia', ['aus', 'australia', 'au', 'baggy green'], ['#00843D', '#FFCD00']),
  T('ind', 'India', ['ind', 'india', 'team india', 'blue tigers'], ['#1B4B99', '#E7A61C']),
  T('pak', 'Pakistan', ['pak', 'pakistan', 'green shirts'], ['#01411C', '#FFFFFF']),
  T('eng', 'England', ['eng', 'england', 'alion'], ['#0C2340', '#C8102E']),
  T('nz', 'new zealand', ['nz', 'new zealand', 'black caps'], ['#000000', '#FFB612']),
  T('wi', 'west indies', ['wi', 'west indies', 'westindies', 'california'], ['#7A003C', '#FFC72C']),
  T('sl', 'Sri Lanka', ['sl', 'sri lanka', 'srilanka', 'srl', 'lanka'], ['#00534E', '#FFBE29']),
  T('ban', 'Bangladesh', ['ban', 'bangladesh', 'tigers'], ['#006A4E', '#F42A41']),
  T('afg', 'Afghanistan', ['afg', 'afghanistan'], ['#000000', '#DA121A']),
  T('ire', 'Ireland', ['ire', 'irland', 'ireland', 'eire'], ['#015744', '#F0C84A']),
  T('zim', 'Zimbabwe', ['zim', 'zimbabwe'], ['#000000', '#F5A623']),

  // ---- Other international sides ------------------------------------------------------------
  T('ned', 'Netherlands', ['ned', 'netherlands', 'holland', 'net'], ['#FF6F00', '#21468B']),
  T('sco', 'Scotland', ['sco', 'scotland'], ['#003078', '#D1A33E']),
  T('oma', 'Oman', ['oma', 'oman'], ['#9E1B32', '#FFFFFF']),
  T('uae', 'United Arab Emirates', ['uae', 'united arab emirates', 'emirates'], ['#00732F', '#FFFFFF']),
  T('can', 'Canada', ['can', 'canada'], ['#D80621', '#FFFFFF']),
  T('usa', 'USA', ['usa', 'united states', 'united states of america'], ['#0A3161', '#B31942']),
  T('png', 'Papua New Guinea', ['png', 'papua new guinea'], ['#000000', '#CE1126']),
  T('nep', 'Nepal', ['nep', 'nepal'], ['#DC143C', '#003893']),
  T('hk', 'Hong Kong', ['hk', 'hong kong', 'hongkong'], ['#C41E3A', '#FFFFFF']),
  T('mas', 'Malaysia', ['mas', 'malaysia'], ['#010066', '#CE1126']),
  T('sgp', 'Singapore', ['sgp', 'singapore'], ['#EF3340', '#FFFFFF']),
  T('tha', 'Thailand', ['tha', 'thailand'], ['#002868', '#F4F5F8']),
  T('nam', 'Namibia', ['nam', 'namibia'], ['#003580', '#D0A520']),
  T('nga', 'Nigeria', ['nga', 'nigeria'], ['#008751', '#FFFFFF']),
  T('ken', 'Kenya', ['ken', 'kenya'], ['#000000', '#BB0000']),
  T('uga', 'Uganda', ['uga', 'uganda'], ['#000000', '#FCDC04']),
  T('tan', 'Tanzania', ['tan', 'tanzania'], ['#1EB53A', '#FCD116']),
  T('rwa', 'Rwanda', ['rwa', 'rwanda'], ['#00A1DE', '#FAD201']),
  T('ita', 'Italy', ['ita', 'italy'], ['#0066CC', '#FFFFFF']),
  T('ger', 'Germany', ['ger', 'germany'], ['#000000', '#DD0000']),
  T('fra', 'France', ['fra', 'france'], ['#002395', '#ED2939']),
  T('esp', 'Spain', ['esp', 'spain'], ['#AA151B', '#F1BF00']),
  T('por', 'Portugal', ['por', 'portugal'], ['#006600', '#FF0000']),
  T('den', 'Denmark', ['den', 'denmark'], ['#C60C30', '#FFFFFF']),
  T('swe', 'Sweden', ['swe', 'sweden'], ['#006AA7', '#FECC02']),
  T('nor', 'Norway', ['nor', 'norway'], ['#BA0C2F', '#FFFFFF']),
  T('fin', 'Finland', ['fin', 'finland'], ['#003580', '#FFFFFF']),
  T('sui', 'Switzerland', ['sui', 'switzerland'], ['#DA291C', '#FFFFFF']),
  T('aut', 'Austria', ['aut', 'austria'], ['#ED2939', '#FFFFFF']),
  T('bel', 'Belgium', ['bel', 'belgium'], ['#FDDA24', '#000000']),
  T('nzl', 'Netherlands Women', ['nzw'], ['#FF6F00', '#21468B']),

  // ---- IPL ----------------------------------------------------------------------------------
  T('csk', 'Chennai Super Kings', ['csk', 'chennai super kings', 'super kings', 'chennai'], ['#F9CD05', '#005DB7'], 'franchise'),
  T('mi', 'Mumbai Indians', ['mi', 'mumbai indians', 'mumbai'], ['#041E42', '#D1AB3E'], 'franchise'),
  T('rcb', 'Royal Challengers Bengaluru', ['rcb', 'royal challengers', 'bengaluru', 'bangalore'], ['#D5152A', '#000000'], 'franchise'),
  T('kkr', 'Kolkata Knight Riders', ['kkr', 'kolkata knight riders', 'kolkata'], ['#3A225D', '#E4AA31'], 'franchise'),
  T('dc', 'Delhi Capitals', ['dc', 'delhi capitals', 'delhi'], ['#17449B', '#EF1B23'], 'franchise'),
  T('srh', 'Sunrisers Hyderabad', ['srh', 'sunrisers', 'hyderabad'], ['#F26522', '#000000'], 'franchise'),
  T('rr', 'Rajasthan Royals', ['rr', 'rajasthan royals', 'rajasthan', 'rjr'], ['#EA1A85', '#254AA5'], 'franchise'),
  T('pbks', 'Punjab Kings', ['pbks', 'kxip', 'punjab kings', 'kings xi', 'chandigarh'], ['#DD1F2D', '#A7A9AC'], 'franchise'),
  T('gt', 'Gujarat Titans', ['gt', 'gujarat titans', 'gujarat'], ['#1B2133', '#E2C47F'], 'franchise'),
  T('lsg', 'Lucknow Super Giants', ['lsg', 'lucknow super giants', 'lucknow'], ['#0A52A0', '#E2C47F'], 'franchise'),

  // ---- BBL ----------------------------------------------------------------------------------
  T('ads', 'Adelaide Strikers', ['ads', 'adelaide strikers', 'adelaide'], ['#1CE7DB', '#041E42'], 'franchise'),
  T('brh', 'Brisbane Heat', ['brh', 'brisbane heat', 'brisbane'], ['#F57D1F', '#1A1A1A'], 'franchise'),
  T('hbh', 'Hobart Hurricanes', ['hbh', 'hobart hurricanes', 'hobart'], ['#1E90FF', '#0B1F3A'], 'franchise'),
  T('mlr', 'Melbourne Renegades', ['mlr', 'melbourne renegades', 'renegades'], ['#0BB2E8', '#1A1A1A'], 'franchise'),
  T('mls', 'Melbourne Stars', ['mls', 'melbourne stars', 'stars'], ['#00A651', '#1A1A1A'], 'franchise'),
  T('prs', 'Perth Scorchers', ['prs', 'perth scorchers', 'perth'], ['#EE1C25', '#1A1A1A'], 'franchise'),
  T('sys', 'Sydney Sixers', ['sys', 'sydney sixers', 'sixers'], ['#00838F', '#FFBB00'], 'franchise'),
  T('syt', 'Sydney Thunder', ['syt', 'sydney thunder', 'thunder'], ['#004B8D', '#FFD200'], 'franchise'),

  // ---- PSL ----------------------------------------------------------------------------------
  T('isu', 'Islamabad United', ['isu', 'islamabad united'], ['#C5272E', '#1A1A1A'], 'franchise'),
  T('kk', 'Karachi Kings', ['kk', 'krk', 'karachi kings', 'karachi'], ['#1D3461', '#E7A33E'], 'franchise'),
  T('lq', 'Lahore Qalandars', ['lq', 'lhq', 'lahore qalandars', 'lahore'], ['#00549A', '#F5A623'], 'franchise'),
  T('pz', 'Peshawar Zalmi', ['pz', 'psz', 'peshawar zalmi', 'peshawar'], ['#EE1C25', '#F5A623'], 'franchise'),
  T('qg', 'Quetta Gladiators', ['qg', 'qtg', 'quetta gladiators', 'quetta'], ['#6A2C91', '#F5A623'], 'franchise'),
  T('ms', 'Multan Sultans', ['ms', 'multan sultans', 'multan'], ['#F5A623', '#0B4D3C'], 'franchise'),
];

const clean = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** code -> identity, and every alias -> identity. Built once. */
const byCode = new Map<string, TeamIdentity>();
const byAlias = new Map<string, TeamIdentity>();
for (const t of TEAM_REGISTRY) {
  byCode.set(t.code, t);
  for (const a of [t.code, t.name, ...t.aliases]) {
    const key = clean(a);
    if (key && !byAlias.has(key)) byAlias.set(key, t);
  }
}

/**
 * Resolve any team string the app might see to one identity. Returns `null` for an unknown team:
 * callers must then show no crest rather than a near-miss, because a wrong flag is worse than an
 * empty one.
 */
export function resolveTeam(nameOrShort: string | null | undefined): TeamIdentity | null {
  if (!nameOrShort) return null;
  const key = clean(nameOrShort);
  if (!key) return null;
  const direct = byAlias.get(key);
  if (direct) return direct;
  // "south africa men", "ind vs aus" style noise: try the first words, then a compact form.
  const words = key.split(' ');
  for (let n = words.length - 1; n > 1; n--) {
    const hit = byAlias.get(words.slice(0, n).join(' '));
    if (hit) return hit;
  }
  return byAlias.get(words.join('')) ?? null;
}

/** Asset id for a crest, or `null` when the team is not in the registry. */
export const teamCrestAssetId = (nameOrShort: string | null | undefined): string | null => {
  const t = resolveTeam(nameOrShort);
  return t ? `team-${t.code}` : null;
};

export const teamColor = (
  nameOrShort: string | null | undefined,
  index = 0,
): string | null => {
  const t = resolveTeam(nameOrShort);
  if (!t) return null;
  return t.colors[index % 2] ?? t.colors[0] ?? null;
};
