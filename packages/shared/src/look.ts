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
});
export type Look = z.infer<typeof LookSchema>;
