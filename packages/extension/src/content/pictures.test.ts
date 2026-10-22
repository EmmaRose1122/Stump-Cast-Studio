import { describe, expect, it } from 'vitest';
import { RawUpdateSchema, type RawUpdate } from '@stumpcast/shared';
import { attachPictures } from './pictures';

const BASE = 'https://crex.com/cricket-live-score/abc-1/live';

/** A leaf element: `textContent` is what the walker sees in its container. */
const el = (text: string, parent?: unknown): Record<string, unknown> => ({
  textContent: text,
  parentElement: parent ?? null,
});

const image = (src: string, opts: { alt?: string; in?: unknown } = {}) => ({
  tag: 'img',
  textContent: '',
  parentElement: opts.in ?? null,
  getAttribute: (name: string) =>
    name === 'src' ? src : name === 'alt' ? (opts.alt ?? '') : name === 'title' ? '' : null,
});

const doc = (imgs: unknown[]): Document =>
  ({
    querySelectorAll: (sel: string) => (sel === 'img' ? imgs : []),
  }) as unknown as Document;

const update = (fields: Partial<RawUpdate['fields']>): RawUpdate =>
  RawUpdateSchema.parse({
    source: 'crex',
    matchId: 'm1',
    url: BASE,
    capturedAt: 1,
    confidence: 1,
    fields,
    missing: [],
  });

const CREST_A = 'https://cricketvectors.akamaized.net/Teams/Y.png';
const CREST_B = 'https://cricketvectors.akamaized.net/Teams/X.png';
const PHOTO_A = 'https://cricketvectors.akamaized.net/cFancode/4249696.png';
const FACE = 'https://cricketvectors.akamaized.net/players/org/9J7.png';
const JERSEY = 'https://cricketvectors.akamaized.net/jersey/limited/org/IO.png';

describe('attachPictures', () => {
  it('pairs each crest with the side named on it, not by position', () => {
    const u = update({ teams: [{ name: 'Australia' }, { name: 'Afghanistan' }] });
    // Deliberately the wrong way round in the DOM: only the label may decide.
    attachPictures(
      u,
      doc([
        image(CREST_B, { alt: 'Afghanistan' }),
        image(CREST_A, { alt: 'Australia' }),
      ]),
      BASE,
    );
    expect(u.fields.teams[0]?.logoUrl).toContain('Teams/Y.png'); // alt="Australia"
    expect(u.fields.teams[1]?.logoUrl).toContain('Teams/X.png'); // alt="Afghanistan"
  });

  it('finds a photo through the row that names the player', () => {
    const row = el('David Bedingham 45 (32)');
    const u = update({
      batters: [
        { name: 'David Bedingham', runs: 45, balls: 32 },
        { name: 'Daniel Bell-Drummond', runs: 10, balls: 8 },
      ],
    });
    attachPictures(u, doc([image(PHOTO_A, { in: row })]), BASE);
    expect(u.fields.batters[0]?.imageUrl).toBe(PHOTO_A);
    // The other batter has no row on this page: no photo beats the wrong photo.
    expect(u.fields.batters[1]?.imageUrl).toBeUndefined();
  });

  it('gives the bowler the picture in their own card', () => {
    const u = update({ bowler: { name: 'Adam Zampa', overs: 3, balls: 1, maidens: 0, runs: 36, wkts: 1 } });
    attachPictures(
      u,
      doc([
        image(PHOTO_A, { in: el('Adam Zampa 1-36 (3.1)') }),
        image('https://cricketvectors.akamaized.net/cFancode/9999999.png', { in: el('Tristan Stubbs 31 (21)') }),
      ]),
      BASE,
    );
    expect(u.fields.bowler?.imageUrl).toBe(PHOTO_A);
  });

  it('takes the abbreviated alt crex really writes: "S Thanikaithasan Logo"', () => {
    const u = update({
      batters: [
        { name: 'Shangeev Thanikaithasan', runs: 24, balls: 16 },
        { name: 'Taranjit Bharaj', runs: 23, balls: 13 },
      ],
    });
    attachPictures(
      u,
      doc([
        image(FACE, { alt: 'S Thanikaithasan Logo' }),
        image('https://cricketvectors.akamaized.net/players/org/ZZ9.png', { alt: 'T Bharaj Logo' }),
        image(JERSEY, { alt: 'S Thanikaithasan Logo' }),
      ]),
      BASE,
    );
    expect(u.fields.batters[0]?.imageUrl).toBe(FACE);
    expect(u.fields.batters[1]?.imageUrl).toContain('ZZ9');
  });

  it('never files a jersey graphic as a face, even when its label matches', () => {
    const u = update({ batters: [{ name: 'Shangeev Thanikaithasan', runs: 24, balls: 16 }] });
    attachPictures(u, doc([image(JERSEY, { alt: 'S Thanikaithasan Logo', in: el('Shangeev Thanikaithasan 24 (16)') })]), BASE);
    expect(u.fields.batters[0]?.imageUrl).toBeUndefined();
  });

  it('does not let one initial name a different player', () => {
    const u = update({ batters: [{ name: 'Steven Smith', runs: 10, balls: 9 }] });
    attachPictures(u, doc([image(FACE, { alt: 'S Thanikaithasan Logo' })]), BASE);
    expect(u.fields.batters[0]?.imageUrl).toBeUndefined();
  });

  it('ignores pictures that are not crests or player photos', () => {
    const u = update({ teams: [{ name: 'Afghanistan' }], batters: [{ name: 'Rahman Uddin', runs: 1, balls: 1 }] });
    attachPictures(
      u,
      doc([
        image('https://ads.example.net/banner.png', { alt: 'Afghanistan' }),
        image('https://crex.com/assets/logo.svg', { in: el('Rahman Uddin') }),
      ]),
      BASE,
    );
    expect(u.fields.teams[0]?.logoUrl).toBeUndefined();
    expect(u.fields.batters[0]?.imageUrl).toBeUndefined();
  });

  it('resolves a relative src against the page', () => {
    const u = update({ teams: [{ name: 'Afghanistan' }] });
    attachPictures(u, doc([image('/Teams/Y.png', { alt: 'Afghanistan' })]), BASE);
    expect(u.fields.teams[0]?.logoUrl).toBe('https://crex.com/Teams/Y.png');
  });

  it('rejects a non-http src outright', () => {
    const u = update({ teams: [{ name: 'Afghanistan' }] });
    attachPictures(u, doc([image('javascript:alert(1)', { alt: 'Afghanistan' })]), BASE);
    expect(u.fields.teams[0]?.logoUrl).toBeUndefined();
  });
});
