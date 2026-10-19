import type { DirectorRule } from '@stumpcast/shared';

export interface CardInfo {
  id: string;
  label: string;
}

export const CARD_GROUPS: { title: string; cards: CardInfo[] }[] = [
  {
    title: 'Players',
    cards: [
      { id: 'striker-profile', label: 'Striker profile' },
      { id: 'bowler-spell', label: 'Bowler spell' },
      { id: 'striker-vs-bowler', label: 'Striker v bowler' },
      { id: 'wagon-wheel', label: 'Wagon wheel' },
    ],
  },
  {
    title: 'Match flow',
    cards: [
      { id: 'partnership', label: 'Partnership' },
      { id: 'chase-gauge', label: 'Chase gauge' },
      { id: 'match-situation', label: 'Match situation' },
      { id: 'powerplay', label: 'Powerplay' },
    ],
  },
  {
    title: 'Analytics',
    cards: [
      { id: 'manhattan', label: 'Manhattan' },
      { id: 'worm', label: 'Worm' },
      { id: 'win-probability', label: 'Win probability' },
      { id: 'fall-of-wickets', label: 'Fall of wickets' },
    ],
  },
  {
    title: 'Presentation',
    cards: [
      { id: 'full-scorecard', label: 'Scorecard' },
      { id: 'toss', label: 'Toss' },
      { id: 'milestone', label: 'Milestone' },
      { id: 'post-match', label: 'Post-match' },
    ],
  },
];

export const ALL_CARDS: CardInfo[] = CARD_GROUPS.flatMap((g) => g.cards);

/** Display durations offered to the operator. 0 is sticky until hidden. */
export const DURATIONS: { value: string; label: string }[] = [
  { value: '3', label: '3 s' },
  { value: '5', label: '5 s' },
  { value: '8', label: '8 s' },
  { value: '15', label: '15 s' },
  { value: '0', label: 'Sticky' },
];

export const RULE_EVENTS: { value: string; label: string }[] = [
  { value: 'OVER_END', label: 'End of over' },
  { value: 'WICKET', label: 'Wicket' },
  { value: 'FOUR', label: 'Four' },
  { value: 'SIX', label: 'Six' },
  { value: 'FIFTY', label: 'Fifty' },
  { value: 'HUNDRED', label: 'Hundred' },
  { value: 'NEW_BATTER', label: 'New batter' },
  { value: 'MILESTONE', label: 'Milestone' },
  { value: 'INNINGS_END', label: 'End of innings' },
  { value: 'SESSION_END', label: 'End of session' },
  { value: 'DAY_END', label: 'End of day' },
  { value: 'BATTER_40', label: 'Batter reaches 40' },
  { value: 'BATTER_90', label: 'Batter reaches 90' },
];

export const MODES: { value: 'smart' | 'carousel' | 'manual'; label: string; hint: string }[] = [
  { value: 'smart', label: 'Smart', hint: 'Shows the right card at the right moment.' },
  { value: 'carousel', label: 'Carousel', hint: 'Cycles your chosen cards on a timer.' },
  { value: 'manual', label: 'Manual', hint: 'Nothing happens unless you press a button.' },
];

export const LAYOUTS: { value: 'classic' | 'arena' | 'fullscreen' | 'ticker'; label: string }[] = [
  { value: 'classic', label: 'Classic' },
  { value: 'arena', label: 'Arena + video' },
  { value: 'fullscreen', label: 'Full screen' },
  { value: 'ticker', label: 'Ticker strip' },
];

export const WIDTHS: { value: 'narrow' | 'normal' | 'wide'; label: string }[] = [
  { value: 'narrow', label: 'Narrow' },
  { value: 'normal', label: 'Normal' },
  { value: 'wide', label: 'Wide' },
];

/** Returns an error message for a rule that should not be saved, or null when it is fine. */
export const validateRule = (r: DirectorRule): string | null => {
  if (!r.card) return 'Choose a card';
  if (!Number.isFinite(r.durationSec) || r.durationSec < 1 || r.durationSec > 60) {
    return 'Duration must be 1-60 seconds';
  }
  if (!Number.isFinite(r.cooldownSec) || r.cooldownSec < 0 || r.cooldownSec > 600) {
    return 'Cooldown must be 0-600 seconds';
  }
  return null;
};

/** Toggle a card in the carousel list, keeping order and at least one card. */
export const toggleCarouselCard = (cards: string[], id: string): string[] => {
  if (cards.includes(id)) return cards.length > 1 ? cards.filter((c) => c !== id) : cards;
  return [...cards, id];
};
