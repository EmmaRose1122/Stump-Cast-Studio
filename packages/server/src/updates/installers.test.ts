import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { compareVersions, findNewestInstaller, installerVersion } from './installers';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

const makeDir = (files: string[]): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-inst-'));
  dirs.push(dir);
  for (const f of files) fs.writeFileSync(path.join(dir, f), 'x');
  return dir;
};

describe('installer resolution', () => {
  it('reads the version out of a setup filename only', () => {
    expect(installerVersion('StumpCast-Studio-Setup-1.0.9.exe')).toBe('1.0.9');
    expect(installerVersion('StumpCast-Studio-Setup-1.0.9.exe.blockmap')).toBeNull();
    expect(installerVersion('latest.yml')).toBeNull();
  });

  it('compares dotted versions', () => {
    expect(compareVersions('1.0.9', '1.0.7')).toBeGreaterThan(0);
    expect(compareVersions('1.0.10', '1.0.9')).toBeGreaterThan(0);
    expect(compareVersions('1.0.9', '1.0.9')).toBe(0);
    expect(compareVersions('1.0.7', '1.1.0')).toBeLessThan(0);
  });

  it('picks the newest installer across folders, not the first one found', () => {
    const a = makeDir(['StumpCast-Studio-Setup-1.0.6.exe']);
    const b = makeDir(['StumpCast-Studio-Setup-1.0.8.exe', 'latest.yml']);
    const hit = findNewestInstaller([a, b]);
    expect(hit?.version).toBe('1.0.8');
  });

  it('never offers an installer that is not newer than the running build', () => {
    // Regression: an app on 1.0.9 downloaded and installed 1.0.7 because the old code held a fixed
    // filename list that started there.
    const withOlder = makeDir(['StumpCast-Studio-Setup-1.0.7.exe', 'StumpCast-Studio-Setup-1.0.8.exe']);
    expect(findNewestInstaller([withOlder], '1.0.9')).toBeNull();
    expect(findNewestInstaller([withOlder], '1.0.8')).toBeNull();
    expect(findNewestInstaller([withOlder], '1.0.7')?.version).toBe('1.0.8');
  });

  it('ignores folders that do not exist', () => {
    expect(findNewestInstaller([path.join(os.tmpdir(), 'no-such-sc-dir')], '1.0.0')).toBeNull();
  });
});
