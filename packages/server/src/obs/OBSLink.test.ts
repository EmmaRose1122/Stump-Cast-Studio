import { describe, expect, it, vi } from 'vitest';
import { OBSLink } from './OBSLink';

const fakeClient = () => {
  const handlers: Record<string, (() => void)[]> = {};
  const client = {
    connect: vi.fn(async () => ({})),
    disconnect: vi.fn(async () => undefined),
    call: vi.fn(async (requestType: string, data?: Record<string, unknown>) => {
      if (requestType === 'GetSceneList') {
        return { scenes: [{ sceneName: 'Live' }, { sceneName: 'Break' }], currentProgramSceneName: 'Live' };
      }
      if (requestType === 'GetInputList') {
        return { inputs: [{ inputName: 'Match', inputKind: 'browser_source' }] };
      }
      if (requestType === 'GetVideoSettings') return { baseWidth: 1920, baseHeight: 1080 };
      if (requestType === 'GetSceneItemId') {
        if (data?.sourceName === 'Missing') throw new Error('Source not found');
        return { sceneItemId: data?.sourceName === 'Match' ? 1 : 2 };
      }
      return {};
    }),
    on: vi.fn((event: string, cb: () => void) => {
      (handlers[event] ??= []).push(cb);
    }),
    emit: (event: string) => handlers[event]?.forEach((cb) => cb()),
  };
  return client;
};

type FakeClient = ReturnType<typeof fakeClient>;

const fakeTimers = () => {
  const pending: { at: number; fn: () => void; id: number }[] = [];
  let clock = 0;
  let nextId = 1;
  return {
    timers: {
      setTimeout: (fn: () => void, ms: number) => {
        const id = nextId++;
        pending.push({ at: clock + ms, fn, id });
        return id;
      },
      clearTimeout: (id: unknown) => {
        const i = pending.findIndex((p) => p.id === id);
        if (i >= 0) pending.splice(i, 1);
      },
    },
    advance: (ms: number) => {
      clock += ms;
      for (const due of pending.filter((p) => p.at <= clock)) {
        pending.splice(pending.indexOf(due), 1);
        due.fn();
      }
    },
    pending: () => pending.length,
  };
};

describe('OBSLink', () => {
  it('connects, lists scenes and sources, then disconnects', async () => {
    const client = fakeClient();
    const obs = new OBSLink(() => client);
    await obs.connect('127.0.0.1', 4455, 'secret');

    expect(client.connect).toHaveBeenCalledWith('ws://127.0.0.1:4455', 'secret', { rpcVersion: 1 });
    expect(obs.status).toMatchObject({ connected: true, host: '127.0.0.1', port: 4455 });
    expect(await obs.listScenes()).toEqual({ scenes: ['Live', 'Break'], current: 'Live' });
    expect(await obs.listSources()).toEqual([{ name: 'Match', kind: 'browser_source' }]);
    await obs.disconnect();
    expect(client.disconnect).toHaveBeenCalledOnce();
    expect(obs.status.connected).toBe(false);
  });

  it('maps fractional layout rectangles to the OBS canvas', async () => {
    const client = fakeClient();
    const obs = new OBSLink(() => client);
    await obs.connect('localhost', 4455);
    const result = await obs.applyLayout('C', { matchVideo: 'Match', cam1: 'Camera' }, 'Live');

    expect(result).toMatchObject({ applied: ['matchVideo', 'cam1'], missing: [], canvas: { width: 1920, height: 1080 } });
    const transforms = client.call.mock.calls
      .filter(([requestType]) => requestType === 'SetSceneItemTransform')
      .map(([, data]) => data?.sceneItemTransform);
    expect(transforms[0]).toMatchObject({ positionX: 77, positionY: 173, boundsWidth: 1190, boundsHeight: 734 });
    expect(transforms[1]).toMatchObject({ positionX: 1344, positionY: 605, boundsWidth: 499, boundsHeight: 302 });
  });

  it('reports unmapped OBS sources instead of failing the whole layout', async () => {
    const client = fakeClient();
    const obs = new OBSLink(() => client);
    await obs.connect('localhost', 4455);
    const result = await obs.applyLayout('A', { matchVideo: 'Missing', cam1: 'Camera' }, 'Live');
    expect(result.applied).toEqual(['cam1']);
    expect(result.missing).toEqual(['matchVideo']);
  });

  it('rejects malformed host input before opening a socket', async () => {
    const client = fakeClient();
    const obs = new OBSLink(() => client);
    await expect(obs.connect('localhost/path', 4455)).rejects.toThrow('valid OBS host');
    expect(client.connect).not.toHaveBeenCalled();
  });

  it('reports a dropped OBS session as disconnected and reconnects on its own', async () => {
    const made: FakeClient[] = [];
    const t = fakeTimers();
    const obs = new OBSLink(() => {
      const c = fakeClient();
      made.push(c);
      return c;
    }, t.timers);

    await obs.connect('127.0.0.1', 4455, 'secret');
    expect(obs.connected).toBe(true);

    made[0]!.emit('SessionLost');
    expect(obs.connected).toBe(false);
    expect(obs.status).toMatchObject({ host: '127.0.0.1', port: 4455 });
    expect(obs.status.error).toMatch(/lost/i);

    t.advance(2000);
    await new Promise((r) => setTimeout(r, 0));
    expect(made).toHaveLength(2);
    expect(obs.connected).toBe(true);
    expect(obs.status.error).toBeNull();
    expect(made[1]!.connect).toHaveBeenCalledWith('ws://127.0.0.1:4455', 'secret', { rpcVersion: 1 });
  });

  it('gives up reconnecting when the operator disconnects', async () => {
    const made: FakeClient[] = [];
    const t = fakeTimers();
    const obs = new OBSLink(() => {
      const c = fakeClient();
      made.push(c);
      return c;
    }, t.timers);
    await obs.connect('127.0.0.1', 4455);

    made[0]!.emit('SessionLost');
    expect(t.pending()).toBe(1);
    await obs.disconnect();
    expect(t.pending()).toBe(0);
    t.advance(60_000);
    expect(made).toHaveLength(1);
  });

  it('stops the rotation clock when the link goes away', async () => {
    vi.useFakeTimers();
    try {
      const client = fakeClient();
      const obs = new OBSLink(() => client);
      await obs.connect('localhost', 4455);
      obs.setRotation({
        enabled: true,
        intervalSec: 1,
        layouts: ['A', 'B'],
        map: { matchVideo: 'Match' },
        sceneName: 'Live',
      });

      await vi.advanceTimersByTimeAsync(2500);
      expect(client.call).toHaveBeenCalled();

      await obs.disconnect();
      client.call.mockClear();
      await vi.advanceTimersByTimeAsync(6000);
      // The clock used to survive the disconnect and spin rejected calls until the process exited.
      expect(client.call).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('picks the rotation back up after a reconnect', async () => {
    vi.useFakeTimers();
    try {
      const t = fakeTimers();
      const made: FakeClient[] = [];
      const obs = new OBSLink(() => {
        const c = fakeClient();
        made.push(c);
        return c;
      }, t.timers);
      await obs.connect('localhost', 4455);
      obs.setRotation({
        enabled: true,
        intervalSec: 1,
        layouts: ['A', 'B'],
        map: { matchVideo: 'Match' },
        sceneName: 'Live',
      });

      made[0]!.emit('SessionLost');
      t.advance(2000);
      await vi.advanceTimersByTimeAsync(1500);
      expect(obs.connected).toBe(true);
      expect(made[1]!.call).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});