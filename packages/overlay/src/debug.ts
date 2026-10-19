import { LayoutPresetIdSchema, type LayoutPresetId } from '@stumpcast/shared';
import type { OverlayStore } from './store';

export interface OverlayParams {
  debug: boolean;
  fixture: 'T20' | 'TEST' | 'RESULT' | null;
  match: string | null;
  /** Demo overrides, useful for design review and screenshots. */
  look: string | null;
  layout: 'arena' | 'fullscreen' | 'ticker' | 'classic' | null;
  composition: LayoutPresetId | null;
  event: 'FOUR' | 'SIX' | 'WICKET' | null;
  /** Operator preview: undelayed feed (used by the admin's mini preview). */
  preview: boolean;
  /** Design QA page: every card against the fixtures. */
  gallery: boolean;
  resolution?: boolean;
}

export const parseParams = (search: string): OverlayParams => {
  const p = new URLSearchParams(search);
  const fx = (p.get('fixture') ?? '').toLowerCase();
  const fixture = fx === 't20' ? 'T20' : fx === 'test' ? 'TEST' : fx === 'result' ? 'RESULT' : null;
  const dbg = p.get('debug');
  const layout = (p.get('layout') ?? '').toLowerCase();
  const composition = LayoutPresetIdSchema.safeParse(p.get('composition'));
  const ev = (p.get('event') ?? '').toUpperCase();
  const res: OverlayParams = {
    debug: dbg === '1' || dbg === 'true',
    fixture,
    match: p.get('match') || null,
    look: p.get('look') || null,
    layout: ['arena', 'fullscreen', 'ticker', 'classic'].includes(layout)
      ? (layout as OverlayParams['layout'])
      : null,
    composition: composition.success ? composition.data : null,
    preview: p.get('preview') === '1',
    gallery: p.get('gallery') === '1',
    event: ['FOUR', 'SIX', 'WICKET'].includes(ev) ? (ev as OverlayParams['event']) : null,
  };
  if (p.has('resolution')) {
    res.resolution = p.get('resolution') === '1' || p.get('resolution') === 'true';
  }
  return res;
};

/** Debug HUD: outlines on every component, FPS and connection state. Returns a disposer. */
export const mountDebug = (store: OverlayStore, doc: Document = document): (() => void) => {
  doc.documentElement.dataset.debug = '1';
  const hud = doc.createElement('div');
  hud.className = 'debug-hud';
  doc.body.appendChild(hud);

  let frames = 0;
  let last = performance.now();
  let fps = 0;
  let raf = 0;
  const tick = (t: number) => {
    frames++;
    if (t - last >= 1000) {
      fps = Math.round((frames * 1000) / (t - last));
      frames = 0;
      last = t;
      render();
    }
    raf = requestAnimationFrame(tick);
  };
  const render = () => {
    const s = store.get();
    hud.textContent =
      `${fps} fps · ${s.connection} · match ${s.matchId ?? 'none'} · look ${s.look.id}` +
      ` · layout ${s.settings.layout}` +
      (s.active ? ` · card ${s.active.cardId}` : '');
  };
  const off = store.subscribe(render);
  render();
  raf = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(raf);
    off();
    hud.remove();
    delete doc.documentElement.dataset.debug;
  };
};
