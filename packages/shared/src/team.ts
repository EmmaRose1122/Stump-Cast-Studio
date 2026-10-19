import { z } from 'zod';

export const TeamSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  short: z.string().min(1).max(5),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  logoAssetId: z.string().optional(),
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
