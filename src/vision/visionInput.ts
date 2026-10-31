import { CameraManager, type VisionFrame } from './cameraManager';
import { GestureInterpreter, type GestureSnapshot } from './gestureInterpreter';
import type { HandResult } from './types';

/**
 * The camera, hand tracker and gesture interpreter as one input. The camera is switched on once
 * and stays on (and warm) for the session, so going home and back doesn't reload the model.
 */
export class VisionInput {
  readonly gestures: GestureInterpreter;
  camera: CameraManager | null = null;
  on = false;
  lastHand: HandResult | null = null;
  lastFrame: VisionFrame | null = null;
  /** Every interpreted frame, with the seconds since the previous one. */
  onSnapshot: (s: GestureSnapshot, dtSec: number) => void = () => {};
  private lastTs = 0;
  private noHandSince = performance.now();

  constructor(playBottom: number) {
    this.gestures = new GestureInterpreter(playBottom);
  }

  get snapshot(): GestureSnapshot {
    return this.gestures.snapshot;
  }

  /** Start the camera and tracker if they aren't running. Throws what getUserMedia / the worker threw. */
  async ensure(): Promise<void> {
    if (this.on) return;
    this.camera ??= new CameraManager();
    this.camera.onFrame = (f) => this.onFrame(f);
    this.camera.onError = (m) => console.error('[vision]', m);
    await this.camera.start();
    this.on = true;
  }

  /** No hand for over three seconds: worth telling the player. */
  handLost(now: number): boolean {
    return !this.snapshot.handPresent && now - this.noHandSince > 3000;
  }

  private onFrame(f: VisionFrame): void {
    const dtSec = this.lastTs ? Math.min((f.timestampMs - this.lastTs) / 1000, 0.1) : 1 / 30;
    this.lastTs = f.timestampMs;
    this.lastFrame = f;
    this.lastHand = f.hand;
    const snap = this.gestures.update(f.hand, f.timestampMs);
    if (snap.handPresent) this.noHandSince = performance.now();
    this.onSnapshot(snap, dtSec);
  }
}
