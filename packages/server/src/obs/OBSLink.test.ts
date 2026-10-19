import { describe, expect, it, vi } from 'vitest';
import { OBSLink } from './OBSLink';

const fakeClient = () => {
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
  };
  return client;
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
});