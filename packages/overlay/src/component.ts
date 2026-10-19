import { gsap } from 'gsap';
import type { Look, MatchState } from '@stumpcast/shared';
import { entranceVars } from './motion';

/**
 * Base class for every on-air element (BC-1): mount(stage), update(state), show(data), hide(),
 * destroy(). The entrance/exit animation is derived from the active Look, and every timeline is
 * created here so destroy() can kill them all (no leaks).
 */
export abstract class OverlayComponent<TData = unknown> {
  protected root!: HTMLElement;
  protected look!: Look;
  private timelines = new Set<gsap.core.Timeline>();
  private mounted = false;
  private visible = false;

  /** Build the DOM once. Must not read network or state. */
  protected abstract build(): HTMLElement;
  /** Re-render text/values from the latest match state (in place; never replace nodes). */
  abstract update(state: MatchState): void;
  /** Optional hook when card data arrives with `show`. */
  protected onShow(_data?: TData): void {}

  /** Start hidden unless `alwaysVisible` (scoreboards) is true. */
  protected readonly alwaysVisible: boolean = false;

  mount(stage: HTMLElement, look: Look): void {
    if (this.mounted) return;
    this.look = look;
    this.root = this.build();
    this.root.dataset.component = this.constructor.name;
    stage.appendChild(this.root);
    this.mounted = true;
    if (this.alwaysVisible) {
      this.visible = true;
    } else {
      this.root.style.visibility = 'hidden';
      gsap.set(this.root, { opacity: 0 });
    }
  }

  setLook(look: Look): void {
    this.look = look;
  }

  get element(): HTMLElement {
    return this.root;
  }

  get isVisible(): boolean {
    return this.visible;
  }

  show(data?: TData): void {
    if (!this.mounted) return;
    this.onShow(data);
    this.killTimelines();
    this.visible = true;
    this.root.style.visibility = 'visible';
    const { easing, durationMs } = this.look.motion;
    const tl = this.track(gsap.timeline());
    tl.fromTo(this.root, entranceVars(this.look.motion.entrance), {
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
      rotationX: 0,
      skewX: 0,
      filter: 'none',
      clipPath: 'inset(0 0 0 0)',
      duration: durationMs / 1000,
      ease: easing,
    });
  }

  hide(): void {
    if (!this.mounted || !this.visible || this.alwaysVisible) return;
    this.killTimelines();
    this.visible = false;
    const tl = this.track(gsap.timeline());
    tl.to(this.root, {
      opacity: 0,
      duration: Math.max(0.15, this.look.motion.durationMs / 2000),
      ease: 'power1.in',
      onComplete: () => {
        if (!this.visible) this.root.style.visibility = 'hidden';
      },
    });
  }

  destroy(): void {
    this.killTimelines();
    if (this.mounted) {
      gsap.killTweensOf(this.root);
      this.root.remove();
      this.mounted = false;
      this.visible = false;
    }
  }

  /** Number of live timelines (for leak tests and the debug HUD). */
  get activeTimelines(): number {
    return this.timelines.size;
  }

  protected track(tl: gsap.core.Timeline): gsap.core.Timeline {
    this.timelines.add(tl);
    tl.eventCallback('onComplete', () => this.timelines.delete(tl));
    return tl;
  }

  private killTimelines(): void {
    for (const tl of this.timelines) tl.kill();
    this.timelines.clear();
  }
}
