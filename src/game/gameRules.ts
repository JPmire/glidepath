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

/** Does the glider at altitude `y` touch either wall of a gate (ceiling → gap → street)? */
export function hitsGate(y: number, g: { x: number; width: number; gapY: number; gapH: number }, playBottom: number): boolean {
  const top = g.gapY - g.gapH / 2;
  const bottom = g.gapY + g.gapH / 2;
  return (
    circleIntersectsRect(C.GLIDER_X, y, C.GLIDER_HITBOX, g.x, 0, g.width, top) ||
    circleIntersectsRect(C.GLIDER_X, y, C.GLIDER_HITBOX, g.x, bottom, g.width, playBottom - bottom)
  );
}

/** Next gap centre: random within the margins, but never more than GATE_MAX_SHIFT from the last. */
export function nextGapY(r: number, lastGapY: number, gapH: number, playBottom: number): number {
  const lo = C.GATE_MARGIN + gapH / 2;
  const hi = playBottom - C.GATE_MARGIN - gapH / 2;
  const want = lo + r * (hi - lo);
  const gapY = Math.max(lastGapY - C.GATE_MAX_SHIFT, Math.min(lastGapY + C.GATE_MAX_SHIFT, want));
  return Math.max(lo, Math.min(hi, gapY));
}

/** Gates per leg of the journey. */
export const LEG_LENGTH = 10;

/** Which leg (0, 1, 2…; never wraps, so the journey keeps counting) a score is on. */
export const legForScore = (score: number) => Math.floor(Math.max(0, score) / LEG_LENGTH);
