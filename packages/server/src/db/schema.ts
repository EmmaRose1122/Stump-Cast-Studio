import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const matches = sqliteTable('matches', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  format: text('format').notNull(),
  status: text('status').notNull(),
  source: text('source').notNull().default('manual'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const snapshots = sqliteTable('match_state_snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  matchId: text('match_id').notNull(),
  state: text('state', { mode: 'json' }).notNull(),
  createdAt: integer('created_at').notNull(),
});

export const events = sqliteTable('events', {
  id: text('id').primaryKey(),
  matchId: text('match_id').notNull(),
  type: text('type').notNull(),
  payload: text('payload', { mode: 'json' }),
  at: integer('at').notNull(),
});

export const teams = sqliteTable('teams', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  short: text('short').notNull(),
  color: text('color').notNull(),
  logoAssetId: text('logo_asset_id'),
});

export const players = sqliteTable('players', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  teamId: text('team_id').notNull(),
  isCaptain: integer('is_captain', { mode: 'boolean' }).notNull().default(false),
  isWk: integer('is_wk', { mode: 'boolean' }).notNull().default(false),
  photoAssetId: text('photo_asset_id'),
});

export const assets = sqliteTable('assets', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  file: text('file').notNull(),
  rightsConfirmed: integer('rights_confirmed', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).notNull(),
});

export const sounds = sqliteTable('sounds', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  file: text('file').notNull(),
  includeInLoop: integer('include_in_loop', { mode: 'boolean' }).notNull().default(false),
  volume: real('volume').notNull().default(1),
});

export const licence = sqliteTable('licence', {
  id: integer('id').primaryKey(),
  token: text('token').notNull(),
  checkedAt: integer('checked_at'),
});

export const looks = sqliteTable('looks', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  plan: text('plan').notNull().default('free'),
  definition: text('definition', { mode: 'json' }).notNull(),
});
