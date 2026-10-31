import type { Vec3 } from '../math/postureValidator';

/**
 * Synthetic 21-point hands for tests. World landmarks are metric (wrist at origin, y down,
 * −z toward the camera, like MediaPipe). Image landmarks are an orthographic projection into
 * normalized 16:9 frame coordinates, so 2D checks see realistic foreshortening.
 */
export interface FixtureOptions {
  /** Fingers extended, by index 0..3 (index, middle, ring, pinky). Others are curled. */
  extended?: [boolean, boolean, boolean, boolean];
  /** Index pitch toward the camera in degrees (0 = pointing straight up the image). */
  indexPitchDeg?: number;
  /** Model mispredicts the pointing index as curled in 3D (common when aiming at the lens). */
  indexWorldCurled?: boolean;
  /** Thumb tip placed on the index finger's middle joint. */
  thumbOnIndex?: boolean;
  /** Image-space offset of the wrist (hand translation). */
  at?: { x: number; y: number };
}

const SEGMENTS = [0.04, 0.025, 0.02]; // MCP→PIP, PIP→DIP, DIP→TIP (m)
const CURL = [70, 100, 60]; // joint flexion in a curled finger (deg)

function chain(base: Vec3, extended: boolean, pitchDeg: number): Vec3[] {
  const pts = [base];
  let angle = extended ? pitchDeg : 0;
  let p = base;
  SEGMENTS.forEach((len, j) => {
    if (!extended) angle += CURL[j];
    const r = (angle * Math.PI) / 180;
    p = { x: p.x, y: p.y - Math.cos(r) * len, z: p.z - Math.sin(r) * len };
    pts.push(p);
  });
  return pts;
}

export function makeHand(opts: FixtureOptions = {}): { world: Vec3[]; image: Vec3[] } {
  const ext = opts.extended ?? [true, false, false, false];
  const world: Vec3[] = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));
  // Thumb: resting out to the side.
  [1, 2, 3, 4].forEach((idx, j) => (world[idx] = { x: 0.03 + j * 0.012, y: -0.02 - j * 0.015, z: -0.01 }));

  const imageWorld = world.map((p) => ({ ...p }));
  for (let f = 0; f < 4; f++) {
    const base = { x: 0.03 - f * 0.02, y: -0.08, z: 0 };
    const pitch = f === 0 ? (opts.indexPitchDeg ?? 0) : 0;
    const truth = chain(base, ext[f], pitch);
    const predicted = f === 0 && opts.indexWorldCurled ? chain(base, false, 0) : truth;
    for (let j = 0; j < 4; j++) {
      world[5 + f * 4 + j] = predicted[j];
      imageWorld[5 + f * 4 + j] = truth[j];
    }
  }
  if (opts.thumbOnIndex) {
    world[4] = { ...world[6], z: world[6].z - 0.008 };
    imageWorld[4] = { ...imageWorld[6] };
  }

  const at = opts.at ?? { x: 0.5, y: 0.75 };
  const image = imageWorld.map((p) => ({ x: at.x + p.x * 2.5 * (9 / 16), y: at.y + p.y * 2.5, z: p.z }));
  return { world, image };
}
