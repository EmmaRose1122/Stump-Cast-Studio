import fs from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { MAX_SOUND_SLOTS, slug, type SoundSlot } from '@stumpcast/shared';
import { schema, type StumpCastDb } from '../db';
import { SAMPLE_SOUNDS, encodeWav } from './wav';

export class SoundError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 | 413 = 400,
  ) {
    super(message);
  }
}

export const MAX_SOUND_BYTES = 10 * 1024 * 1024;

/** Identify the audio container from its first bytes (we never trust the filename or MIME). */
export const sniffAudio = (b: Buffer): 'wav' | 'mp3' | 'ogg' | null => {
  if (b.length < 12) return null;
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WAVE') return 'wav';
  if (b.toString('ascii', 0, 4) === 'OggS') return 'ogg';
  if (b.toString('ascii', 0, 3) === 'ID3') return 'mp3';
  if (b[0] === 0xff && (b[1]! & 0xe0) === 0xe0) return 'mp3'; // MPEG frame sync
  return null;
};

/** Up to ten sound slots stored as files under data/assets/sounds (B9). */
export class SoundService {
  readonly dir: string;

  constructor(
    private readonly db: StumpCastDb,
    dataDir: string,
  ) {
    this.dir = path.join(dataDir, 'assets', 'sounds');
    fs.mkdirSync(this.dir, { recursive: true });
  }

  list(): SoundSlot[] {
    return this.db
      .select()
      .from(schema.sounds)
      .all()
      .map((r) => ({
        id: r.id,
        title: r.title,
        file: r.file,
        includeInLoop: r.includeInLoop,
        volume: r.volume,
      }));
  }

  get(id: string): SoundSlot | undefined {
    return this.list().find((s) => s.id === id);
  }

  private uniqueId(title: string): string {
    const base = slug(title) || 'sound';
    const taken = new Set(this.list().map((s) => s.id));
    let id = base;
    for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
    return id;
  }

  private assertCapacity(adding = 1): void {
    if (this.list().length + adding > MAX_SOUND_SLOTS) {
      throw new SoundError(`All ${MAX_SOUND_SLOTS} sound slots are in use`, 409);
    }
  }

  add(input: {
    title: string;
    bytes: Buffer;
    includeInLoop?: boolean;
    volume?: number;
  }): SoundSlot {
    const title = input.title.trim();
    if (!title) throw new SoundError('A title is required');
    if (title.length > 60) throw new SoundError('The title is too long');
    if (input.bytes.length === 0) throw new SoundError('The file is empty');
    if (input.bytes.length > MAX_SOUND_BYTES) throw new SoundError('That file is too large', 413);
    const kind = sniffAudio(input.bytes);
    if (!kind) throw new SoundError('Use a WAV, MP3 or OGG audio file');
    this.assertCapacity();

    const id = this.uniqueId(title);
    const file = `sounds/${id}.${kind}`;
    fs.writeFileSync(path.join(this.dir, `${id}.${kind}`), input.bytes);
    const slot: SoundSlot = {
      id,
      title,
      file,
      includeInLoop: input.includeInLoop ?? false,
      volume: Math.min(1, Math.max(0, input.volume ?? 1)),
    };
    this.db.insert(schema.sounds).values(slot).run();
    return slot;
  }

  update(
    id: string,
    patch: Partial<Pick<SoundSlot, 'title' | 'includeInLoop' | 'volume'>>,
  ): SoundSlot {
    const existing = this.get(id);
    if (!existing) throw new SoundError('Unknown sound', 404);
    const next: SoundSlot = {
      ...existing,
      ...(patch.title !== undefined
        ? { title: patch.title.trim().slice(0, 60) || existing.title }
        : {}),
      ...(patch.includeInLoop !== undefined ? { includeInLoop: patch.includeInLoop } : {}),
      ...(patch.volume !== undefined ? { volume: Math.min(1, Math.max(0, patch.volume)) } : {}),
    };
    this.db
      .update(schema.sounds)
      .set({ title: next.title, includeInLoop: next.includeInLoop, volume: next.volume })
      .where(eq(schema.sounds.id, id))
      .run();
    return next;
  }

  remove(id: string): void {
    const existing = this.get(id);
    if (!existing) throw new SoundError('Unknown sound', 404);
    fs.rmSync(path.join(this.dir, path.basename(existing.file)), { force: true });
    this.db.delete(schema.sounds).where(eq(schema.sounds.id, id)).run();
  }

  /** Install the three generated placeholder sounds that are not already present. */
  addSamples(): SoundSlot[] {
    const added: SoundSlot[] = [];
    for (const s of SAMPLE_SOUNDS) {
      if (this.get(s.id)) continue;
      this.assertCapacity();
      const file = `sounds/${s.id}.wav`;
      fs.writeFileSync(path.join(this.dir, `${s.id}.wav`), encodeWav(s.build()));
      const slot: SoundSlot = { id: s.id, title: s.title, file, includeInLoop: false, volume: 0.9 };
      this.db.insert(schema.sounds).values(slot).run();
      added.push(slot);
    }
    return added;
  }

  /** Slots that take part in the loop, in storage order. */
  loopIds(): string[] {
    return this.list()
      .filter((s) => s.includeInLoop)
      .map((s) => s.id);
  }
}
