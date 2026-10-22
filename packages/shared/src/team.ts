import { z } from 'zod';

/**
 * One row of an announced line-up, as the source states it.
 *
 * `players` above stays a plain list of names because that is all the overlay needs; this carries
 * the rest of what a squad page shows — the role line, the captain and wicketkeeper markers, and
 * the photo the page itself displays — so the studio can prep a cutout for every one of them.
 */
export const SquadPlayerSchema = z.object({
  name: z.string().min(1).max(60),
  /** The source's own words, e.g. "WK-Batter" or "Bowling Allrounder". Never invented. */
  role: z.string().min(1).max(40).optional(),
  captain: z.boolean().optional(),
  keeper: z.boolean().optional(),
  /** The picture the page shows for this player, same idea as a team crest. */
  imageUrl: z.string().url().optional(),
});
export type SquadPlayer = z.infer<typeof SquadPlayerSchema>;

export const TeamSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  short: z.string().min(1).max(5),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  logoAssetId: z.string().optional(),
  /** The announced line-up when the source carries one. */
  players: z.array(z.string().min(1).max(60)).max(30).optional(),
  /** The same line-up with what the source says about each player. */
  squad: z.array(SquadPlayerSchema).max(30).optional(),
});
export type Team = z.infer<typeof TeamSchema>;

export const PlayerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.enum(['batter', 'bowler', 'allrounder', 'wk']),
  teamId: z.string().min(1),
  isCaptain: z.boolean().default(false),
  isWk: z.boolean().default(false),
  photoAssetId: z.string().optional(),
});
export type Player = z.infer<typeof PlayerSchema>;

export const slug = (name: string): string =>
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const teamId = (short: string): string => `team-${short.toLowerCase()}`;

export const createTeam = (input: Pick<Team, 'name' | 'short'> & Partial<Team>): Team =>
  TeamSchema.parse({ id: teamId(input.short), color: '#19D3C5', ...input });

export const createPlayer = (input: Pick<Player, 'name' | 'teamId'> & Partial<Player>): Player =>
  PlayerSchema.parse({ id: slug(input.name), role: 'batter', ...input });
