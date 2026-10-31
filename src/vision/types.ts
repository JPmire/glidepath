import type { Vec3 } from '../math/postureValidator';

export type Delegate = 'GPU' | 'CPU';

export type ToWorker =
  | { type: 'INIT'; wasmBase: string; modelPath: string }
  | { type: 'DETECT'; bitmap: ImageBitmap; timestampMs: number };

export interface HandResult {
  /** 21 normalized image landmarks (x, y in [0,1], unmirrored). */
  landmarks: Vec3[];
  /** 21 metric 3D landmarks (metres, hand-centred). */
  worldLandmarks: Vec3[];
  handedness: string;
  score: number;
}

export type FromWorker =
  | { type: 'READY'; delegate: Delegate }
  | { type: 'RESULT'; hand: HandResult | null; inferenceMs: number; timestampMs: number }
  | { type: 'ERROR'; message: string };
