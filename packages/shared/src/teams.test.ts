import { describe, expect, it } from 'vitest';
import { resolveTeam, teamCrestAssetId } from './teams';

describe('team registry', () => {
  it('resolves every spelling a feed uses to one canonical code', () => {
    const cases: [string, string][] = [
      ['South Africa', 'rsa'],
      ['RSA', 'rsa'],
      ['sa', 'rsa'],
      ['SOUTH AFRICA', 'rsa'],
      ['Australia', 'aus'],
      ['India', 'ind'],
      ['New Zealand', 'nz'],
      ['West Indies', 'wi'],
      ['Sri Lanka', 'sl'],
      ['Bangladesh', 'ban'],
      ['Chennai Super Kings', 'csk'],
      ['Sydney Thunder', 'syt'],
      ['Peshawar Zalmi', 'pz'],
    ];
    for (const [input, code] of cases) {
      expect(resolveTeam(input)?.code, input).toBe(code);
      expect(teamCrestAssetId(input), input).toBe(`team-${code}`);
    }
  });

  it('never resolves a cricket side onto a different country flag', () => {
    // `sou` is a duplicate South Africa tile and `sle` is Sierra Leone; a slice-of-name key used to
    // land on both. Sri Lanka in particular must never come out as `sle`.
    expect(resolveTeam('Sri Lanka')?.code).not.toBe('sle');
    expect(teamCrestAssetId('Sri Lanka')).toBe('team-sl');
    expect(resolveTeam('South Africa')?.code).toBe('rsa');
  });

  it('returns null rather than guessing for an unknown team', () => {
    expect(resolveTeam('Married vs Single')).toBeNull();
    expect(resolveTeam('')).toBeNull();
    expect(resolveTeam(null)).toBeNull();
    expect(teamCrestAssetId(undefined)).toBeNull();
  });

  it('has no duplicate codes and no alias claimed by two teams', () => {
    const codes = new Set<string>();
    const aliases = new Map<string, string>();
    for (const t of [
      // Every entry is reachable through its own code, so walk the registry through the resolver.
      ...[
        'rsa', 'aus', 'ind', 'pak', 'eng', 'nz', 'wi', 'sl', 'ban', 'afg', 'ire', 'zim', 'ned', 'sco',
        'oma', 'uae', 'can', 'usa', 'png', 'nep', 'hk', 'mas', 'sgp', 'tha', 'nam', 'nga', 'ken',
        'uga', 'tan', 'rwa', 'ita', 'ger', 'fra', 'esp', 'por', 'den', 'swe', 'nor', 'fin', 'sui',
        'aut', 'bel', 'csk', 'mi', 'rcb', 'kkr', 'dc', 'srh', 'rr', 'pbks', 'gt', 'lsg', 'ads', 'brh',
        'hbh', 'mlr', 'mls', 'prs', 'sys', 'syt', 'isu', 'kk', 'lq', 'pz', 'qg',
      ],
    ]) {
      const hit = resolveTeam(t);
      expect(hit, t).not.toBeNull();
      expect(codes.has(hit!.code), `duplicate code ${hit!.code}`).toBe(false);
      codes.add(hit!.code);
      for (const a of [hit!.code, hit!.name, ...hit!.aliases]) {
        const key = String(a).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        const owner = aliases.get(key);
        expect(owner === undefined || owner === hit!.code, `alias "${key}" claimed by ${owner} and ${hit!.code}`).toBe(true);
        aliases.set(key, hit!.code);
      }
    }
  });
});
