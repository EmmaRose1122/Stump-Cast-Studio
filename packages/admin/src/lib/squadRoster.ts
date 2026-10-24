import type { Team } from '@stumpcast/shared';

/** One row in the FULL MATCH SQUADS panel. `imageUrl` is the picture the score site itself shows. */
export interface RosterPlayer {
  name: string;
  role: string;
  tag?: 'C' | 'WK';
  imageUrl?: string;
}

/** Where a roster came from, so the panel can say whether it is the real line-up. */
export type RosterSource = 'uploaded' | 'squad' | 'players' | 'demo' | 'empty';

export interface Roster {
  players: RosterPlayer[];
  source: RosterSource;
}

type TeamLineup = Pick<Team, 'squad' | 'players'>;

const fromSquad = (team: TeamLineup): RosterPlayer[] =>
  (team.squad ?? []).map((p) => ({
    name: p.name,
    role: p.role ?? 'Player',
    tag: p.captain ? 'C' : p.keeper ? 'WK' : undefined,
    imageUrl: p.imageUrl,
  }));

const fromNames = (team: TeamLineup): RosterPlayer[] =>
  (team.players ?? []).map((name) => ({ name, role: 'Player' }));

/**
 * Picks the line-up the panel should show.
 *
 * The live match is the authority: a squads page carries the announced XI with roles, the captain
 * and keeper markers, and a photo for each player. The panel used to ignore all of it and fall
 * straight through to a hard-coded national XI, so a New Zealand v India series rendered an
 * eleven from a different tour. An operator's own upload still wins (that is a deliberate edit),
 * and the built-in list is last, explicitly marked `demo` so it is never mistaken for live data.
 */
export const rosterFromTeam = (
  team: TeamLineup | undefined,
  uploaded: RosterPlayer[] | undefined,
  demo: RosterPlayer[] | undefined,
): Roster => {
  if (uploaded && uploaded.length > 0) return { players: uploaded, source: 'uploaded' };
  if (team?.squad && team.squad.length > 0) return { players: fromSquad(team), source: 'squad' };
  if (team?.players && team.players.length > 0) {
    return { players: fromNames(team), source: 'players' };
  }
  if (demo && demo.length > 0) return { players: demo, source: 'demo' };
  return { players: [], source: 'empty' };
};

/**
 * A player is on screen if we can actually paint a face: either the score site gave us a photo URL,
 * or a local asset exists for that slug. Readiness used to mean "a row exists in the asset table",
 * which counted the generated silhouettes as ready and showed 11/11 over an empty-looking panel.
 */
export const hasPlayerImage = (
  player: RosterPlayer,
  hasLocalAsset: (name: string) => boolean,
): boolean => Boolean(player.imageUrl) || hasLocalAsset(player.name);
