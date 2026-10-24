import type { Look } from '@stumpcast/shared';

/** CSS custom-property name for a token: `colors.accent2` -> `--color-accent2`. */
const cssName = (group: string, key: string) => `--${group}-${key.replace(/[^a-zA-Z0-9]+/g, '-')}`;

/** Flatten a Look's tokens into CSS variables (components only read these). */
export const lookToCssVars = (look: Look): Record<string, string> => {
  const t = look.tokens;
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(t.colors)) vars[cssName('color', k)] = v;
  for (const [k, v] of Object.entries(t.gradients)) vars[cssName('gradient', k)] = v;
  for (const [k, v] of Object.entries(t.radii)) vars[cssName('radius', k)] = `${v}px`;
  for (const [k, v] of Object.entries(t.shadows)) vars[cssName('shadow', k)] = v;
  vars['--font-heading'] = `'${t.fonts.heading}', sans-serif`;
  vars['--font-body'] = `'${t.fonts.body}', sans-serif`;
  vars['--font-numbers'] = `'${t.fonts.numbers}', 'Arial Narrow', sans-serif`;
  vars['--motion-duration'] = `${look.motion.durationMs}ms`;
  return vars;
};

/**
 * Apply a Look: CSS variables on the root plus a `data-look` attribute (and the layout variants as
 * data attributes) so styling can switch without code changes.
 */
export const applyLook = (look: Look, root: HTMLElement = document.documentElement): void => {
  for (const [k, v] of Object.entries(lookToCssVars(look))) root.style.setProperty(k, v);
  root.dataset.look = look.id;
  root.dataset.scorePosition = look.layoutVariant.scorePosition;
  root.dataset.playerCard = look.layoutVariant.playerCardStyle;
  root.dataset.middleLayout = look.layoutVariant.middleLayout;
  root.dataset.playerOrder = look.layoutVariant.playerOrder;
  root.dataset.scoreBar = look.tokens.scoreBarShape;
  root.dataset.boundary = look.layoutVariant.boundaryStyle;
  root.dataset.entrance = look.motion.entrance;
};
