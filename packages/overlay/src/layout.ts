import type { LayoutPresetId, Settings } from '@stumpcast/shared';

export type LayoutName = Settings['layout'];

export interface Zones {
  main: HTMLElement;
  left: HTMLElement;
  right: HTMLElement;
  bottom: HTMLElement;
  top: HTMLElement;
  /** Broadcast cards (striker profile, manhattan, ...). */
  card: HTMLElement;
}

/**
 * Components are laid out once into five zones. A layout is just a `data-layout` value on the
 * stage: CSS decides which zones show, where they sit and how big they are. Switching layouts
 * therefore never rebuilds or re-fetches anything.
 */
export const createZones = (stage: HTMLElement): Zones => {
  const make = (name: string) => {
    const el = document.createElement('div');
    el.className = `zone zone-${name}`;
    stage.appendChild(el);
    return el;
  };
  return {
    main: make('main'),
    left: make('left'),
    right: make('right'),
    bottom: make('bottom'),
    top: make('top'),
    card: make('card'),
  };
};

export const applyLayout = (
  stage: HTMLElement,
  layout: LayoutName,
  cardScale = 1,
  cardWidth: Settings['cardWidth'] = 'normal',
  sideCardScale = 1,
): void => {
  stage.dataset.layout = layout;
  stage.dataset.cardWidth = cardWidth;
  stage.style.setProperty('--card-scale', String(cardScale));
  stage.style.setProperty('--side-scale', String(sideCardScale));
};

export const applyComposition = (stage: HTMLElement, layoutId: LayoutPresetId): void => {
  stage.dataset.composition = layoutId;
};

export const applyBackground = (
  stage: HTMLElement,
  backgroundImage: string | null,
  dim: number,
): void => {
  const safeDim = typeof dim === 'number' && !isNaN(dim) ? dim : 0.3;
  if (!backgroundImage || backgroundImage === 'transparent') {
    stage.style.backgroundImage = 'none';
    stage.dataset.backdrop = 'transparent';
    stage.style.setProperty('--stadium-bg', 'none');
    stage.style.setProperty('--stadium-dim', '0');
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.dataset.backdrop = 'transparent';
    }
    return;
  }
  let safePath = backgroundImage;
  if (!safePath.startsWith('http://') && !safePath.startsWith('https://') && !safePath.startsWith('/') && !safePath.startsWith('data:')) {
    if (safePath === 'floodlight' || safePath === 'floodlight-stadium.jpg') {
      safePath = '/assets/backgrounds/floodlight.jpg';
    } else if (safePath === 'sunset') {
      safePath = '/assets/backgrounds/sunset.jpg';
    } else if (safePath === 'day-champions') {
      safePath = '/assets/backgrounds/day-champions.jpg';
    } else if (safePath === 'virtual-3d') {
      safePath = '/assets/backgrounds/virtual-3d.jpg';
    } else {
      safePath = `/assets/${safePath}`;
    }
  }
  const bgType = safePath.includes('sunset')
    ? 'sunset'
    : safePath.includes('day')
      ? 'day-champions'
      : safePath.includes('virtual')
        ? 'virtual-3d'
        : safePath.includes('floodlight')
          ? 'floodlight'
          : 'custom';
  stage.dataset.backdrop = bgType;
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.dataset.backdrop = bgType;
  }
  stage.style.setProperty('--stadium-bg', `url("${safePath}")`);
  stage.style.setProperty('--stadium-dim', String(safeDim));
  stage.style.backgroundImage = `linear-gradient(rgba(0, 0, 0, ${safeDim}), rgba(0, 0, 0, ${safeDim})), url("${safePath}")`;
  stage.style.backgroundPosition = 'center';
  stage.style.backgroundSize = 'cover';
  stage.style.backgroundRepeat = 'no-repeat';
};

export const applyTvTheme = (stage: HTMLElement, tvTheme = 'star-sports'): void => {
  stage.dataset.tvTheme = tvTheme;
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.dataset.tvTheme = tvTheme;
  }
};

export const applyOnAirScreen = (
  stage: HTMLElement,
  screen: Settings['onAirScreen'] = 'auto',
): void => {
  stage.dataset.onAirScreen = screen;
  document.documentElement.dataset.onAirScreen = screen;
};

export const LAYOUTS: readonly LayoutName[] = ['arena', 'fullscreen', 'ticker', 'classic'];
