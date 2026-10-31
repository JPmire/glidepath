import { CANVAS_HEIGHT as H, GLIDER_X, GROUND_HEIGHT } from '../game/constants';
import { fitVertical, type VerticalCalibration } from '../math/verticalCalibration';
import type { GestureSnapshot } from '../vision/gestureInterpreter';
import { drawEnvelope } from './art/envelope';

const STORAGE_KEY = 'glidepath.calibration.v2';
const DWELL_SEC = 0.6;
const WINDOW = 12; // samples kept for steadiness + median
const STEADY_STD = 0.012; // normalized feature units
const MIN_MOVE = 0.025; // a capture must differ from the previous one
const COOLDOWN_SEC = 0.5;

const PLAY_BOTTOM = H - GROUND_HEIGHT;
export const CAL_X = GLIDER_X + 120; // the column the reticle lives on
export const TARGET_YS = [0.12, 0.5, 0.88].map((f) => Math.round(f * PLAY_BOTTOM));

export function loadCalibration(): VerticalCalibration | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as VerticalCalibration) : null;
  } catch {
    return null;
  }
}

export function clearCalibration(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}

type Hint = 'no-hand' | 'palm' | 'move' | 'steady' | 'hold';

/** Point at each marker on the aiming column and hold roughly still (or press Space). */
export class CalibrationWizard {
  index = 0;
  dwell = 0;
  message = '';
  private hint: Hint = 'no-hand';
  private buffer: number[] = [];
  private captured: number[] = [];
  private cooldown = 0;
  private flash = 0;

  constructor(private readonly onDone: (c: VerticalCalibration) => void) {}

  reset(): void {
    this.index = 0;
    this.dwell = 0;
    this.buffer = [];
    this.captured = [];
    this.cooldown = 0;
    this.message = '';
  }

  /** Feed every vision frame. */
  onSample(s: GestureSnapshot, dtSec: number): void {
    this.cooldown = Math.max(0, this.cooldown - dtSec);
    if (!s.handPresent || !s.feature) return void ((this.hint = 'no-hand'), (this.dwell = 0), (this.buffer = []));
    if (s.posture === 'OPEN_PALM') return void ((this.hint = 'palm'), (this.dwell = 0));

    this.buffer.push(s.feature.y);
    if (this.buffer.length > WINDOW) this.buffer.shift();
    if (this.cooldown > 0 || this.buffer.length < 6) return void (this.hint = 'hold');

    const v = median(this.buffer);
    const prev = this.captured[this.captured.length - 1];
    if (prev !== undefined && Math.abs(v - prev) < MIN_MOVE) {
      this.hint = 'move';
      this.dwell = 0;
      return;
    }
    const steady = robustSpread(this.buffer.slice(-8)) < STEADY_STD;
    this.hint = steady ? 'steady' : 'hold';
    // Unsteadiness drains progress instead of resetting it, so tremor doesn't restart the count.
    this.dwell = steady ? this.dwell + dtSec : Math.max(0, this.dwell - dtSec * 1.5);
    if (this.dwell >= DWELL_SEC) this.capture(v);
  }

  /** Manual capture (Space). */
  captureNow(): void {
    if (this.buffer.length >= 4) this.capture(median(this.buffer));
  }

  private capture(v: number): void {
    this.captured.push(v);
    this.buffer = [];
    this.dwell = 0;
    this.cooldown = COOLDOWN_SEC;
    this.flash = 1;
    this.message = '';
    this.index++;
    if (this.index < TARGET_YS.length) return;

    try {
      const cal = fitVertical(this.captured.map((cv, i) => ({ v: cv, y: TARGET_YS[i] })));
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cal));
      } catch {
        /* storage unavailable: calibration still applies this session */
      }
      this.onDone(cal);
    } catch (e) {
      this.reset();
      this.message = e instanceof Error ? e.message : 'Calibration failed. Try again.';
    }
  }

  draw(ctx: CanvasRenderingContext2D, dt: number): void {
    this.flash = Math.max(0, this.flash - dt * 4);
    drawEnvelope(ctx, {
      x: CAL_X,
      targets: TARGET_YS,
      index: this.index,
      dwell: this.dwell / DWELL_SEC,
      hint: this.message || HINTS[this.hint],
      error: Boolean(this.message),
      flash: this.flash,
    });
  }
}

const HINTS: Record<Hint, string> = {
  'no-hand': 'Raise your hand into the camera view.',
  palm: 'That is the hold gesture. Point with your index finger.',
  move: 'Now point at the next empty stamp.',
  steady: 'Good. Hold it…',
  hold: 'Hold still…',
};

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** MAD scaled to σ for Gaussian noise; a single glitch frame barely moves it. */
function robustSpread(xs: number[]): number {
  const m = median(xs);
  return 1.4826 * median(xs.map((x) => Math.abs(x - m)));
}
