export interface GliderBody {
  y: number;
  vy: number;
}

export interface FollowParams {
  omegaN: number;
  zeta: number;
  vMax: number;
}

export interface ClassicParams {
  gravity: number;
  flapVy: number;
  vMax: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Mode A: 2nd-order spring-damper driven toward the filtered target altitude. Integrated every
 * render tick, so a 30 FPS target becomes smooth 120 Hz motion. Semi-implicit Euler.
 */
export function stepFollow(b: GliderBody, targetY: number, dt: number, p: FollowParams): void {
  const ay = p.omegaN * p.omegaN * (targetY - b.y) - 2 * p.zeta * p.omegaN * b.vy;
  b.vy = clamp(b.vy + ay * dt, -p.vMax, p.vMax);
  b.y += b.vy * dt;
}

/** Mode B: arcade gravity with a discrete upward impulse on flap. */
export function stepClassic(b: GliderBody, flap: boolean, dt: number, p: ClassicParams): void {
  if (flap) b.vy = p.flapVy;
  else b.vy = Math.min(b.vy + p.gravity * dt, p.vMax);
  b.y += b.vy * dt;
}

/** Pitch for rendering: θ = clamp(vy / vMax · 35°, −30°, +35°). */
export function tiltDeg(vy: number, vMax: number, maxDeg = 35): number {
  return clamp((vy / vMax) * maxDeg, -30, 35);
}
