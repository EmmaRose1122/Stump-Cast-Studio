import type { Look } from '@stumpcast/shared';

export type Entrance = Look['motion']['entrance'];

/** GSAP "from" vars for each entrance style; the exit mirrors them. */
export const entranceVars = (entrance: Entrance): Record<string, unknown> => {
  switch (entrance) {
    case 'slide':
      return { x: -80, opacity: 0 };
    case 'slide-right':
      return { x: 80, opacity: 0 };
    case 'zoom':
      return { scale: 0.85, opacity: 0 };
    case 'zoom-out':
      return { scale: 1.35, opacity: 0 };
    case 'flip':
      return { rotationX: -90, opacity: 0, transformPerspective: 800 };
    case 'blur':
      return { filter: 'blur(12px)', opacity: 0 };
    case 'curtain':
      return { clipPath: 'inset(0 100% 0 0)' };
    case 'iris':
      return { clipPath: 'circle(0% at 50% 50%)' };
    case 'diamond':
      return { clipPath: 'polygon(50% 50%, 50% 50%, 50% 50%, 50% 50%)' };
    case 'blinds':
      return { clipPath: 'inset(0 0 100% 0)', opacity: 0.2 };
    case 'skew':
      return { skewX: -20, x: -60, opacity: 0 };
    case 'rise':
      return { y: 70, opacity: 0 };
    case 'drop':
      return { y: -70, opacity: 0 };
    case 'pop':
      return { scale: 0.35, opacity: 0 };
    case 'unfold':
      return { rotationY: -90, opacity: 0, transformPerspective: 900 };
    case 'swing':
      return { rotation: -25, transformOrigin: 'top left', opacity: 0 };
    case 'stretch':
      return { scaleX: 0.1, opacity: 0 };
    case 'spin':
      return { rotation: -180, scale: 0.6, opacity: 0 };
    case 'glitch':
      return { opacity: 0, x: 24, skewX: 20, filter: 'hue-rotate(90deg)' };
    case 'fade':
    default:
      return { opacity: 0, y: 12 };
  }
};
