import { describe, expect, it, vi } from 'vitest';
import { CHECK_INTERVAL_MS, releaseNotesText, setupAutoUpdate, type UpdaterLike } from './updater';

const fake = () => {
  const handlers: Record<string, (arg: never) => void> = {};
  const updater = {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    on: vi.fn((event: string, cb: (arg: never) => void) => {
      handlers[event] = cb;
    }),
    checkForUpdates: vi.fn(async () => undefined),
    quitAndInstall: vi.fn(),
  };
  return { updater: updater as unknown as UpdaterLike & typeof updater, handlers };
};
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('auto update', () => {
  it('checks at startup and on an interval, downloads automatically', () => {
    const { updater } = fake();
    const setIntervalSpy = vi.fn();
    setupAutoUpdate(updater, { confirmInstall: async () => false, log: () => {} }, { setInterval: setIntervalSpy });
    expect(updater.autoDownload).toBe(true);
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), CHECK_INTERVAL_MS);
  });

  it('restarts only when the operator agrees', async () => {
    const yes = fake();
    setupAutoUpdate(yes.updater, { confirmInstall: async () => true, log: () => {} }, { setInterval: () => 0 });
    yes.handlers['update-downloaded']?.({ version: '1.2.0' } as never);
    await flush();
    expect(yes.updater.quitAndInstall).toHaveBeenCalled();

    const no = fake();
    setupAutoUpdate(no.updater, { confirmInstall: async () => false, log: () => {} }, { setInterval: () => 0 });
    no.handlers['update-downloaded']?.({ version: '1.2.0' } as never);
    await flush();
    expect(no.updater.quitAndInstall).not.toHaveBeenCalled();
  });

  it('survives a failing check and logs it', async () => {
    const { updater } = fake();
    updater.checkForUpdates.mockRejectedValueOnce(new Error('offline'));
    const log = vi.fn();
    setupAutoUpdate(updater, { confirmInstall: async () => false, log }, { setInterval: () => 0 });
    await flush();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('offline'));
  });

  it('strips html from release notes', () => {
    expect(releaseNotesText('<p>Fixes <b>bugs</b></p>')).toBe('Fixes bugs');
    expect(releaseNotesText([{ note: 'a' }, { note: 'b' }])).toBe('a\nb');
    expect(releaseNotesText(null)).toBe('');
  });

  it('correctly compares version numbers', async () => {
    const { isVersionNewer } = await import('./updater');
    expect(isVersionNewer('1.0.2', '1.0.1')).toBe(true);
    expect(isVersionNewer('1.1.0', '1.0.9')).toBe(true);
    expect(isVersionNewer('2.0.0', '1.9.9')).toBe(true);
    expect(isVersionNewer('v1.0.2', 'v1.0.1')).toBe(true);
    expect(isVersionNewer('1.0.1', '1.0.1')).toBe(false);
    expect(isVersionNewer('1.0.0', '1.0.1')).toBe(false);
  });

  it('launches installer and exits correctly', async () => {
    const { launchInstallerAndExit } = await import('./updater');
    const spawnMock = vi.fn(() => ({ unref: vi.fn() }));
    const exitMock = vi.fn();
    const result = launchInstallerAndExit('test-setup.exe', spawnMock, exitMock);
    expect(result).toBe(true);
    expect(spawnMock).toHaveBeenCalledWith('test-setup.exe', [], { detached: true, stdio: 'ignore' });
    expect(exitMock).toHaveBeenCalled();
  });
});

