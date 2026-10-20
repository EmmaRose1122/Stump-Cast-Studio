import Fastify from 'fastify';
import { createSettings } from '@stumpcast/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OBSLink } from './OBSLink';
import { registerObsRoutes } from './routes';

const makeApp = (connected = false) => {
  let settings = createSettings();
  const obs = {
    status: { connected, host: connected ? '127.0.0.1' : null, port: connected ? 4455 : null, connectedAt: connected ? 10 : null, error: null },
    connect: vi.fn(async (host: string, port: number) => ({ connected: true, host, port, connectedAt: 10, error: null })),
    disconnect: vi.fn(async () => ({ connected: false, host: null, port: null, connectedAt: null, error: null })),
    listScenes: vi.fn(async () => {
      if (!connected) throw new Error('Connect to OBS first');
      return { scenes: ['Live', 'Break'], current: 'Live' };
    }),
    listSources: vi.fn(async () => {
      if (!connected) throw new Error('Connect to OBS first');
      return [{ name: 'Match', kind: 'browser_source' }];
    }),
    setScene: vi.fn(async () => undefined),
    applyLayout: vi.fn(async () => {
      if (!connected) throw new Error('Connect to OBS first');
      return { applied: ['matchVideo'], missing: [], canvas: { width: 1920, height: 1080 } };
    }),
  };
  const app = Fastify();
  registerObsRoutes(app, {
    obs: obs as unknown as OBSLink,
    getSettings: () => settings,
    saveSettings: (next) => {
      settings = next;
    },
  });
  return { app, obs, getSettings: () => settings, setSettings: (next: typeof settings) => { settings = next; } };
};

afterEach(async () => {
  vi.restoreAllMocks();
});

describe('OBS routes', () => {
  it('reports connection status and available shared layouts', async () => {
    const { app } = makeApp(true);
    const status = await app.inject({ method: 'GET', url: '/api/obs/status' });
    const layouts = await app.inject({ method: 'GET', url: '/api/obs/layouts' });
    expect(status.json()).toMatchObject({ connected: true, host: '127.0.0.1' });
    expect(layouts.json()).toHaveLength(10);
    await app.close();
  });

  it('validates and persists source role mappings', async () => {
    const { app, getSettings } = makeApp();
    const invalid = await app.inject({ method: 'PUT', url: '/api/obs/map', payload: { matchVideo: 'x'.repeat(300), cam1: '', cam2: '' } });
    expect(invalid.statusCode).toBe(400);
    const saved = await app.inject({ method: 'PUT', url: '/api/obs/map', payload: { matchVideo: 'Match feed', cam1: 'Camera 1', cam2: '' } });
    expect(saved.statusCode).toBe(200);
    expect(getSettings().video.obsMap).toEqual({ matchVideo: 'Match feed', cam1: 'Camera 1', cam2: '' });
    await app.close();
  });

  it('lists scenes and inputs only when connected', async () => {
    const { app, obs } = makeApp(true);
    expect((await app.inject({ method: 'GET', url: '/api/obs/scenes' })).json()).toEqual({ scenes: ['Live', 'Break'], current: 'Live' });
    expect((await app.inject({ method: 'GET', url: '/api/obs/sources' })).json()).toEqual([{ name: 'Match', kind: 'browser_source' }]);
    expect(obs.listScenes).toHaveBeenCalledOnce();
    await app.close();
  });

  it('returns useful unavailable responses while disconnected', async () => {
    const { app } = makeApp();
    expect((await app.inject({ method: 'GET', url: '/api/obs/scenes' })).statusCode).toBe(409);
    expect((await app.inject({ method: 'POST', url: '/api/obs/layout', payload: { layoutId: 'X' } })).statusCode).toBe(400);
    await app.close();
  });

  it('keeps settings changed while a layout is being applied', async () => {
    const { app, obs, getSettings, setSettings } = makeApp(true);
    // A settings save lands during the in-flight OBS call. The route used to write back the
    // snapshot it took beforehand, silently reverting whatever the operator changed.
    obs.applyLayout.mockImplementation(async () => {
      setSettings({ ...getSettings(), syncDelaySec: 5 });
      return { applied: ['matchVideo'], missing: [], canvas: { width: 1920, height: 1080 } };
    });

    const res = await app.inject({ method: 'POST', url: '/api/obs/layout', payload: { layoutId: 'C' } });

    expect(res.statusCode).toBe(200);
    expect(getSettings().syncDelaySec).toBe(5);
    expect(getSettings().video.activeObsLayout).toBe('C');
    await app.close();
  });
});
