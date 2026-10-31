/** Seeded hand-drawn jitter. Pure: computed once at build/spawn time, never per frame. */

export interface Pt {
  x: number;
  y: number;
}

/** mulberry32: tiny deterministic PRNG returning [0, 1). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Rectangle outline whose edges wobble *inward only* by up to `amp`, so the art never exceeds
 * the collision rect it stands for.
 */
export function wobbleRect(x: number, y: number, w: number, h: number, seed: number, amp = 1.5, step = 14): Pt[] {
  const r = rng(seed);
  const inset = () => r() * amp;
  const pts: Pt[] = [];
  const edge = (n: number, at: (t: number, d: number) => Pt) => {
    for (let i = 0; i < n; i++) pts.push(at(i / n, inset()));
  };
  const nx = Math.max(1, Math.round(w / step));
  const ny = Math.max(1, Math.round(h / step));
  edge(nx, (t, d) => ({ x: x + t * w, y: y + d }));
  edge(ny, (t, d) => ({ x: x + w - d, y: y + t * h }));
  edge(nx, (t, d) => ({ x: x + w - t * w, y: y + h - d }));
  edge(ny, (t, d) => ({ x: x + d, y: y + h - t * h }));
  return pts;
}

/** Displace each point by up to ±amp in both axes. */
export function jitter(points: readonly Pt[], seed: number, amp: number): Pt[] {
  const r = rng(seed);
  return points.map((p) => ({ x: p.x + (r() * 2 - 1) * amp, y: p.y + (r() * 2 - 1) * amp }));
}

/** Points around a circle with a wobbling radius (sun, stamps, postmark rings). */
export function wobbleCircle(cx: number, cy: number, radius: number, seed: number, amp = 1.5, n = 36): Pt[] {
  const r = rng(seed);
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const rr = radius + (r() * 2 - 1) * amp;
    return { x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr };
  });
}

export function polyPath(points: readonly Pt[], close = true): Path2D {
  const p = new Path2D();
  points.forEach((pt, i) => (i ? p.lineTo(pt.x, pt.y) : p.moveTo(pt.x, pt.y)));
  if (close) p.closePath();
  return p;
}
