import { resolveTeam, slug } from '@stumpcast/shared';
import React, { useState } from 'react';

/**
 * Canonical team code for any name or abbreviation. The registry lives in `@stumpcast/shared` so
 * the control room, the server and the overlay all agree on one crest file — three copies of an
 * alias table is how one surface ended up showing Sierra Leone for Sri Lanka.
 */
export const normalizeTeamCode = (shortOrName?: string): string => {
  if (!shortOrName) return 'gen';
  const known = resolveTeam(shortOrName);
  if (known) return known.code;
  return slug(shortOrName) || 'gen';
};

export const getTeamAssetId = (shortOrName?: string): string => {
  return `team-${normalizeTeamCode(shortOrName)}`;
};


export const getTeamLogoUrl = (shortOrName?: string, ext: 'webp' | 'svg' = 'webp'): string => {
  return `/assets/teams/${getTeamAssetId(shortOrName)}.${ext}`;
};

/**
 * Colors for fallback shields if static asset image is unavailable
 */
const TEAM_COLORS: Record<string, { bg: string; text: string; accent: string }> = {
  rsa: { bg: 'from-emerald-700 to-green-950', text: '#FFB81C', accent: '#007749' },
  aus: { bg: 'from-amber-600 to-amber-950', text: '#FFFFFF', accent: '#00247D' },
  pak: { bg: 'from-emerald-800 to-emerald-950', text: '#FFFFFF', accent: '#01411C' },
  sl: { bg: 'from-blue-700 to-blue-950', text: '#FFBE29', accent: '#8D153A' },
  ind: { bg: 'from-sky-600 to-blue-900', text: '#FF9933', accent: '#138808' },
  eng: { bg: 'from-blue-800 to-slate-900', text: '#CE1124', accent: '#FFFFFF' },
  nz: { bg: 'from-neutral-800 to-black', text: '#FFFFFF', accent: '#00247D' },
  wi: { bg: 'from-rose-900 to-rose-950', text: '#FFC72C', accent: '#7A003C' },
  ban: { bg: 'from-emerald-900 to-emerald-950', text: '#F42A41', accent: '#006A4E' },
  afg: { bg: 'from-neutral-900 to-blue-950', text: '#FFFFFF', accent: '#D32011' },
};

export interface TeamCrestProps {
  team?: {
    id?: string;
    name: string;
    short: string;
    color?: string;
  };
  short?: string;
  name?: string;
  className?: string;
  size?: number;
  bust?: number;
}

/**
 * Renders a crisp vector/WebP team crest.
 * Never degrades to broken letter text on Windows!
 */
export const TeamCrest: React.FC<TeamCrestProps> = ({
  team,
  short,
  name,
  className = 'size-12',
  bust,
}) => {
  const teamShort = team?.short ?? short ?? '';
  const teamName = team?.name ?? name ?? teamShort;
  const code = normalizeTeamCode(teamShort || teamName);
  const assetId = `team-${code}`;

  const [step, setStep] = useState<0 | 1 | 2>(0); // 0 = webp, 1 = svg, 2 = fallback badge

  const webpUrl = `/assets/teams/${assetId}.webp${bust ? `?v=${bust}` : ''}`;
  const svgUrl = `/assets/teams/${assetId}.svg${bust ? `?v=${bust}` : ''}`;

  const colors = TEAM_COLORS[code] ?? {
    bg: 'from-blue-800 to-slate-950',
    text: '#FFFFFF',
    accent: '#3B82F6',
  };

  const displayText = (teamShort || code).toUpperCase().slice(0, 3);

  if (step === 0) {
    return (
      <img
        src={webpUrl}
        alt={teamName}
        className={`${className} object-contain`}
        onError={() => setStep(1)}
      />
    );
  }

  if (step === 1) {
    return (
      <img
        src={svgUrl}
        alt={teamName}
        className={`${className} object-contain`}
        onError={() => setStep(2)}
      />
    );
  }

  // Fallback crisp vector shield
  return (
    <div
      className={`${className} flex items-center justify-center rounded-xl bg-gradient-to-br ${colors.bg} border border-white/20 shadow select-none`}
      title={teamName}
    >
      <span className="font-heading font-black tracking-wider text-xs md:text-sm" style={{ color: colors.text }}>
        {displayText}
      </span>
    </div>
  );
};

export interface PlayerAvatarProps {
  name: string;
  className?: string;
  hasCutout?: boolean;
  bust?: number;
  /**
   * Ordered image candidates, tried left to right before falling back to initials. The squad panel
   * passes the photo URL the score site published; without this the avatar only ever asked for the
   * local `players/<slug>.webp` slot and showed initials for every player the studio had not saved
   * a cutout for — even though the live page was showing a face for all of them.
   */
  srcs?: (string | undefined)[];
}

/**
 * Renders a transparent cutout of a player or a stylish broadcast silhouette avatar.
 */
export const PlayerAvatar: React.FC<PlayerAvatarProps> = ({
  name,
  className = 'size-10',
  bust,
  srcs,
}) => {
  const playerSlug = slug(name);
  const localUrl = `/assets/players/${playerSlug}.webp${bust ? `?v=${bust}` : ''}`;
  const key = (srcs ?? []).filter(Boolean).join('|');
  const candidates = key ? (srcs!.filter(Boolean) as string[]) : [localUrl];

  // Restart at the first candidate whenever the sources change: a player keeps their component
  // across a re-render, so a latched failure would otherwise survive a successful upload.
  const [index, setIndex] = useState(0);
  const [seen, setSeen] = useState(key);
  if (seen !== key) {
    setSeen(key);
    setIndex(0);
  }

  if (index < candidates.length) {
    return (
      <img
        src={candidates[index]}
        alt={name}
        className={`${className} object-contain`}
        onError={() => setIndex((i) => i + 1)}
      />
    );
  }

  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

  return (
    <div
      className={`${className} flex items-center justify-center rounded-lg bg-surface-2 border border-border/60 text-white font-bold select-none text-xs`}
      title={name}
    >
      {initials || '👤'}
    </div>
  );
};
