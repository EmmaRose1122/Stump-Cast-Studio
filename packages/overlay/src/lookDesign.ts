import { isProLook2, type Look } from '@stumpcast/shared';

/**
 * Broadcast design language layered on top of a Look's colour tokens. These are composition
 * decisions, not palette swaps: header silhouette, typography, crest shape, panel material,
 * camera monitor and motion are each chosen per look, and no two looks share the same
 * header + type + crest combination.
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
  | 'scoreboard'
  | 'banner'
  | 'column'
  | 'centered'
  | 'bookend'
  | 'compact'
  | 'marquee';

export type DesignType = 'grotesk' | 'editorial' | 'condensed' | 'classic' | 'tech' | 'teko';

export type DesignCrest = 'round' | 'shield' | 'banner' | 'diamond' | 'plate' | 'square';

export type DesignFrame = 'plate' | 'cut' | 'ticket' | 'outline' | 'capsule' | 'ledger';

export type DesignCamera =
  | 'monitor'
  | 'crt'
  | 'hud'
  | 'glass'
  | 'ribbon'
  | 'portrait'
  | 'led'
  | 'carbon'
  | 'festival'
  | 'viewfinder'
  | 'polaroid'
  | 'neon'
  | 'ticket';

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
  type: DesignType;
  crest: DesignCrest;
  frame: DesignFrame;
  camera: DesignCamera;
  cameraPosition: DesignCameraPosition;
  ornament: DesignOrnament;
  animation: DesignAnimation;
}

/**
 * Every Pro look gets a different combination. `bar` decides the header silhouette, `type` the
 * on-air typography, `crest` the team badge, `frame` the side-panel material, and the camera and
 * motion axes finish the package. Header + type + crest is unique per look.
 */
export const LOOK_DESIGNS: Readonly<Record<string, LookDesign>> = {
  'midnight-glass': { kit: 'Moonlit Strip', bar: 'compact', type: 'grotesk', crest: 'round', frame: 'capsule', camera: 'glass', cameraPosition: 'top-right', ornament: 'waves', animation: 'drift' },
  sandstone: { kit: 'Terracotta Desk', bar: 'classic', type: 'editorial', crest: 'banner', frame: 'plate', camera: 'monitor', cameraPosition: 'bottom-left', ornament: 'stripes', animation: 'sweep' },
  'pitch-green': { kit: 'Ground Signal', bar: 'split', type: 'condensed', crest: 'shield', frame: 'ledger', camera: 'viewfinder', cameraPosition: 'right-rail', ornament: 'grid', animation: 'pulse' },
  'aqua-mono': { kit: 'Data Column', bar: 'column', type: 'tech', crest: 'plate', frame: 'outline', camera: 'hud', cameraPosition: 'right-rail', ornament: 'dots', animation: 'scan' },
  ember: { kit: 'Burn Strip', bar: 'ribbon', type: 'teko', crest: 'plate', frame: 'cut', camera: 'carbon', cameraPosition: 'bottom-right', ornament: 'blade', animation: 'flicker' },

  k01: { kit: 'Stadium Podium', bar: 'podium', type: 'grotesk', crest: 'shield', frame: 'plate', camera: 'monitor', cameraPosition: 'top-right', ornament: 'brackets', animation: 'sheen' },
  k02: { kit: 'Emerald Float', bar: 'floating', type: 'classic', crest: 'round', frame: 'capsule', camera: 'glass', cameraPosition: 'bottom-left', ornament: 'waves', animation: 'drift' },
  k03: { kit: 'Neon Spine', bar: 'rail', type: 'tech', crest: 'plate', frame: 'outline', camera: 'neon', cameraPosition: 'right-rail', ornament: 'scan', animation: 'scan' },
  k04: { kit: 'Magenta Flag', bar: 'banner', type: 'grotesk', crest: 'banner', frame: 'cut', camera: 'festival', cameraPosition: 'right-rail', ornament: 'rings', animation: 'orbit' },
  k05: { kit: 'Lime Marquee', bar: 'marquee', type: 'condensed', crest: 'round', frame: 'ledger', camera: 'led', cameraPosition: 'bottom-right', ornament: 'grid', animation: 'flicker' },
  k08: { kit: 'Broadcast Curve', bar: 'split', type: 'grotesk', crest: 'round', frame: 'plate', camera: 'monitor', cameraPosition: 'top-right', ornament: 'brackets', animation: 'sweep' },
  k09: { kit: 'Amber Console', bar: 'ticker', type: 'tech', crest: 'square', frame: 'ledger', camera: 'crt', cameraPosition: 'bottom-left', ornament: 'grid', animation: 'flicker' },
  k10: { kit: 'Green Matrix', bar: 'scoreboard', type: 'tech', crest: 'shield', frame: 'outline', camera: 'viewfinder', cameraPosition: 'bottom-right', ornament: 'dots', animation: 'scan' },
  k11: { kit: 'Street Slash', bar: 'ribbon', type: 'condensed', crest: 'plate', frame: 'cut', camera: 'ribbon', cameraPosition: 'bottom-right', ornament: 'blade', animation: 'sweep' },
  k12: { kit: 'Pink Profile', bar: 'stacked', type: 'editorial', crest: 'round', frame: 'capsule', camera: 'polaroid', cameraPosition: 'bottom-left', ornament: 'rings', animation: 'pulse' },
  k13: { kit: 'Hazard Ledger', bar: 'bookend', type: 'condensed', crest: 'shield', frame: 'ticket', camera: 'ticket', cameraPosition: 'top-left', ornament: 'stripes', animation: 'sweep' },
  k14: { kit: 'Royal Crest', bar: 'podium', type: 'editorial', crest: 'banner', frame: 'plate', camera: 'portrait', cameraPosition: 'top-right', ornament: 'rays', animation: 'glow' },
  k15: { kit: 'Silver Centre', bar: 'centered', type: 'classic', crest: 'square', frame: 'outline', camera: 'monitor', cameraPosition: 'top-left', ornament: 'brackets', animation: 'sheen' },
  k16: { kit: 'Sky HUD', bar: 'floating', type: 'grotesk', crest: 'shield', frame: 'capsule', camera: 'glass', cameraPosition: 'top-left', ornament: 'waves', animation: 'drift' },
  k17: { kit: 'Rose Centre', bar: 'centered', type: 'editorial', crest: 'round', frame: 'plate', camera: 'polaroid', cameraPosition: 'bottom-right', ornament: 'rings', animation: 'pulse' },
  k18: { kit: 'Mint Signal', bar: 'split', type: 'classic', crest: 'banner', frame: 'cut', camera: 'glass', cameraPosition: 'bottom-left', ornament: 'waves', animation: 'glow' },
  k19: { kit: 'Carbon Cutter', bar: 'scoreboard', type: 'tech', crest: 'plate', frame: 'ticket', camera: 'carbon', cameraPosition: 'right-rail', ornament: 'blade', animation: 'flicker' },
  k20: { kit: 'Orange Turbine', bar: 'banner', type: 'teko', crest: 'plate', frame: 'ledger', camera: 'neon', cameraPosition: 'bottom-right', ornament: 'grid', animation: 'scan' },
  k21: { kit: 'Gold Column', bar: 'column', type: 'editorial', crest: 'square', frame: 'ticket', camera: 'hud', cameraPosition: 'right-rail', ornament: 'mesh', animation: 'sheen' },
  k22: { kit: 'Ice Wireframe', bar: 'ticker', type: 'classic', crest: 'shield', frame: 'outline', camera: 'viewfinder', cameraPosition: 'top-right', ornament: 'scan', animation: 'flicker' },
  k23: { kit: 'Sunset Marquee', bar: 'marquee', type: 'editorial', crest: 'round', frame: 'cut', camera: 'festival', cameraPosition: 'bottom-right', ornament: 'rays', animation: 'pulse' },
  k24: { kit: 'Aurora Float', bar: 'floating', type: 'teko', crest: 'banner', frame: 'ticket', camera: 'festival', cameraPosition: 'top-right', ornament: 'waves', animation: 'drift' },
  k25: { kit: 'Mint Column', bar: 'column', type: 'condensed', crest: 'square', frame: 'ledger', camera: 'neon', cameraPosition: 'bottom-left', ornament: 'dots', animation: 'scan' },

  'sc-monsoon-night': { kit: 'Monsoon Ribbon', bar: 'ribbon', type: 'editorial', crest: 'plate', frame: 'cut', camera: 'glass', cameraPosition: 'left-rail', ornament: 'waves', animation: 'sweep' },
  'sc-desert-dusk': { kit: 'Dusk Centre', bar: 'centered', type: 'grotesk', crest: 'banner', frame: 'plate', camera: 'portrait', cameraPosition: 'bottom-right', ornament: 'rays', animation: 'glow' },
  'sc-paper-scoreboard': { kit: 'Paper Ledger', bar: 'scoreboard', type: 'editorial', crest: 'banner', frame: 'ledger', camera: 'monitor', cameraPosition: 'right-rail', ornament: 'stripes', animation: 'sweep' },
  'sc-royal-maroon': { kit: 'Maroon Crest', bar: 'split', type: 'editorial', crest: 'shield', frame: 'plate', camera: 'portrait', cameraPosition: 'top-right', ornament: 'rings', animation: 'sheen' },
  'sc-arctic-mint': { kit: 'Arctic Bookend', bar: 'bookend', type: 'tech', crest: 'round', frame: 'outline', camera: 'polaroid', cameraPosition: 'right-rail', ornament: 'mesh', animation: 'glow' },
  'sc-volt-carbon': { kit: 'Volt Flag', bar: 'banner', type: 'condensed', crest: 'square', frame: 'cut', camera: 'carbon', cameraPosition: 'bottom-left', ornament: 'dots', animation: 'flicker' },
};

export const designForLook = (look: Look): LookDesign | null => {
  // Pro Look 2 brings its own stage, so it must not also inherit an arena kit.
  if (look.plan !== 'pro' || isProLook2(look)) return null;
  return LOOK_DESIGNS[look.id] ?? {
    kit: 'Pro Broadcast',
    bar: 'classic',
    type: 'grotesk',
    crest: 'round',
    frame: 'plate',
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
    delete root.dataset.designType;
    delete root.dataset.designCrest;
    delete root.dataset.designFrame;
    delete root.dataset.designCamera;
    delete root.dataset.designCameraPosition;
    delete root.dataset.designOrnament;
    delete root.dataset.designAnimation;
    return;
  }
  root.dataset.designKit = design.kit;
  root.dataset.designBar = design.bar;
  root.dataset.designType = design.type;
  root.dataset.designCrest = design.crest;
  root.dataset.designFrame = design.frame;
  root.dataset.designCamera = design.camera;
  root.dataset.designCameraPosition = design.cameraPosition;
  root.dataset.designOrnament = design.ornament;
  root.dataset.designAnimation = design.animation;
};
