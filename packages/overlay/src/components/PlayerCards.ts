import type { MatchState } from '@stumpcast/shared';
import { assetUrl, attachImage } from '../assets';
import { OverlayComponent } from '../component';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

interface CardRefs {
  el: HTMLElement;
  photo: HTMLElement;
  name: HTMLElement;
  main: HTMLElement;
  sub: HTMLElement;
  /** What the photo currently shows, so it is only rebuilt when the player or image changes. */
  photoKey: string;
}

const makeCard = (): CardRefs => {
  const el = document.createElement('div');
  el.className = 'pc-card';
  el.innerHTML = `
    <span class="pc-photo"></span><span class="pc-name"></span>
    <span class="pc-main"></span><span class="pc-sub"></span>`;
  return {
    el,
    photo: el.querySelector('.pc-photo')!,
    name: el.querySelector('.pc-name')!,
    main: el.querySelector('.pc-main')!,
    sub: el.querySelector('.pc-sub')!,
    photoKey: '',
  };
};

/** Set the photo only when its source changed: avoids flashing initials on every score update. */
const setPhoto = (c: CardRefs, playerId: string, name: string): void => {
  const url = assetUrl('players', playerId);
  const key = `${playerId}|${url}`;
  if (c.photoKey === key) return;
  c.photoKey = key;
  c.photo.replaceChildren();
  c.photo.classList.remove('has-image');
  c.photo.textContent = initials(name);
  attachImage(c.photo, url);
};

/** Both batters. The photo slot falls back to initials until an image has been uploaded. */
export class BatterCards extends OverlayComponent {
  protected override readonly alwaysVisible = true;
  private readonly cards: CardRefs[] = [];

  protected build(): HTMLElement {
    const root = document.createElement('div');
    root.className = 'c-players c-batters';
    for (let i = 0; i < 2; i++) {
      const c = makeCard();
      this.cards.push(c);
      root.append(c.el);
    }
    return root;
  }

  update(s: MatchState): void {
    s.batters.forEach((b, i) => {
      const c = this.cards[i]!;
      c.el.classList.toggle('pc-strike', b.onStrike);
      setPhoto(c, b.playerId, b.name);
      c.name.textContent = `${b.name}${b.onStrike ? ' *' : ''}`;
      c.main.textContent = `${b.runs} (${b.balls})`;
      c.sub.textContent = `${b.fours}x4  ${b.sixes}x6`;
    });
  }
}

export class BowlerCard extends OverlayComponent {
  protected override readonly alwaysVisible = true;
  private card!: CardRefs;

  protected build(): HTMLElement {
    const root = document.createElement('div');
    root.className = 'c-players c-bowler';
    this.card = makeCard();
    root.append(this.card.el);
    return root;
  }

  update(s: MatchState): void {
    const b = s.bowler;
    const c = this.card;
    setPhoto(c, b.playerId, b.name);
    c.name.textContent = b.name;
    c.main.textContent = `${b.wkts}-${b.runs}`;
    c.sub.textContent = `${b.overs}.${b.balls} ov  ${b.maidens}m`;
  }
}
