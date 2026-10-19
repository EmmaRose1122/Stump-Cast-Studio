export const STAGE_WIDTH = 1920;
export const STAGE_HEIGHT = 1080;

export interface StageTransform {
  scale: number;
  x: number;
  y: number;
}

/** Fit the fixed 1920x1080 canvas inside a viewport, centred, preserving aspect ratio. */
export const fitStage = (viewW: number, viewH: number): StageTransform => {
  if (viewW <= 0 || viewH <= 0) return { scale: 1, x: 0, y: 0 };
  const scale = Math.min(viewW / STAGE_WIDTH, viewH / STAGE_HEIGHT);
  return {
    scale,
    x: (viewW - STAGE_WIDTH * scale) / 2,
    y: (viewH - STAGE_HEIGHT * scale) / 2,
  };
};

/** Size the stage element and keep it fitted to the window. Returns a disposer. */
export const mountStage = (el: HTMLElement, win: Window = window): (() => void) => {
  el.style.width = `${STAGE_WIDTH}px`;
  el.style.height = `${STAGE_HEIGHT}px`;
  el.style.transformOrigin = '0 0';
  el.style.position = 'absolute';
  el.style.left = '0';
  el.style.top = '0';
  const apply = () => {
    const t = fitStage(win.innerWidth, win.innerHeight);
    el.style.transform = `translate(${t.x}px, ${t.y}px) scale(${t.scale})`;
  };
  apply();
  win.addEventListener('resize', apply);
  return () => win.removeEventListener('resize', apply);
};
