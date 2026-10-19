import { useEffect } from 'react';

/** The nine quick cards bound to keys 1-9 (card ids match the overlay card registry, C3/C4). */
export const QUICK_CARDS = [
  'striker-profile',
  'bowler-spell',
  'partnership',
  'wagon-wheel',
  'match-situation',
  'full-scorecard',
  'manhattan',
  'worm',
  'win-probability',
] as const;

export type ShortcutAction =
  { type: 'card'; cardId: string } | { type: 'hide' } | { type: 'goto'; route: string };

/** True when the keystroke belongs to a text field, select or open dialog. */
export const isTypingTarget = (el: EventTarget | null): boolean => {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    el.isContentEditable ||
    el.closest('[role="dialog"], [role="listbox"], [role="combobox"], [data-keys="scoring"]') !==
      null
  );
};

/** Pure keyboard -> action mapping (1-9 quick cards, Space hide, G graphics). */
export const resolveShortcut = (
  e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'target'>,
): ShortcutAction | null => {
  if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return null;
  if (/^[1-9]$/.test(e.key)) {
    return { type: 'card', cardId: QUICK_CARDS[Number(e.key) - 1]! };
  }
  if (e.key === ' ') return { type: 'hide' };
  if (e.key.toLowerCase() === 'g') return { type: 'goto', route: '/graphics' };
  return null;
};

export const useShortcuts = (onAction: (a: ShortcutAction) => void): void => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const action = resolveShortcut(e);
      if (!action) return;
      e.preventDefault();
      onAction(action);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onAction]);
};
