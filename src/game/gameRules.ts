import * as C from './constants';

export const speedForScore = (score: number) =>
  Math.min(C.GATE_SPEED + C.GATE_SPEED_STEP * Math.floor(score / 5), C.GATE_SPEED_MAX);

export const gapForScore = (score: number) =>
  Math.max(C.GATE_GAP - C.GATE_GAP_STEP * Math.floor(score / 5), C.GATE_GAP_MIN);

export function circleIntersectsRect(cx: number, cy: number, r: number, rx: number, ry: number, rw: number, rh: number): boolean {
  const nx = Math.max(rx, Math.min(cx, rx + rw));
  const ny = Math.max(ry, Math.min(cy, ry + rh));
  return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r;
}

/** Gates per leg of the journey. */
export const LEG_LENGTH = 10;

/** Which leg (0, 1, 2…; never wraps, so the journey keeps counting) a score is on. */
export const legForScore = (score: number) => Math.floor(Math.max(0, score) / LEG_LENGTH);
