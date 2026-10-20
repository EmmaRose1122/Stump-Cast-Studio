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
  private secondaryStream: MediaStream | null = null;
  private cameraMode: 'none' | 'one' | 'two' = 'none';

  protected build(): HTMLElement {
    const root = document.createElement('div');
    root.className = 'c-stream-frame';
    root.innerHTML = `
      <div class="sf-live-badge">
        <span class="sf-live-dot">● LIVE</span>
        <span class="sf-match-slug"></span>
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
        <div class="sf-cam-box sf-cam-2 is-offline">
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

  private async acquire(constraints: MediaStreamConstraints): Promise<MediaStream | null> {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch {
      return null;
    }
  }

  private attach(video: HTMLVideoElement, stream: MediaStream): void {
    video.srcObject = stream;
    void video.play().catch(() => undefined);
  }

  private async startCameraFeed(): Promise<void> {
    if (this.activeStream) return;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return;
    const primary =
      (await this.acquire({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })) ??
      // Camera busy or the requested size unsupported: take whatever the OS offers.
      (await this.acquire({ video: true, audio: false }));
    if (!primary) return;
    this.activeStream = primary;
    if (this.cam1Video) this.attach(this.cam1Video, primary);
    await this.startSecondCamera(primary);
  }

  /** CAM 2 only goes on air when a *different* capture device backs it. */
  private async startSecondCamera(primary: MediaStream): Promise<void> {
    this.cam2Box.classList.add('is-offline');
    if (this.cameraMode !== 'two') return;
    const enumerate = navigator.mediaDevices.enumerateDevices;
    if (typeof enumerate !== 'function') return;
    const taken = new Set(primary.getVideoTracks().map((t) => t.getSettings().deviceId));
    const devices = await enumerate.call(navigator.mediaDevices).catch(() => []);
    const next = devices.find((d) => d.kind === 'videoinput' && d.deviceId && !taken.has(d.deviceId));
    if (!next) return;
    const second = await this.acquire({ video: { deviceId: { exact: next.deviceId } }, audio: false });
    if (!second || !this.cam2Video) return;
    this.secondaryStream = second;
    this.attach(this.cam2Video, second);
    this.cam2Box.classList.remove('is-offline');
  }

  private stopCameraFeed(): void {
    for (const stream of [this.activeStream, this.secondaryStream]) {
      try {
        stream?.getTracks().forEach((track) => track.stop());
      } catch {
        // ignore
      }
    }
    this.activeStream = null;
    this.secondaryStream = null;
    if (this.cam1Video) this.cam1Video.srcObject = null;
    if (this.cam2Video) this.cam2Video.srcObject = null;
    this.cam2Box.classList.add('is-offline');
  }

  setCameraMode(mode: 'none' | 'one' | 'two'): void {
    this.cameraMode = mode;
    this.root.dataset.cameraMode = mode;
    if (mode === 'none') this.stopCameraFeed();
    else if (this.activeStream) {
      if (mode === 'two') void this.startSecondCamera(this.activeStream);
      else this.cam2Box.classList.add('is-offline');
    } else void this.startCameraFeed();
  }

  override destroy(): void {
    this.stopCameraFeed();
    super.destroy?.();
  }
}
