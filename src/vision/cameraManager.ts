import type { Delegate, FromWorker, HandResult, ToWorker } from './types';

export interface VisionFrame {
  hand: HandResult | null;
  /** Capture time on the main-thread clock (performance.now()). */
  timestampMs: number;
  inferenceMs: number;
  /** Capture → result latency including the worker round trip. */
  latencyMs: number;
}

/**
 * Owns the webcam stream and the hand-tracking worker. Frames are dispatched from
 * requestVideoFrameCallback (fires only on new camera frames), at most one in flight,
 * as transferable ImageBitmaps.
 */
export class CameraManager {
  readonly video: HTMLVideoElement;
  delegate: Delegate | null = null;
  cameraFps = 0;
  onFrame: (f: VisionFrame) => void = () => {};
  onError: (msg: string) => void = () => {};

  private worker: Worker;
  private busy = false;
  private frameTimes: number[] = [];
  private init: { resolve: (d: Delegate) => void; reject: (e: Error) => void } | null = null;

  constructor() {
    this.video = document.createElement('video');
    this.video.playsInline = true;
    this.video.muted = true;
    this.worker = new Worker(new URL('./handTracker.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e: MessageEvent<FromWorker>) => this.handle(e.data);
    this.worker.onerror = (e) => this.onError(e.message || 'Worker failed to start');
  }

  async start(): Promise<Delegate> {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 60 }, facingMode: 'user' },
    });
    this.video.srcObject = stream;
    await this.video.play();

    const ready = new Promise<Delegate>((resolve, reject) => (this.init = { resolve, reject }));
    const base = new URL(import.meta.env.BASE_URL, location.href);
    this.post({
      type: 'INIT',
      wasmBase: new URL('mediapipe/wasm', base).href,
      modelPath: new URL('mediapipe/hand_landmarker.task', base).href,
    });
    this.delegate = await ready;
    this.scheduleNext();
    return this.delegate;
  }

  private post(msg: ToWorker, transfer: Transferable[] = []): void {
    this.worker.postMessage(msg, transfer);
  }

  private scheduleNext(): void {
    this.video.requestVideoFrameCallback((now) => void this.onVideoFrame(now));
  }

  private async onVideoFrame(now: number): Promise<void> {
    this.trackFps(now);
    if (!this.busy && this.video.readyState >= 2) {
      this.busy = true;
      try {
        const bitmap = await createImageBitmap(this.video);
        const ts = performance.now();
        this.post({ type: 'DETECT', bitmap, timestampMs: ts }, [bitmap]);
      } catch {
        this.busy = false;
      }
    }
    this.scheduleNext();
  }

  private handle(msg: FromWorker): void {
    if (msg.type === 'READY') {
      this.init?.resolve(msg.delegate);
      this.init = null;
    } else if (msg.type === 'RESULT') {
      this.busy = false;
      const now = performance.now();
      this.onFrame({ hand: msg.hand, timestampMs: msg.timestampMs, inferenceMs: msg.inferenceMs, latencyMs: now - msg.timestampMs });
    } else if (msg.type === 'ERROR') {
      this.busy = false;
      if (this.init) {
        this.init.reject(new Error(msg.message));
        this.init = null;
      } else this.onError(msg.message);
    }
  }

  private trackFps(now: number): void {
    this.frameTimes.push(now);
    while (this.frameTimes.length > 0 && now - this.frameTimes[0] > 1000) this.frameTimes.shift();
    this.cameraFps = this.frameTimes.length;
  }
}

/** Player-facing explanation for a failed camera start. */
export function describeCameraError(e: unknown): string {
  return e instanceof DOMException && e.name === 'NotAllowedError'
    ? 'Camera access was blocked. Allow it in your browser and System Settings → Privacy & Security → Camera, or play with the mouse.'
    : `Couldn't start hand tracking: ${e instanceof Error ? e.message : String(e)}`;
}
