import * as C from './constants';
import type { GateRules } from './difficulty';

/** A gap that slides up and down around `baseY`. */
export interface Drift {
  baseY: number;
  amp: number;
  hz: number;
  phase: number; // radians
}

export interface Gate {
  /** Unique for the session (never reset), so art and postmarks can be cached per gate. */
  id: number;
  x: number;
  width: number;
  gapY: number;
  gapH: number;
  scored: boolean;
  drift?: Drift;
}

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

export interface ShiftLimits {
  minShift: number;
  maxShift: number;
  /** Extra room kept clear at the ceiling and street (a drifting gap's amplitude). */
  inset?: number;
}

/**
 * Next gap centre: uniform over the heights that are inside the margins and between `minShift` and
 * `maxShift` from the last centre, so the player has to swing. If no height is that far away it
 * falls back to the nearest legal one within `maxShift`.
 */
export function nextGapY(r: number, lastGapY: number, gapH: number, playBottom: number, lim: ShiftLimits): number {
  const lo = C.GATE_MARGIN + gapH / 2 + (lim.inset ?? 0);
  const hi = playBottom - C.GATE_MARGIN - gapH / 2 - (lim.inset ?? 0);
  if (hi <= lo) return (lo + hi) / 2;
  const below = [Math.max(lo, lastGapY - lim.maxShift), Math.min(hi, lastGapY - lim.minShift)];
  const above = [Math.max(lo, lastGapY + lim.minShift), Math.min(hi, lastGapY + lim.maxShift)];
  const nb = Math.max(0, below[1] - below[0]);
  const na = Math.max(0, above[1] - above[0]);
  if (nb + na <= 0) {
    const want = lo + r * (hi - lo);
    return Math.max(lo, Math.min(hi, Math.max(lastGapY - lim.maxShift, Math.min(lastGapY + lim.maxShift, want))));
  }
  const u = r * (nb + na);
  return u < nb ? below[0] + u : above[0] + (u - nb);
}

/** Build the next gate at the right edge. `rng` decides height, and whether / how it drifts. */
export function makeGate(id: number, lastGapY: number, rules: GateRules, playBottom: number, rng: () => number): Gate {
  const gapH = rules.gapH;
  const room = (playBottom - 2 * C.GATE_MARGIN - gapH) / 2;
  const amp = rng() < rules.driftChance ? Math.min(rules.driftAmp, Math.max(0, room - 20)) : 0;
  const lim = { minShift: rules.minShift, maxShift: rules.maxShift, inset: amp };
  const baseY = nextGapY(rng(), lastGapY, gapH, playBottom, lim);
  const gate: Gate = { id, x: C.CANVAS_WIDTH + 10, width: C.GATE_WIDTH, gapY: baseY, gapH, scored: false };
  if (amp > 0) {
    gate.drift = { baseY, amp, hz: rules.driftHz, phase: rng() * Math.PI * 2 };
    stepDrift(gate, 0);
  }
  return gate;
}

/** Slide a drifting gate's gap along its sine path. */
export function stepDrift(g: Gate, dt: number): void {
  if (!g.drift) return;
  const d = g.drift;
  d.phase = (d.phase + 2 * Math.PI * d.hz * dt) % (2 * Math.PI);
  g.gapY = d.baseY + d.amp * Math.sin(d.phase);
}

/** Gates per leg of the journey. */
export const LEG_LENGTH = 10;

/** Which leg (0, 1, 2…; never wraps, so the journey keeps counting) a score is on. */
export const legForScore = (score: number) => Math.floor(Math.max(0, score) / LEG_LENGTH);
