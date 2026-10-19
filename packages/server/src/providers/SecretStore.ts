import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface SecretStoreOptions {
  dataDir?: string;
  masterKey?: string;
}

/**
 * SecretStore manages sensitive API keys encrypted on disk using AES-256-GCM.
 * Never stores plaintext API keys in client-accessible bundles or plain config.
 */
export class SecretStore {
  private readonly secretsPath: string;
  private readonly masterKey: Buffer;
  private cache = new Map<string, string>();

  constructor(opts: SecretStoreOptions = {}) {
    const dir = opts.dataDir ?? path.join(process.cwd(), '.secrets');
    fs.mkdirSync(dir, { recursive: true });
    this.secretsPath = path.join(dir, 'keys.enc');

    const masterKeyFile = path.join(dir, 'master.key');
    let keyHex = opts.masterKey ?? process.env.STUMPCAST_SECRET_KEY;
    if (!keyHex) {
      if (fs.existsSync(masterKeyFile)) {
        try {
          keyHex = fs.readFileSync(masterKeyFile, 'utf8').trim();
        } catch {
          // ignore
        }
      }
      if (!keyHex) {
        keyHex = crypto.randomBytes(32).toString('hex');
        try {
          fs.writeFileSync(masterKeyFile, keyHex, { encoding: 'utf8' });
        } catch {
          // fallback in-memory
        }
      }
    }
    this.masterKey = Buffer.from(keyHex.padEnd(64, '0').slice(0, 64), 'hex');

    this.load();
  }

  private load(): void {
    if (!fs.existsSync(this.secretsPath)) return;
    try {
      const raw = fs.readFileSync(this.secretsPath, 'utf8');
      const [ivHex, tagHex, dataHex] = raw.split(':');
      if (!ivHex || !tagHex || !dataHex) return;

      const iv = Buffer.from(ivHex, 'hex');
      const tag = Buffer.from(tagHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-gcm', this.masterKey, iv);
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(dataHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      const parsed = JSON.parse(decrypted);
      this.cache = new Map(Object.entries(parsed));
    } catch {
      this.cache = new Map();
    }
  }

  private persist(): void {
    try {
      const payload = JSON.stringify(Object.fromEntries(this.cache.entries()));
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', this.masterKey, iv);

      let encrypted = cipher.update(payload, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const tag = cipher.getAuthTag().toString('hex');

      fs.writeFileSync(this.secretsPath, `${iv.toString('hex')}:${tag}:${encrypted}`, 'utf8');
    } catch (err) {
      console.error('SecretStore: failed to persist secrets', err);
    }
  }

  getSecret(keyName: string): string | null {
    return this.cache.get(keyName) ?? null;
  }

  setSecret(keyName: string, secretValue: string): void {
    this.cache.set(keyName, secretValue);
    this.persist();
  }

  deleteSecret(keyName: string): boolean {
    const deleted = this.cache.delete(keyName);
    if (deleted) this.persist();
    return deleted;
  }
}
