import { describe, expect, it } from 'vitest';
import { MAX_FILE_BYTES, capacityLabel, validateSoundFile } from './lib/sounds';

describe('sound upload checks', () => {
  it('accepts WAV, MP3 and OGG within the size limit', () => {
    for (const name of ['a.wav', 'B.MP3', 'c.ogg']) {
      expect(validateSoundFile({ name, size: 1000 })).toBeNull();
    }
  });

  it('explains why a file is rejected', () => {
    expect(validateSoundFile({ name: 'a.txt', size: 10 })).toMatch(/WAV, MP3 or OGG/);
    expect(validateSoundFile({ name: 'a.wav', size: 0 })).toMatch(/empty/);
    expect(validateSoundFile({ name: 'a.wav', size: MAX_FILE_BYTES + 1 })).toMatch(/10 MB/);
  });

  it('formats the slot capacity', () => {
    expect(capacityLabel(3, 10)).toBe('3 / 10 slots');
  });
});
