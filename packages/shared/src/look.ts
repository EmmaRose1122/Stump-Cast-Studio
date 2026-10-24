import { z } from 'zod';

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const LookSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  plan: z.enum(['free', 'pro']).default('free'),
  tokens: z.object({
    colors: z.record(z.string(), hex),
    gradients: z.record(z.string(), z.string()).default({}),
    fonts: z.object({ heading: z.string(), body: z.string(), numbers: z.string() }),
    radii: z.record(z.string(), z.number().min(0)).default({}),
    shadows: z.record(z.string(), z.string()).default({}),
    scoreBarShape: z.enum([
      'flat',
      'pill',
      'glass',
      'notched',
      'slanted',
      'line',
      'mono',
      'arrow',
      'floating',
    ]),
  }),
  layoutVariant: z.object({
    scorePosition: z.enum(['top', 'bottom']),
    playerCardStyle: z.enum(['cutout', 'badge', 'badge-right', 'round-badge', 'mirrored']),
    boundaryStyle: z.string().min(1),
    middleLayout: z.enum([
      'left-stats',
      'left-stats-projected',
      'left-stats-partnership',
      'right-stats',
      'right-stats-projected',
      'right-stats-striker',
      'right-cluster-recent',
      'right-cluster-video',
      'right-cluster-partnership',
    ]).default('left-stats'),
    playerOrder: z.enum(['striker-left', 'bowler-left', 'bowler-middle']).default('striker-left'),
  }),
  motion: z.object({
    entrance: z.enum([
      'slide',
      'fade',
      'zoom',
      'flip',
      'blur',
      'curtain',
      'iris',
      'skew',
      'rise',
      'glitch',
      'blinds',
      'unfold',
      'pop',
      'drop',
      'swing',
      'zoom-out',
      'slide-right',
      'stretch',
      'diamond',
      'spin',
    ]),
    easing: z.string().default('power2.out'),
    durationMs: z.number().int().min(50).max(3000).default(500),
  }),
  /**
   * What actually differs between this look and the rest, one short phrase per axis. Optional so
   * packs written before it existed still parse. Generate these from the look's own fields
   * (`describeLook`) rather than writing them by hand: hand-written tags drifted out of sync with
   * the shapes the looks declare.
   */
  tags: z.array(z.string().min(2).max(48)).min(2).max(4).optional(),
});
export type Look = z.infer<typeof LookSchema>;

/** Human-readable label per score-bar shape, used for tags and the gallery. */
const SCORE_BAR_TAGS: Record<Look['tokens']['scoreBarShape'], string> = {
  flat: 'flat score bar',
  pill: 'pill score bar',
  glass: 'glass score bar',
  notched: 'notched score bar',
  slanted: 'slanted score bar',
  line: 'line score bar',
  mono: 'mono score bar',
  arrow: 'arrow score bar',
  floating: 'floating score cards',
};

const PLAYER_CARD_TAGS: Record<Look['layoutVariant']['playerCardStyle'], string> = {
  cutout: 'cut-out player photos',
  badge: 'framed photo badges',
  'badge-right': 'photo badges on the right',
  'round-badge': 'round photo badges',
  mirrored: 'mirrored player cards',
};

/**
 * The four tags for a look, derived from the fields the overlay really applies. A look that
 * declares `scorePosition: 'bottom'` says "scores at the bottom" and nothing else.
 */
export const describeLook = (look: Look): string[] => [
  `${look.motion.entrance} entrances`,
  look.layoutVariant.scorePosition === 'bottom'
    ? 'scores at the bottom'
    : 'scores on top',
  SCORE_BAR_TAGS[look.tokens.scoreBarShape],
  PLAYER_CARD_TAGS[look.layoutVariant.playerCardStyle],
];
