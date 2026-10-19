import { describe, expect, it } from 'vitest';
import { DEFAULT_DIRECTOR_RULES } from '@stumpcast/shared';
import {
  ALL_CARDS,
  CARD_GROUPS,
  DURATIONS,
  RULE_EVENTS,
  toggleCarouselCard,
  validateRule,
} from './lib/graphics';
import { QUICK_CARDS } from './lib/shortcuts';

describe('card catalogue', () => {
  it('has unique ids across groups', () => {
    expect(new Set(ALL_CARDS.map((c) => c.id)).size).toBe(ALL_CARDS.length);
    expect(CARD_GROUPS.map((g) => g.title)).toEqual([
      'Players',
      'Match flow',
      'Analytics',
      'Presentation',
    ]);
  });

  it('covers every card the director defaults and quick keys can show', () => {
    const ids = new Set(ALL_CARDS.map((c) => c.id));
    for (const r of DEFAULT_DIRECTOR_RULES) expect(ids.has(r.card)).toBe(true);
    for (const id of QUICK_CARDS) expect(ids.has(id)).toBe(true);
  });

  it('offers a sticky duration', () => {
    expect(DURATIONS.map((d) => d.value)).toContain('0');
  });

  it('every default rule trigger is selectable in the editor', () => {
    const events = new Set(RULE_EVENTS.map((e) => e.value));
    for (const r of DEFAULT_DIRECTOR_RULES) expect(events.has(r.on)).toBe(true);
  });
});

describe('validateRule', () => {
  const ok = { on: 'OVER_END', card: 'manhattan', durationSec: 8, cooldownSec: 30, priority: 1 };
  it('accepts a sensible rule', () => {
    expect(validateRule(ok)).toBeNull();
  });
  it('rejects bad durations and cooldowns', () => {
    expect(validateRule({ ...ok, durationSec: 0 })).toMatch(/Duration/);
    expect(validateRule({ ...ok, durationSec: 61 })).toMatch(/Duration/);
    expect(validateRule({ ...ok, cooldownSec: -1 })).toMatch(/Cooldown/);
    expect(validateRule({ ...ok, cooldownSec: Number.NaN })).toMatch(/Cooldown/);
    expect(validateRule({ ...ok, card: '' })).toMatch(/card/);
  });
});

describe('toggleCarouselCard', () => {
  it('adds and removes cards', () => {
    expect(toggleCarouselCard(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleCarouselCard(['a', 'b'], 'a')).toEqual(['b']);
  });
  it('never empties the carousel', () => {
    expect(toggleCarouselCard(['a'], 'a')).toEqual(['a']);
  });
});
