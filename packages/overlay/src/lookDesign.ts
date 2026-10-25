import type { Look } from '@stumpcast/shared';

/**
 * Broadcast design language layered on top of a Look's colour tokens. These are layout decisions,
 * not palette swaps: the score header, rails and camera monitor each get their own architecture.
 */
export type DesignBar =
  | 'classic'
  | 'split'
  | 'podium'
  | 'ribbon'
  | 'ticker'
  | 'floating'
  | 'stacked'
  | 'rail'
  | 'scoreboard';

export type DesignCamera =
  | 'monitor'
  | 'crt'
  | 'hud'
  | 'glass'
  | 'ribbon'
  | 'portrait'
  | 'led'
  | 'carbon'
  | 'festival';

export type DesignCameraPosition =
  | 'top-right'
  | 'top-left'
  | 'bottom-right'
  | 'bottom-left'
  | 'right-rail'
  | 'left-rail';

export type DesignOrnament =
  | 'brackets'
  | 'rings'
  | 'scan'
  | 'stripes'
  | 'grid'
  | 'rays'
  | 'waves'
  | 'dots'
  | 'blade'
  | 'mesh';

export type DesignAnimation = 'sheen' | 'pulse' | 'scan' | 'orbit' | 'flicker' | 'sweep' | 'drift' | 'glow';

export interface LookDesign {
  /** Human-readable kit name for the gallery/debug tooling. */
  kit: string;
  bar: DesignBar;
  camera: DesignCamera;
  cameraPosition: DesignCameraPosition;
  ornament: DesignOrnament;
  animation: DesignAnimation;
}

/**
 * Every Pro look gets a different combination. Repeated camera skins are paired with a different
 * header geometry, ornament and motion so no two broadcast packages read as the same template.
 */
export const LOOK_DESIGNS: Readonly<Record<string, LookDesign>> = {
  'midnight-glass': { kit: 'Moonlit Glass', bar: 'floating', camera: 'glass', cameraPosition: 'top-right', ornament: 'waves', animation: 'drift' },
  sandstone: { kit: 'Terracotta Desk', bar: 'classic', camera: 'monitor', cameraPosition: 'bottom-left', ornament: 'stripes', animation: 'sweep' },
  'pitch-green': { kit: 'Ground Signal', bar: 'split', camera: 'hud', cameraPosition: 'right-rail', ornament: 'grid', animation: 'pulse' },
  'aqua-mono': { kit: 'Data Rail', bar: 'rail', camera: 'hud', cameraPosition: 'right-rail', ornament: 'dots', animation: 'scan' },
  ember: { kit: 'Burn Strip', bar: 'ribbon', camera: 'carbon', cameraPosition: 'bottom-right', ornament: 'blade', animation: 'flicker' },

  k01: { kit: 'Stadium Podium', bar: 'podium', camera: 'monitor', cameraPosition: 'top-right', ornament: 'brackets', animation: 'sheen' },
  k02: { kit: 'Emerald Float', bar: 'floating', camera: 'glass', cameraPosition: 'bottom-left', ornament: 'waves', animation: 'drift' },
  k03: { kit: 'Neon Spine', bar: 'rail', camera: 'hud', cameraPosition: 'right-rail', ornament: 'scan', animation: 'scan' },
  k04: { kit: 'Magenta Orbit', bar: 'ribbon', camera: 'festival', cameraPosition: 'right-rail', ornament: 'rings', animation: 'orbit' },
  k05: { kit: 'Lime Ticker', bar: 'ticker', camera: 'led', cameraPosition: 'bottom-right', ornament: 'grid', animation: 'flicker' },
  k08: { kit: 'Broadcast Curve', bar: 'split', camera: 'monitor', cameraPosition: 'top-right', ornament: 'brackets', animation: 'sweep' },
  k09: { kit: 'Amber Console', bar: 'ticker', camera: 'crt', cameraPosition: 'bottom-left', ornament: 'grid', animation: 'flicker' },
  k10: { kit: 'Green Matrix', bar: 'scoreboard', camera: 'crt', cameraPosition: 'bottom-right', ornament: 'dots', animation: 'scan' },
  k11: { kit: 'Street Slash', bar: 'ribbon', camera: 'ribbon', cameraPosition: 'bottom-right', ornament: 'blade', animation: 'sweep' },
  k12: { kit: 'Pink Profile', bar: 'stacked', camera: 'portrait', cameraPosition: 'bottom-left', ornament: 'rings', animation: 'pulse' },
  k13: { kit: 'Hazard Board', bar: 'scoreboard', camera: 'ribbon', cameraPosition: 'top-left', ornament: 'stripes', animation: 'sweep' },
  k14: { kit: 'Royal Crest', bar: 'podium', camera: 'portrait', cameraPosition: 'top-right', ornament: 'rays', animation: 'glow' },
  k15: { kit: 'Silver Ledger', bar: 'split', camera: 'monitor', cameraPosition: 'right-rail', ornament: 'brackets', animation: 'sheen' },
  k16: { kit: 'Sky HUD', bar: 'floating', camera: 'glass', cameraPosition: 'top-left', ornament: 'waves', animation: 'drift' },
  k17: { kit: 'Rose Window', bar: 'stacked', camera: 'portrait', cameraPosition: 'bottom-right', ornament: 'rings', animation: 'pulse' },
  k18: { kit: 'Mint Signal', bar: 'split', camera: 'glass', cameraPosition: 'bottom-left', ornament: 'waves', animation: 'glow' },
  k19: { kit: 'Carbon Cutter', bar: 'scoreboard', camera: 'carbon', cameraPosition: 'right-rail', ornament: 'blade', animation: 'flicker' },
  k20: { kit: 'Orange Turbine', bar: 'ribbon', camera: 'carbon', cameraPosition: 'bottom-right', ornament: 'grid', animation: 'scan' },
  k21: { kit: 'Gold Editorial', bar: 'rail', camera: 'hud', cameraPosition: 'right-rail', ornament: 'mesh', animation: 'sheen' },
  k22: { kit: 'Ice Wireframe', bar: 'ticker', camera: 'hud', cameraPosition: 'top-right', ornament: 'scan', animation: 'flicker' },
  k23: { kit: 'Sunset Stage', bar: 'podium', camera: 'festival', cameraPosition: 'bottom-right', ornament: 'rays', animation: 'pulse' },
  k24: { kit: 'Aurora Wave', bar: 'floating', camera: 'festival', cameraPosition: 'top-right', ornament: 'waves', animation: 'drift' },
  k25: { kit: 'Mint Grid', bar: 'stacked', camera: 'hud', cameraPosition: 'bottom-left', ornament: 'dots', animation: 'scan' },

  'sc-monsoon-night': { kit: 'Monsoon Ribbon', bar: 'ribbon', camera: 'glass', cameraPosition: 'left-rail', ornament: 'waves', animation: 'sweep' },
  'sc-desert-dusk': { kit: 'Dusk Emblem', bar: 'podium', camera: 'portrait', cameraPosition: 'bottom-right', ornament: 'rays', animation: 'glow' },
  'sc-paper-scoreboard': { kit: 'Paper Ledger', bar: 'scoreboard', camera: 'monitor', cameraPosition: 'right-rail', ornament: 'stripes', animation: 'sweep' },
  'sc-royal-maroon': { kit: 'Maroon Crest', bar: 'split', camera: 'portrait', cameraPosition: 'top-right', ornament: 'rings', animation: 'sheen' },
  'sc-arctic-mint': { kit: 'Arctic HUD', bar: 'floating', camera: 'glass', cameraPosition: 'right-rail', ornament: 'mesh', animation: 'glow' },
  'sc-volt-carbon': { kit: 'Volt Cutter', bar: 'ribbon', camera: 'carbon', cameraPosition: 'bottom-left', ornament: 'dots', animation: 'flicker' },
};

export const designForLook = (look: Look): LookDesign | null => {
  if (look.plan !== 'pro') return null;
  return LOOK_DESIGNS[look.id] ?? {
    kit: 'Pro Broadcast',
    bar: 'classic',
    camera: 'monitor',
    cameraPosition: 'bottom-right',
    ornament: 'brackets',
    animation: 'sweep',
  };
};

export const applyDesignAttrs = (root: HTMLElement, look: Look): void => {
  const design = designForLook(look);
  if (!design) {
    delete root.dataset.designKit;
    delete root.dataset.designBar;
    delete root.dataset.designCamera;
    delete root.dataset.designCameraPosition;
    delete root.dataset.designOrnament;
    delete root.dataset.designAnimation;
    return;
  }
  root.dataset.designKit = design.kit;
  root.dataset.designBar = design.bar;
  root.dataset.designCamera = design.camera;
  root.dataset.designCameraPosition = design.cameraPosition;
  root.dataset.designOrnament = design.ornament;
  root.dataset.designAnimation = design.animation;
};
