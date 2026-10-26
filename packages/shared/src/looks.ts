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

// Pro Look 2 (P2 series): the operator's own 1280x720 broadcast mockup, kept as data so the
// overlay, the server catalogue and the licence gate all treat it like any other look.
import p2K01Json from './looks-data/p2-k01.json';
import p2K02Json from './looks-data/p2-k02.json';
import p2K03Json from './looks-data/p2-k03.json';
import p2K04Json from './looks-data/p2-k04.json';
import p2K05Json from './looks-data/p2-k05.json';
import p2K08Json from './looks-data/p2-k08.json';
import p2K09Json from './looks-data/p2-k09.json';
import p2K10Json from './looks-data/p2-k10.json';
import p2K11Json from './looks-data/p2-k11.json';
import p2K12Json from './looks-data/p2-k12.json';
import p2K13Json from './looks-data/p2-k13.json';
import p2K14Json from './looks-data/p2-k14.json';
import p2K15Json from './looks-data/p2-k15.json';
import p2K16Json from './looks-data/p2-k16.json';
import p2K17Json from './looks-data/p2-k17.json';
import p2K18Json from './looks-data/p2-k18.json';
import p2K19Json from './looks-data/p2-k19.json';
import p2K20Json from './looks-data/p2-k20.json';
import p2K21Json from './looks-data/p2-k21.json';
import p2K22Json from './looks-data/p2-k22.json';
import p2K23Json from './looks-data/p2-k23.json';
import p2K24Json from './looks-data/p2-k24.json';
import p2K25Json from './looks-data/p2-k25.json';

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

/**
 * The 23 Pro Look 2 designs (P2-K01 to P2-K25). They share the look fields of the rest of the
 * catalogue but paint a different stage: the overlay switches renderer on `isProLook2`.
 */
export const PRO_LOOKS_PL2: readonly Look[] = [
  p2K01Json,
  p2K02Json,
  p2K03Json,
  p2K04Json,
  p2K05Json,
  p2K08Json,
  p2K09Json,
  p2K10Json,
  p2K11Json,
  p2K12Json,
  p2K13Json,
  p2K14Json,
  p2K15Json,
  p2K16Json,
  p2K17Json,
  p2K18Json,
  p2K19Json,
  p2K20Json,
  p2K21Json,
  p2K22Json,
  p2K23Json,
  p2K24Json,
  p2K25Json,
].map((j) => LookSchema.parse(j));

/** Every Pro look: the built-ins, the K/SC broadcast packs and the Pro Look 2 pack. */
export const ALL_PRO_LOOKS: readonly Look[] = [...PRO_LOOKS, ...PRO_LOOKS_23, ...PRO_LOOKS_PL2];

/** A look belongs to the Pro Look 2 family if its id carries the pack prefix. */
export const isProLook2 = (look: { id?: string } | undefined): boolean =>
  Boolean(look?.id?.startsWith('p2-'));

export const ALL_AVAILABLE_LOOKS: readonly Look[] = [...ALL_LOOKS, ...PRO_LOOKS_23, ...PRO_LOOKS_PL2];

export const getLook = (id: string): Look | undefined =>
  ALL_LOOKS.find((l) => l.id === id) ??
  PRO_LOOKS_23.find((l) => l.id === id) ??
  PRO_LOOKS_PL2.find((l) => l.id === id);
