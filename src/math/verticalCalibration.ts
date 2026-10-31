/**
 * Maps the steering feature's vertical coordinate v (normalized camera space) to canvas Y.
 *
 * Only altitude matters in the game, so calibration samples a few targets along the column the
 * player actually aims at and fits a monotone piecewise-linear curve. Unlike a single projective
 * homography this follows the non-linear wrist-pivot response, and needs fewer captures.
 */
export interface VerticalCalibration {
  /** Feature v at each control point, strictly increasing. */
  v: number[];
  /** Canvas Y at each control point, strictly increasing. */
  y: number[];
}

export const MIN_SPAN = 0.04;

/** Uncalibrated default: v ∈ [0.20, 0.75] stretched over the play area. */
export function defaultCalibration(playHeight: number): VerticalCalibration {
  return { v: [0.2, 0.75], y: [0, playHeight] };
}

export function fitVertical(samples: ReadonlyArray<{ v: number; y: number }>): VerticalCalibration {
  if (samples.length < 2) throw new Error('Need at least two calibration points.');
  const pts = [...samples].sort((a, b) => a.y - b.y);
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (last.v - first.v < MIN_SPAN) {
    throw new Error('Top and bottom were too close. Move your finger further between targets.');
  }
  // Keep the endpoints; drop interior points that break monotonicity (a fumbled capture).
  const kept = [first];
  for (const p of pts.slice(1, -1)) {
    if (p.v > kept[kept.length - 1].v + 1e-3 && p.v < last.v - 1e-3) kept.push(p);
  }
  kept.push(last);
  return { v: kept.map((p) => p.v), y: kept.map((p) => p.y) };
}

/** Piecewise-linear interpolation; linear extrapolation beyond the ends using the end segments. */
export function mapVertical(cal: VerticalCalibration, v: number): number {
  const { v: vs, y: ys } = cal;
  let i = 0;
  while (i < vs.length - 2 && v > vs[i + 1]) i++;
  const t = (v - vs[i]) / (vs[i + 1] - vs[i]);
  return ys[i] + t * (ys[i + 1] - ys[i]);
}
