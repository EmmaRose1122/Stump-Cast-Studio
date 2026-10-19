export interface ParsedPlayer {
  name: string;
  role?: string;
  tag?: string;
  team?: string;
  number?: number;
}

export interface ParsedTeam {
  name: string;
  short?: string;
  players: ParsedPlayer[];
}

export interface ParsedSquadResult {
  teams: ParsedTeam[];
  allPlayers: ParsedPlayer[];
}

/**
 * Parses raw squad file content (CSV, JSON, or multiline text)
 * and returns structured teams and players.
 */
export function parseSquadFile(content: string, defaultTeamName = 'Team'): ParsedSquadResult {
  const trimmed = content.trim();
  if (!trimmed) {
    return { teams: [], allPlayers: [] };
  }

  // 1. Try parsing as JSON first
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      return parseJsonSquad(parsed, defaultTeamName);
    } catch {
      // Fall through to CSV/text parser if JSON parsing fails
    }
  }

  // 2. Parse as CSV / Delimited text
  return parseCsvOrTextSquad(trimmed, defaultTeamName);
}

function parseJsonSquad(json: unknown, defaultTeam: string): ParsedSquadResult {
  if (Array.isArray(json)) {
    const players: ParsedPlayer[] = [];
    const teamGroups = new Map<string, ParsedPlayer[]>();

    for (const item of json) {
      if (typeof item === 'string') {
        const name = item.trim();
        if (name) {
          const p: ParsedPlayer = { name };
          players.push(p);
          const list = teamGroups.get(defaultTeam) ?? [];
          list.push(p);
          teamGroups.set(defaultTeam, list);
        }
      } else if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>;
        const name = String(obj.name ?? obj.player ?? obj.playerName ?? '').trim();
        if (name) {
          const team = obj.team ? String(obj.team).trim() : defaultTeam;
          const p: ParsedPlayer = {
            name,
            role: obj.role ? String(obj.role).trim() : undefined,
            tag: obj.tag ? String(obj.tag).trim() : obj.isCaptain ? 'C' : obj.isWK ? 'WK' : undefined,
            team,
            number: typeof obj.number === 'number' ? obj.number : undefined,
          };
          players.push(p);
          const list = teamGroups.get(team) ?? [];
          list.push(p);
          teamGroups.set(team, list);
        }
      }
    }

    const teams: ParsedTeam[] = Array.from(teamGroups.entries()).map(([teamName, teamPlayers]) => ({
      name: teamName,
      short: teamName.slice(0, 3).toUpperCase(),
      players: teamPlayers,
    }));

    return { teams, allPlayers: players };
  }

  if (json && typeof json === 'object') {
    const obj = json as Record<string, unknown>;

    // Multi-team schema: { "teams": [ { "name": "Team A", "players": [...] } ] }
    if (Array.isArray(obj.teams)) {
      const teams: ParsedTeam[] = [];
      const allPlayers: ParsedPlayer[] = [];

      for (const t of obj.teams) {
        if (t && typeof t === 'object') {
          const tObj = t as Record<string, unknown>;
          const teamName = String(tObj.name ?? defaultTeam).trim();
          const teamShort = tObj.short ? String(tObj.short).trim().toUpperCase() : teamName.slice(0, 3).toUpperCase();
          const pList = Array.isArray(tObj.players) ? tObj.players : [];
          const players: ParsedPlayer[] = [];

          for (const item of pList) {
            if (typeof item === 'string') {
              const name = item.trim();
              if (name) {
                const p = { name, team: teamName };
                players.push(p);
                allPlayers.push(p);
              }
            } else if (item && typeof item === 'object') {
              const pObj = item as Record<string, unknown>;
              const name = String(pObj.name ?? pObj.player ?? '').trim();
              if (name) {
                const p: ParsedPlayer = {
                  name,
                  role: pObj.role ? String(pObj.role).trim() : undefined,
                  tag: pObj.tag ? String(pObj.tag).trim() : pObj.isCaptain ? 'C' : pObj.isWK ? 'WK' : undefined,
                  team: teamName,
                  number: typeof pObj.number === 'number' ? pObj.number : undefined,
                };
                players.push(p);
                allPlayers.push(p);
              }
            }
          }

          teams.push({ name: teamName, short: teamShort, players });
        }
      }

      return { teams, allPlayers };
    }

    // Single-team schema: { "team": "Team A", "players": [...] }
    const teamName = String(obj.team ?? obj.name ?? defaultTeam).trim();
    const rawPlayers = Array.isArray(obj.players) ? obj.players : [];
    const players: ParsedPlayer[] = [];

    for (const item of rawPlayers) {
      if (typeof item === 'string') {
        const name = item.trim();
        if (name) players.push({ name, team: teamName });
      } else if (item && typeof item === 'object') {
        const pObj = item as Record<string, unknown>;
        const name = String(pObj.name ?? pObj.player ?? '').trim();
        if (name) {
          players.push({
            name,
            role: pObj.role ? String(pObj.role).trim() : undefined,
            tag: pObj.tag ? String(pObj.tag).trim() : pObj.isCaptain ? 'C' : pObj.isWK ? 'WK' : undefined,
            team: teamName,
            number: typeof pObj.number === 'number' ? pObj.number : undefined,
          });
        }
      }
    }

    return {
      teams: [{ name: teamName, short: teamName.slice(0, 3).toUpperCase(), players }],
      allPlayers: players,
    };
  }

  return { teams: [], allPlayers: [] };
}

function parseCsvOrTextSquad(content: string, defaultTeam: string): ParsedSquadResult {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  if (lines.length === 0) {
    return { teams: [], allPlayers: [] };
  }

  // Split line respecting basic quotes: "Markram, Aiden",Batter
  const splitLine = (line: string): string[] => {
    const parts: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if ((char === ',' || char === '\t') && !inQuotes) {
        parts.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    parts.push(current.trim());
    return parts.map((p) => p.replace(/^"|"$/g, '').trim());
  };

  const firstRow = splitLine(lines[0] ?? '');
  const lowerHeader = firstRow.map((c) => c.toLowerCase());

  let nameCol = -1;
  let roleCol = -1;
  let tagCol = -1;
  let teamCol = -1;
  let numCol = -1;

  for (let i = 0; i < lowerHeader.length; i++) {
    const h = lowerHeader[i] ?? '';
    if (['name', 'player', 'player name', 'player_name'].includes(h)) nameCol = i;
    else if (['role', 'position', 'type'].includes(h)) roleCol = i;
    else if (['tag', 'captain', 'c/wk', 'status'].includes(h)) tagCol = i;
    else if (['team', 'team name', 'squad'].includes(h)) teamCol = i;
    else if (['number', 'jersey', 'no', '#'].includes(h)) numCol = i;
  }

  const hasHeader = nameCol !== -1 || teamCol !== -1;
  const dataRows = hasHeader ? lines.slice(1) : lines;

  // If no header detected and row has multiple columns, default col 0 to name
  if (nameCol === -1) {
    nameCol = 0;
    if (firstRow.length > 1 && roleCol === -1) roleCol = 1;
    if (firstRow.length > 2 && tagCol === -1) tagCol = 2;
  }

  const allPlayers: ParsedPlayer[] = [];
  const teamGroups = new Map<string, ParsedPlayer[]>();

  for (const line of dataRows) {
    const cols = splitLine(line);
    const rawName = cols[nameCol] ?? '';
    const name = rawName.trim();
    if (!name) continue;

    const teamColVal = teamCol !== -1 ? cols[teamCol]?.trim() : undefined;
    const team = teamColVal ? teamColVal : defaultTeam;
    const role = roleCol !== -1 ? cols[roleCol]?.trim() : undefined;
    const tag = tagCol !== -1 ? cols[tagCol]?.trim() : undefined;
    const numStr = numCol !== -1 ? cols[numCol]?.trim() : undefined;
    const num = numStr && !isNaN(Number(numStr)) ? Number(numStr) : undefined;

    const player: ParsedPlayer = {
      name,
      team,
      role,
      tag,
      number: num,
    };

    allPlayers.push(player);
    const list = teamGroups.get(team) ?? [];
    list.push(player);
    teamGroups.set(team, list);
  }

  const teams: ParsedTeam[] = Array.from(teamGroups.entries()).map(([teamName, teamPlayers]) => ({
    name: teamName,
    short: teamName.slice(0, 3).toUpperCase(),
    players: teamPlayers,
  }));

  return { teams, allPlayers };
}
