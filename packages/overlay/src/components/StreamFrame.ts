import type { MatchState } from '@stumpcast/shared';
import { OverlayComponent } from '../component';

/**
 * Centre broadcast stream frame for StumpCast Studio live broadcast.
 * Displays neon green border, live camera angle, ● LIVE match slug, brand badge,
 * and live video streams in CAM 1 / CAM 2 host boxes.
 */
export class StreamFrame extends OverlayComponent {
  protected override readonly alwaysVisible = true;
  private slugEl!: HTMLElement;
  private camContainer!: HTMLElement;
  private cam1Box!: HTMLElement;
  private cam2Box!: HTMLElement;
  private cam1Video!: HTMLVideoElement;
  private cam2Video!: HTMLVideoElement;
  private activeStream: MediaStream | null = null;

  protected build(): HTMLElement {
    const root = document.createElement('div');
    root.className = 'c-stream-frame';
    root.innerHTML = `
      <div class="sf-live-badge">
        <span class="sf-live-dot">● LIVE</span>
        <span class="sf-match-slug">RSA V AUS</span>
      </div>
      <div class="sf-viewport"></div>
      <div class="sf-brand-badge">
        <span class="sf-brand-dot"></span>STUMPCAST STUDIO
      </div>
      <div class="sf-cam-container">
        <div class="sf-cam-box sf-cam-1">
          <video class="sf-cam-video sf-cam-1-video" autoplay playsinline muted></video>
          <span class="sf-cam-label">CAM 1 · HOST</span>
        </div>
        <div class="sf-cam-box sf-cam-2">
          <video class="sf-cam-video sf-cam-2-video" autoplay playsinline muted></video>
          <span class="sf-cam-label">CAM 2</span>
        </div>
      </div>
    `;
    this.slugEl = root.querySelector('.sf-match-slug')!;
    this.camContainer = root.querySelector('.sf-cam-container')!;
    this.cam1Box = root.querySelector('.sf-cam-1')!;
    this.cam2Box = root.querySelector('.sf-cam-2')!;
    this.cam1Video = root.querySelector('.sf-cam-1-video')!;
    this.cam2Video = root.querySelector('.sf-cam-2-video')!;
    return root;
  }

  update(s: MatchState): void {
    if (s.teams && s.teams.length >= 2) {
      const a = s.teams[0].short || s.teams[0].name.slice(0, 3).toUpperCase();
      const b = s.teams[1].short || s.teams[1].name.slice(0, 3).toUpperCase();
      this.slugEl.textContent = `${a} V ${b}`;
    }
  }

  private async startCameraFeed(): Promise<void> {
    if (this.activeStream) return;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      this.activeStream = stream;
      if (this.cam1Video) {
        this.cam1Video.srcObject = stream;
        void this.cam1Video.play().catch(() => undefined);
      }
    } catch {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        this.activeStream = stream;
        if (this.cam1Video) {
          this.cam1Video.srcObject = stream;
          void this.cam1Video.play().catch(() => undefined);
        }
      } catch {
        // Camera unavailable, in use by another app, or permissions not granted
      }
    }
  }

  private stopCameraFeed(): void {
    if (this.activeStream) {
      try {
        this.activeStream.getTracks().forEach((track) => track.stop());
      } catch {
        // ignore
      }
      this.activeStream = null;
    }
    if (this.cam1Video) {
      this.cam1Video.srcObject = null;
    }
  }

  setCameraMode(mode: 'none' | 'one' | 'two'): void {
    this.root.dataset.cameraMode = mode;
    if (mode === 'one' || mode === 'two') {
      void this.startCameraFeed();
    } else {
      this.stopCameraFeed();
    }
  }

  override destroy(): void {
    this.stopCameraFeed();
    super.destroy?.();
  }
}
