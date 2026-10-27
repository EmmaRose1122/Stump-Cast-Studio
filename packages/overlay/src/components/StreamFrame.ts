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
  /** Look-gallery frames show the camera monitor without opening a real webcam. */
  private designPreview = false;
  private cameraHost: HTMLElement | null = null;
  /** A permission prompt can take seconds; settings updates must not open a second request. */
  private starting = false;
  private startingSecond = false;

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
          <span class="sf-cam-scan"></span>
          <span class="sf-cam-slate"><strong>NO SIGNAL</strong><span>CAMERA STANDBY</span></span>
          <span class="sf-cam-label">CAM 1 · HOST</span>
        </div>
        <div class="sf-cam-box sf-cam-2 is-offline">
          <video class="sf-cam-video sf-cam-2-video" autoplay playsinline muted></video>
          <span class="sf-cam-scan"></span>
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
    video.closest('.sf-cam-box')?.classList.add('is-live');
    void video.play().catch(() => undefined);
  }

  private async startCameraFeed(): Promise<void> {
    if (this.activeStream || this.starting) return;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return;
    this.starting = true;
    let primary: MediaStream | null = null;
    try {
      primary =
        (await this.acquire({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })) ??
        // Camera busy or the requested size unsupported: take whatever the OS offers.
        (await this.acquire({ video: true, audio: false }));
    } finally {
      this.starting = false;
    }
    if (!primary) return;
    if (this.cameraMode === 'none') {
      // Switched off while the permission prompt was open.
      primary.getTracks().forEach((t) => t.stop());
      return;
    }
    this.activeStream = primary;
    if (this.cam1Video) this.attach(this.cam1Video, primary);
    await this.startSecondCamera(primary);
  }

  /** CAM 2 only goes on air when a *different* capture device backs it. */
  private async startSecondCamera(primary: MediaStream): Promise<void> {
    this.cam2Box.classList.add('is-offline');
    if (this.cameraMode !== 'two' || this.secondaryStream || this.startingSecond) return;
    const enumerate = navigator.mediaDevices.enumerateDevices;
    if (typeof enumerate !== 'function') return;
    this.startingSecond = true;
    let second: MediaStream | null = null;
    try {
      const taken = new Set(primary.getVideoTracks().map((t) => t.getSettings().deviceId));
      const devices = await enumerate.call(navigator.mediaDevices).catch(() => []);
      const next = devices.find((d) => d.kind === 'videoinput' && d.deviceId && !taken.has(d.deviceId));
      if (!next) return;
      second = await this.acquire({ video: { deviceId: { exact: next.deviceId } }, audio: false });
    } finally {
      this.startingSecond = false;
    }
    // The operator may have left "two cameras" while the device was opening.
    if (!second || !this.cam2Video || this.cameraMode !== 'two') {
      second?.getTracks().forEach((t) => t.stop());
      return;
    }
    this.secondaryStream = second;
    this.attach(this.cam2Video, second);
    this.cam2Box.classList.remove('is-offline');
  }

  /** Release CAM 2 only. The primary feed keeps running. */
  private stopSecondCamera(): void {
    const second = this.secondaryStream;
    this.secondaryStream = null;
    try {
      second?.getTracks().forEach((track) => track.stop());
    } catch {
      // already stopped
    }
    if (this.cam2Video) this.cam2Video.srcObject = null;
    this.cam2Box.classList.remove('is-live');
    this.cam2Box.classList.add('is-offline');
  }

  private stopCameraFeed(): void {
    this.stopSecondCamera();
    try {
      this.activeStream?.getTracks().forEach((track) => track.stop());
    } catch {
      // already stopped
    }
    this.activeStream = null;
    if (this.cam1Video) this.cam1Video.srcObject = null;
    this.cam1Box.classList.remove('is-live');
  }

  setCameraMode(mode: 'none' | 'one' | 'two'): void {
    this.cameraMode = mode;
    // A real camera choice always wins over the gallery slate.
    if (mode !== 'none') this.designPreview = false;
    this.syncCamera();
    if (mode === 'none') {
      this.stopCameraFeed();
      return;
    }
    if (mode === 'one') {
      // Switching two -> one used to leave the second camera capturing with no preview to show.
      this.stopSecondCamera();
    }
    if (!this.activeStream) void this.startCameraFeed();
    else if (mode === 'two') void this.startSecondCamera(this.activeStream);
  }

  /**
   * Shows the camera monitor with a standby slate for the look gallery. Calling it must not touch
   * `getUserMedia`: a wall of preview iframes would otherwise open a camera per card.
   */
  showDesignPreview(): void {
    this.designPreview = true;
    this.syncCamera();
  }

  /**
   * Re-home the CAM 1 monitor into another element. Pro Look 2 draws its own camera window, and
   * the operator expects the feed inside that window rather than a picture-in-picture over the
   * video. Passing `null` puts the monitor back into the stream frame.
   */
  attachCameraTo(host: HTMLElement | null): void {
    this.cameraHost = host;
    if (host) {
      if (this.cam1Box.parentElement !== host) host.append(this.cam1Box);
    } else if (this.cam1Box.parentElement !== this.camContainer) {
      this.camContainer.append(this.cam1Box);
    }
    this.syncCamera();
  }

  private syncCamera(): void {
    const mode = this.designPreview ? 'one' : this.cameraMode;
    this.root.dataset.cameraMode = mode;
    // The host keeps the mode because the CSS that reveals the monitor keys off an ancestor.
    if (this.cameraHost) this.cameraHost.dataset.camMode = mode;
    if (this.designPreview) this.root.dataset.designPreview = '1';
    else delete this.root.dataset.designPreview;
  }

  override destroy(): void {
    this.stopCameraFeed();
    super.destroy?.();
  }
}
