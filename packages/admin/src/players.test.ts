import { describe, expect, it } from 'vitest';
import { assetFileUrl, pageCount } from './lib/assetsApi';

describe('library helpers', () => {
  it('computes page counts with a minimum of one page', () => {
    expect(pageCount(0, 24)).toBe(1);
    expect(pageCount(24, 24)).toBe(1);
    expect(pageCount(25, 24)).toBe(2);
    expect(pageCount(400, 96)).toBe(5);
    expect(pageCount(10, 0)).toBe(10); // a bad page size never divides by zero
  });

  it('builds the static URL with an optional cache-buster', () => {
    expect(assetFileUrl({ file: 'players/a.webp' })).toBe('/assets/players/a.webp');
    expect(assetFileUrl({ file: 'players/a.webp' }, 7)).toBe('/assets/players/a.webp?v=7');
  });
});
