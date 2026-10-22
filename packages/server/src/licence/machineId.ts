import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

let cachedMachineId: string | null = null;

export const normalizeMachineId = (id: string | null | undefined): string =>
  String(id ?? '')
    .trim()
    .toUpperCase()
    .replace(/^SC-?/, '')
    .replace(/[^A-Z0-9]/g, '');

export const formatMachineId = (id: string): string => {
  const clean = String(id ?? '').trim().toUpperCase();
  if (clean.startsWith('SC-')) return clean;
  // If already standard GUID format with dashes, e.g. E3ABA4F4-48BB-4C9A-8A55-66C804D6C2B6
  if (/^[A-Z0-9]{8}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{12}$/.test(clean)) {
    return `SC-${clean}`;
  }
  const norm = normalizeMachineId(clean);
  if (norm.length >= 16) {
    // Format into 4-char groups
    const parts = norm.match(/.{1,4}/g) ?? [norm];
    return `SC-${parts.join('-')}`;
  }
  return `SC-${clean}`;
};

const getPersistPath = (): string => {
  const dataDir = path.resolve(process.cwd(), 'data');
  return path.join(dataDir, 'machine-id.txt');
};

const readPersisted = (): string | null => {
  try {
    const file = getPersistPath();
    if (fs.existsSync(file)) {
      const val = fs.readFileSync(file, 'utf8').trim();
      if (val.length >= 4) return val;
    }
  } catch {
    // ignore
  }
  return null;
};

const writePersisted = (id: string): void => {
  try {
    const file = getPersistPath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${id}\n`, 'utf8');
  } catch {
    // ignore
  }
};

const queryWindowsMachineGuid = (): string | null => {
  if (process.platform !== 'win32') return null;

  // 1. Try reg.exe directly (sub-5ms)
  try {
    const regExe = process.env.SystemRoot
      ? path.join(process.env.SystemRoot, 'System32', 'reg.exe')
      : 'C:\\Windows\\System32\\reg.exe';
    const out = execFileSync(regExe, ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'], {
      encoding: 'utf8',
      timeout: 2000,
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    const match = out.match(/MachineGuid\s+REG_SZ\s+([^\r\n]+)/i);
    if (match?.[1]?.trim()) {
      return match[1].trim();
    }
  } catch {
    // try powershell fallback
  }

  // 2. Try PowerShell
  try {
    const out = execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        '(Get-ItemProperty -Path Registry::HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography -Name MachineGuid).MachineGuid',
      ],
      {
        encoding: 'utf8',
        timeout: 4000,
        stdio: ['pipe', 'pipe', 'ignore'],
      },
    ).trim();
    if (out.length >= 8) {
      return out;
    }
  } catch {
    // ignore
  }

  return null;
};

/**
 * Returns the stable machine identity for this host.
 * Prioritizes Windows MachineGuid, falls back to persisted UUID in data/machine-id.txt.
 */
export const getMachineId = (): string => {
  if (cachedMachineId) return cachedMachineId;

  if (process.env.STUMPCAST_MACHINE_ID) {
    cachedMachineId = process.env.STUMPCAST_MACHINE_ID.trim();
    return cachedMachineId;
  }

  const winGuid = queryWindowsMachineGuid();
  if (winGuid) {
    cachedMachineId = winGuid;
    writePersisted(winGuid);
    return cachedMachineId;
  }

  const persisted = readPersisted();
  if (persisted) {
    cachedMachineId = persisted;
    return cachedMachineId;
  }

  const fresh = randomUUID().toUpperCase();
  cachedMachineId = fresh;
  writePersisted(fresh);
  return cachedMachineId;
};

export const getFormattedMachineId = (): string => {
  return formatMachineId(getMachineId());
};
