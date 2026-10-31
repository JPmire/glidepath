/**
 * Posture checks on MediaPipe landmarks.
 *
 * Pointing at the lens foreshortens the index finger; the 3D model then often predicts it as
 * curled, making "pointing" and "fist" indistinguishable. So the only pause gesture is an OPEN
 * PALM, which requires the middle/ring/pinky fingers to be extended — something a pointing hand
 * never does, whatever its pitch. Every other hand shape steers.
 */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type Posture = 'STEER' | 'OPEN_PALM';
export type FingerChain = readonly [number, number, number, number];

export const FINGERS = {
  index: [5, 6, 7, 8],
  middle: [9, 10, 11, 12],
  ring: [13, 14, 15, 16],
  pinky: [17, 18, 19, 20],
} as const satisfies Record<string, FingerChain>;

export const EXTENDED_MAX_BEND_DEG = 70;
export const EXTENDED_MIN_REACH = 1.5;
const IMAGE_ASPECT = 16 / 9;

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const norm = (a: Vec3) => Math.sqrt(dot(a, a));

function angleDeg(a: Vec3, b: Vec3): number {
  const d = norm(a) * norm(b);
  if (d < 1e-12) return 180;
  return (Math.acos(Math.max(-1, Math.min(1, dot(a, b) / d))) * 180) / Math.PI;
}

/** Total flexion along wrist→MCP→PIP→DIP→TIP in 3D. ~0–40° straight, >150° curled. */
export function fingerBendDeg(world: Vec3[], [mcp, pip, dip, tip]: FingerChain): number {
  const segs = [sub(world[mcp], world[0]), sub(world[pip], world[mcp]), sub(world[dip], world[pip]), sub(world[tip], world[dip])];
  return angleDeg(segs[0], segs[1]) + angleDeg(segs[1], segs[2]) + angleDeg(segs[2], segs[3]);
}

/** 2D reach: |tip − wrist| / |mcp − wrist| in aspect-corrected image space. Extended ≈ 2. */
export function fingerReach2D(image: Vec3[], [mcp, , , tip]: FingerChain): number {
  const d = (a: Vec3, b: Vec3) => Math.hypot((a.x - b.x) * IMAGE_ASPECT, a.y - b.y);
  const base = d(image[mcp], image[0]);
  return base < 1e-9 ? 0 : d(image[tip], image[0]) / base;
}

/** Extended only when the 3D model AND the 2D silhouette agree. */
export function fingerExtended(world: Vec3[], image: Vec3[], chain: FingerChain): boolean {
  return fingerBendDeg(world, chain) < EXTENDED_MAX_BEND_DEG && fingerReach2D(image, chain) > EXTENDED_MIN_REACH;
}

export function isOpenPalm(world: Vec3[], image: Vec3[]): boolean {
  return (
    fingerExtended(world, image, FINGERS.middle) &&
    fingerExtended(world, image, FINGERS.ring) &&
    fingerExtended(world, image, FINGERS.pinky)
  );
}

export function classifyPosture(world: Vec3[], image: Vec3[]): Posture {
  if (world.length < 21 || image.length < 21) return 'STEER';
  return isOpenPalm(world, image) ? 'OPEN_PALM' : 'STEER';
}

function pointSegmentDistance(p: Vec3, a: Vec3, b: Vec3): number {
  const ab = sub(b, a);
  const len2 = dot(ab, ab);
  const t = len2 < 1e-12 ? 0 : Math.max(0, Math.min(1, dot(sub(p, a), ab) / len2));
  return norm(sub(p, { x: a.x + ab.x * t, y: a.y + ab.y * t, z: a.z + ab.z * t }));
}

/**
 * Distance from the thumb tip to the nearest point on the index finger (MCP→TIP polyline),
 * divided by palm length |wrist − middle MCP|. Metric 3D, so independent of hand distance.
 */
export function thumbTouchRatio(world: Vec3[]): number {
  const palm = norm(sub(world[9], world[0]));
  if (palm < 1e-9) return Infinity;
  const [a, b, c, d] = FINGERS.index;
  const dist = Math.min(
    pointSegmentDistance(world[4], world[a], world[b]),
    pointSegmentDistance(world[4], world[b], world[c]),
    pointSegmentDistance(world[4], world[c], world[d]),
  );
  return dist / palm;
}
