import { OneEuroFilter } from '../math/oneEuroFilter';
import { pointerFeature, SpikeGate, type Point2D } from '../math/pointing';
import { classifyPosture, thumbTouchRatio, type Posture } from '../math/postureValidator';
import { defaultCalibration, mapVertical, type VerticalCalibration } from '../math/verticalCalibration';
import type { HandResult } from './types';

export const PALM_HOLD_MS = 350; // open palm must be held this long to pause
export const DROPOUT_HOLD_MS = 150; // bridge brief tracking losses instead of resetting
export const TOUCH_ON = 0.3; // thumb-to-index distance / palm length
export const TOUCH_OFF = 0.45;
export const FLAP_REFRACTORY_MS = 150;

export interface FilterTuning {
  minCutoff: number;
  beta: number;
  dCutoff: number;
  rayGain: number;
}

export interface GestureSnapshot {
  handPresent: boolean;
  posture: Posture | 'NO_HAND';
  /** Spike-gated steering feature (mirrored camera space), pre-calibration. */
  feature: Point2D | null;
  /** Filtered target altitude in canvas px. Frozen while an open palm is shown. */
  targetY: number | null;
  /** Open palm held for PALM_HOLD_MS. */
  pauseHeld: boolean;
  touching: boolean;
  /** True only on the frame a thumb tap begins. */
  flapStart: boolean;
}

const EMPTY: GestureSnapshot = {
  handPresent: false, posture: 'NO_HAND', feature: null, targetY: null, pauseHeld: false, touching: false, flapStart: false,
};

/** Converts raw worker hand results into calibrated, filtered, debounced control signals. */
export class GestureInterpreter {
  calibration: VerticalCalibration;
  tuning: FilterTuning = { minCutoff: 1.0, beta: 0.015, dCutoff: 1.0, rayGain: 0.5 };
  snapshot: GestureSnapshot = EMPTY;

  private fy = new OneEuroFilter();
  private gate = new SpikeGate();
  private lastSeenMs = -Infinity;
  private palmSinceMs: number | null = null;
  private touching = false;
  private lastFlapMs = -Infinity;

  constructor(private readonly playHeight: number) {
    this.calibration = defaultCalibration(playHeight);
  }

  setCalibration(cal: VerticalCalibration | null): void {
    this.calibration = cal ?? defaultCalibration(this.playHeight);
    this.fy.reset();
  }

  setTuning(t: Partial<FilterTuning>): void {
    Object.assign(this.tuning, t);
    this.fy.minCutoff = this.tuning.minCutoff;
    this.fy.beta = this.tuning.beta;
    this.fy.dCutoff = this.tuning.dCutoff;
  }

  update(hand: HandResult | null, timestampMs: number): GestureSnapshot {
    if (!hand) {
      if (this.snapshot.handPresent && timestampMs - this.lastSeenMs <= DROPOUT_HOLD_MS) {
        return (this.snapshot = { ...this.snapshot, flapStart: false });
      }
      this.fy.reset();
      this.gate.reset();
      this.palmSinceMs = null;
      this.touching = false;
      return (this.snapshot = EMPTY);
    }
    this.lastSeenMs = timestampMs;

    const posture = classifyPosture(hand.worldLandmarks, hand.landmarks);
    if (posture === 'OPEN_PALM') this.palmSinceMs ??= timestampMs;
    else this.palmSinceMs = null;
    const pauseHeld = this.palmSinceMs !== null && timestampMs - this.palmSinceMs >= PALM_HOLD_MS;

    // Opening the hand moves the fingertip; keep the last steering target instead of jumping.
    let feature = this.snapshot.feature;
    let targetY = this.snapshot.targetY;
    if (posture === 'STEER' || targetY === null) {
      feature = this.gate.filter(pointerFeature(hand.landmarks, this.tuning.rayGain));
      targetY = this.fy.filter(mapVertical(this.calibration, feature.y), timestampMs / 1000);
    }

    const ratio = thumbTouchRatio(hand.worldLandmarks);
    const wasTouching = this.touching;
    this.touching = wasTouching ? ratio < TOUCH_OFF : ratio < TOUCH_ON;
    const flapStart = this.touching && !wasTouching && timestampMs - this.lastFlapMs >= FLAP_REFRACTORY_MS;
    if (flapStart) this.lastFlapMs = timestampMs;

    return (this.snapshot = { handPresent: true, posture, feature, targetY, pauseHeld, touching: this.touching, flapStart });
  }
}
