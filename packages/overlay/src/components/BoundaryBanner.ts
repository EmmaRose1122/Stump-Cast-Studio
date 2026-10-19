import { gsap } from 'gsap';
import type { EngineEvent, MatchState } from '@stumpcast/shared';
import { BannerQueue, type BannerItem, type BannerKind } from '../bannerQueue';
import { OverlayComponent } from '../component';

const LABEL: Record<BannerKind, string> = { FOUR: 'FOUR', SIX: 'SIX', WICKET: 'WICKET' };

/**
 * Full-width animated banner for 4 / 6 / WICKET. Each kind has its own motion; the Look's
 * boundary style (data attribute on <html>) controls the colours and shapes in CSS.
 */
export class BoundaryBanner extends OverlayComponent {
  protected override readonly alwaysVisible = true;
  private label!: HTMLElement;
  private detail!: HTMLElement;
  private queue = new BannerQueue((item, done) => this.run(item, done));

  protected build(): HTMLElement {
    const root = document.createElement('div');
    root.className = 'c-banner';
    root.hidden = true;
    root.innerHTML = '<span class="bn-label"></span><span class="bn-detail"></span>';
    this.label = root.querySelector('.bn-label')!;
    this.detail = root.querySelector('.bn-detail')!;
    return root;
  }

  update(_state: MatchState): void {
    /* driven by events, not state */
  }

  /** Returns true if the event was accepted for display. */
  handleEvent(e: EngineEvent): boolean {
    return this.queue.enqueue(e);
  }

  private run(item: BannerItem, done: () => void): void {
    const el = this.root;
    el.hidden = false;
    el.dataset.kind = item.kind;
    this.label.textContent = LABEL[item.kind];
    this.detail.textContent = this.describe(item);
    gsap.killTweensOf(el);

    const tl = this.track(gsap.timeline());
    gsap.set(el, { clearProps: 'all' });
    if (item.kind === 'FOUR') {
      tl.fromTo(
        el,
        { x: -1200, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.45, ease: 'power3.out' },
      )
        .to(el, { duration: 1.4 })
        .to(el, { x: 1200, opacity: 0, duration: 0.35, ease: 'power2.in' })
        .call(() => this.finish(done));
    } else if (item.kind === 'SIX') {
      tl.fromTo(
        el,
        { scale: 0.4, opacity: 0, transformOrigin: '50% 50%' },
        { scale: 1.08, opacity: 1, duration: 0.4, ease: 'back.out(2)' },
      )
        .to(el, { scale: 1, duration: 0.15 })
        .to(el, { duration: 1.6 })
        .to(el, { scale: 1.3, opacity: 0, duration: 0.35, ease: 'power2.in' })
        .call(() => this.finish(done));
    } else {
      tl.fromTo(
        el,
        { y: -300, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.3, ease: 'bounce.out' },
      )
        .to(el, { x: 14, duration: 0.05, repeat: 5, yoyo: true, ease: 'sine.inOut' })
        .to(el, { x: 0, duration: 0.05 })
        .to(el, { duration: 2 })
        .to(el, { y: -300, opacity: 0, duration: 0.35, ease: 'power2.in' })
        .call(() => this.finish(done));
    }
  }

  private finish(done: () => void): void {
    this.root.hidden = true;
    done();
  }

  private describe(item: BannerItem): string {
    const p = item.payload;
    if (item.kind === 'WICKET') {
      const out = typeof p.out === 'string' ? p.out : '';
      const runs = typeof p.outRuns === 'number' ? ` ${p.outRuns}` : '';
      const bowler = typeof p.bowler === 'string' ? `  b ${p.bowler}` : '';
      return `${out}${runs}${bowler}`.trim();
    }
    return '';
  }

  override destroy(): void {
    this.queue = new BannerQueue(() => undefined);
    super.destroy();
  }
}
