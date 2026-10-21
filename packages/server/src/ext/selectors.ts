import fs from 'node:fs';
import path from 'node:path';
import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import {
  DEFAULT_SELECTORS_PUBLIC_KEY,
  verifySignedSelectorBundle,
  type SelectorBundle,
  type SelectorStatus,
  type SignedSelectorBundle,
} from '@stumpcast/shared';
import bundledCricbuzz from '../../../extension/src/config/selectors.cricbuzz.json';
import bundledCrex from '../../../extension/src/config/selectors.crex.json';

const loadServerPrivateKey = (): string => {
  try {
    const p = path.resolve(process.cwd(), '.secrets', 'selectors-private.key');
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim();
  } catch {
    /* fallback to default key */
  }
  return '59aff2b36e2243cda58af14c6bdd7b515ef547900004b910c24135d75ddc7f6b';
};

export interface SelectorServiceOptions {
  dataDir: string;
  publicKey?: string;
  privateKey?: string;
  remoteUrl?: string;
  fetchFn?: typeof fetch;
}

export class SelectorService {
  private activeBundle: SignedSelectorBundle;
  private source: 'bundled' | 'remote' = 'bundled';
  private lastCheckedAt?: number;
  private hasUpdate = false;
  private readonly listeners = new Set<() => void>();
  private readonly publicKey: string;
  private readonly privateKey: string;
  private readonly remoteUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly selectorsDir: string;
  private readonly activeFile: string;

  constructor(private readonly opts: SelectorServiceOptions) {
    this.publicKey = opts.publicKey ?? DEFAULT_SELECTORS_PUBLIC_KEY;
    this.privateKey =
      opts.privateKey ??
      process.env.STUMPCAST_SELECTORS_PRIVATE_KEY ??
      loadServerPrivateKey();
    this.remoteUrl =
      opts.remoteUrl ??
      process.env.STUMPCAST_SELECTORS_URL ??
      'https://stumpcast.app/api/selectors/latest';
    this.fetchFn = opts.fetchFn ?? fetch;
    this.selectorsDir = path.join(opts.dataDir, 'selectors');
    this.activeFile = path.join(this.selectorsDir, 'active.json');

    const defaultBundle: SelectorBundle = {
      version: Math.max(
        (bundledCricbuzz as { version?: number }).version || 1,
        (bundledCrex as { version?: number }).version || 1,
      ),
      updatedAt: 1775000000000,
      selectors: {
        cricbuzz: bundledCricbuzz,
        crex: bundledCrex,
      },
    };

    this.activeBundle = this.signSync(defaultBundle);
    this.loadPersisted();
  }

  private signSync(bundle: SelectorBundle): SignedSelectorBundle {
    const payload = JSON.stringify(bundle);
    const pkcs8Prefix = Buffer.from('302e020100300506032b657004220420', 'hex');
    const rawPriv = Buffer.from(this.privateKey, 'hex');
    const pkcs8Key = Buffer.concat([pkcs8Prefix, rawPriv]);
    const privKey = createPrivateKey({ key: pkcs8Key, format: 'der', type: 'pkcs8' });
    const sig = sign(null, Buffer.from(payload, 'utf8'), privKey);
    return {
      payload,
      signature: sig.toString('hex'),
      version: bundle.version,
      updatedAt: bundle.updatedAt,
    };
  }

  private loadPersisted(): void {
    if (!fs.existsSync(this.activeFile)) return;
    try {
      const content = fs.readFileSync(this.activeFile, 'utf8');
      const json = JSON.parse(content) as SignedSelectorBundle;
      const verified = this.verifySync(json);
      if (verified.valid && verified.bundle) {
        this.activeBundle = json;
        this.source = 'remote';
      } else {
        fs.unlinkSync(this.activeFile);
      }
    } catch {
      // Ignore corrupted files and keep bundled
    }
  }

  private verifySync(signed: unknown): { valid: boolean; bundle?: SelectorBundle } {
    try {
      const raw = signed as SignedSelectorBundle;
      if (!raw.payload || !raw.signature) return { valid: false };
      const bundle = JSON.parse(raw.payload) as SelectorBundle;
      if (bundle.version !== raw.version) return { valid: false };

      const spkiPrefix = Buffer.from('302a300506032b6570032100', 'hex');
      const spkiKey = Buffer.concat([spkiPrefix, Buffer.from(this.publicKey, 'hex')]);
      const key = createPublicKey({ key: spkiKey, format: 'der', type: 'spki' });
      const ok = verify(
        null,
        Buffer.from(raw.payload, 'utf8'),
        key,
        Buffer.from(raw.signature, 'hex'),
      );
      return ok ? { valid: true, bundle } : { valid: false };
    } catch {
      return { valid: false };
    }
  }

  onUpdate(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emitUpdate(): void {
    for (const fn of this.listeners) fn();
  }

  getActiveBundle(): SignedSelectorBundle {
    return this.activeBundle;
  }

  getStatus(): SelectorStatus {
    return {
      version: this.activeBundle.version,
      updatedAt: this.activeBundle.updatedAt,
      source: this.source,
      hasUpdate: this.hasUpdate,
      lastCheckedAt: this.lastCheckedAt,
    };
  }

  async install(signed: unknown): Promise<{ ok: boolean; version: number }> {
    const verified = await verifySignedSelectorBundle(signed, this.publicKey);
    if (!verified.valid || !verified.bundle) {
      throw new Error('Invalid signature or tampered selector bundle');
    }
    const signedBundle = signed as SignedSelectorBundle;
    fs.mkdirSync(this.selectorsDir, { recursive: true });
    fs.writeFileSync(this.activeFile, JSON.stringify(signedBundle, null, 2), 'utf8');
    this.activeBundle = signedBundle;
    this.source = 'remote';
    this.emitUpdate();
    return { ok: true, version: signedBundle.version };
  }

  async rollback(): Promise<{ ok: boolean; version: number }> {
    if (fs.existsSync(this.activeFile)) {
      try {
        fs.unlinkSync(this.activeFile);
      } catch {
        // file might have been removed
      }
    }
    const defaultBundle: SelectorBundle = {
      version: Math.max(
        (bundledCricbuzz as { version?: number }).version || 1,
        (bundledCrex as { version?: number }).version || 1,
      ),
      updatedAt: 1775000000000,
      selectors: {
        cricbuzz: bundledCricbuzz,
        crex: bundledCrex,
      },
    };
    this.activeBundle = this.signSync(defaultBundle);
    this.source = 'bundled';
    this.emitUpdate();
    return { ok: true, version: this.activeBundle.version };
  }

  /**
   * Fetch the configured bundle URL. The URL is deliberately not a parameter: accepting one from
   * the request turned the local server into a proxy that would fetch any host it was pointed at.
   */
  async checkRemote(): Promise<{ ok: boolean; updated: boolean; version: number; message: string }> {
    this.lastCheckedAt = Date.now();
    const url = this.remoteUrl;
    try {
      const res = await this.fetchFn(url);
      if (!res.ok) {
        return {
          ok: false,
          updated: false,
          version: this.activeBundle.version,
          message: `Remote check returned HTTP ${res.status}`,
        };
      }
      const json = (await res.json()) as SignedSelectorBundle;
      const verified = await verifySignedSelectorBundle(json, this.publicKey);
      if (!verified.valid || !verified.bundle) {
        return {
          ok: false,
          updated: false,
          version: this.activeBundle.version,
          message: 'Remote bundle signature invalid or tampered',
        };
      }

      if (verified.bundle.version > this.activeBundle.version) {
        await this.install(json);
        this.hasUpdate = false;
        return {
          ok: true,
          updated: true,
          version: verified.bundle.version,
          message: `Updated to version ${verified.bundle.version}`,
        };
      }

      return {
        ok: true,
        updated: false,
        version: this.activeBundle.version,
        message: 'Selectors are up to date',
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        updated: false,
        version: this.activeBundle.version,
        message: `Remote check failed: ${msg}`,
      };
    }
  }
}
