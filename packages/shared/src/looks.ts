import { LookSchema, type Look } from './look';
import aquaMono from './looks-data/aqua-mono.json';
import coralDuskJson from './looks-data/coral-dusk.json';
import ember from './looks-data/ember.json';
import graphiteTealJson from './looks-data/graphite-teal.json';
import inkGold from './looks-data/ink-gold.json';
import midnightGlass from './looks-data/midnight-glass.json';
import pitchGreen from './looks-data/pitch-green.json';
import sandstone from './looks-data/sandstone.json';

// Pro Looks Catalog (K01-K25) matching broadcast graphics suite
import k01Json from './looks-data/k01.json';
import k02Json from './looks-data/k02.json';
import k03Json from './looks-data/k03.json';
import k04Json from './looks-data/k04.json';
import k05Json from './looks-data/k05.json';
import k08Json from './looks-data/k08.json';
import k09Json from './looks-data/k09.json';
import k10Json from './looks-data/k10.json';
import k11Json from './looks-data/k11.json';
import k12Json from './looks-data/k12.json';
import k13Json from './looks-data/k13.json';
import k14Json from './looks-data/k14.json';
import k15Json from './looks-data/k15.json';
import k16Json from './looks-data/k16.json';
import k17Json from './looks-data/k17.json';
import k18Json from './looks-data/k18.json';
import k19Json from './looks-data/k19.json';
import k20Json from './looks-data/k20.json';
import k21Json from './looks-data/k21.json';
import k22Json from './looks-data/k22.json';
import k23Json from './looks-data/k23.json';
import k24Json from './looks-data/k24.json';
import k25Json from './looks-data/k25.json';

// Original StumpCast looks (SC series)
import scMonsoonNightJson from './looks-data/sc-monsoon-night.json';
import scDesertDuskJson from './looks-data/sc-desert-dusk.json';
import scPaperScoreboardJson from './looks-data/sc-paper-scoreboard.json';
import scRoyalMaroonJson from './looks-data/sc-royal-maroon.json';
import scArcticMintJson from './looks-data/sc-arctic-mint.json';
import scVoltCarbonJson from './looks-data/sc-volt-carbon.json';

/**
 * The 8 built-in baseline Looks, defined purely as JSON tokens (see looks-data/).
 */
export const graphiteTeal: Look = LookSchema.parse(graphiteTealJson);
export const coralDusk: Look = LookSchema.parse(coralDuskJson);

export const ALL_LOOKS: readonly Look[] = [
  graphiteTeal,
  coralDusk,
  ...[midnightGlass, sandstone, pitchGreen, inkGold, aquaMono, ember].map((j) =>
    LookSchema.parse(j),
  ),
];

export const FREE_LOOKS: readonly Look[] = ALL_LOOKS.filter((l) => l.plan === 'free');
export const PRO_LOOKS: readonly Look[] = ALL_LOOKS.filter((l) => l.plan === 'pro');
export const DEFAULT_LOOK: Look = LookSchema.parse(inkGold);

/**
 * The 23 Pro Broadcast Looks (K01 to K25) from the broadcast graphics suite.
 */
export const PRO_LOOKS_23: readonly Look[] = [
  k01Json,
  k02Json,
  k03Json,
  k04Json,
  k05Json,
  k08Json,
  k09Json,
  k10Json,
  k11Json,
  k12Json,
  k13Json,
  k14Json,
  k15Json,
  k16Json,
  k17Json,
  k18Json,
  k19Json,
  k20Json,
  k21Json,
  k22Json,
  k23Json,
  k24Json,
  k25Json,
  scMonsoonNightJson,
  scDesertDuskJson,
  scPaperScoreboardJson,
  scRoyalMaroonJson,
  scArcticMintJson,
  scVoltCarbonJson,
].map((j) => LookSchema.parse(j));

export const ALL_AVAILABLE_LOOKS: readonly Look[] = [...ALL_LOOKS, ...PRO_LOOKS_23];

export const getLook = (id: string): Look | undefined =>
  ALL_LOOKS.find((l) => l.id === id) ?? PRO_LOOKS_23.find((l) => l.id === id);

