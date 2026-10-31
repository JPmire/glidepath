import { describe, expect, it } from 'vitest';
import { OneEuroFilter, smoothingAlpha } from './oneEuroFilter';

// Deterministic PRNG + Box-Muller so jitter assertions are reproducible.
function gaussian(seed: number): () => number {
  let s = seed >>> 0;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) + 1) / 4294967297;
  return () => Math.sqrt(-2 * Math.log(rand())) * Math.cos(2 * Math.PI * rand());
}

const rms = (xs: number[], mean: number) =>
  Math.sqrt(xs.reduce((a, x) => a + (x - mean) ** 2, 0) / xs.length);

describe('smoothingAlpha', () => {
  it('follows alpha = 1 / (1 + 1/(2*pi*fc*dt))', () => {
    expect(smoothingAlpha(1, 1 / 30)).toBeCloseTo(1 / (1 + 30 / (2 * Math.PI)), 10);
  });
});

describe('OneEuroFilter', () => {
  it('passes the first sample through unchanged', () => {
    const f = new OneEuroFilter();
    expect(f.filter(123, 0)).toBe(123);
  });

  it('cuts stationary 4 px gaussian jitter by more than half at 30 FPS', () => {
    const noise = gaussian(42);
    const f = new OneEuroFilter(1.0, 0.015, 1.0);
    const raw: number[] = [];
    const out: number[] = [];
    for (let k = 0; k < 600; k++) {
      const y = 360 + 4 * noise();
      raw.push(y);
      out.push(f.filter(y, k / 30));
    }
    const settled = out.slice(60);
    expect(rms(settled, 360)).toBeLessThan(rms(raw.slice(60), 360) * 0.5);
  });

  it('tracks a fast 300 px step within 3 webcam frames (adaptive cutoff)', () => {
    const f = new OneEuroFilter(1.0, 0.015, 1.0);
    for (let k = 0; k < 30; k++) f.filter(200, k / 30);
    let frames = 0;
    let y = 200;
    while (y < 200 + 0.9 * 300 && frames < 30) {
      frames++;
      y = f.filter(500, (30 + frames) / 30);
    }
    expect(frames).toBeLessThanOrEqual(3);
  });

  it('is far less laggy than heavy EMA on the same step', () => {
    const f = new OneEuroFilter(1.0, 0.015, 1.0);
    f.filter(0, 0);
    const oneEuro = f.filter(300, 1 / 30);
    const ema = 0.2 * 300; // EMA alpha=0.2 after one frame
    expect(oneEuro).toBeGreaterThan(ema * 3);
  });

  it('reset() forgets history', () => {
    const f = new OneEuroFilter();
    f.filter(0, 0);
    f.filter(10, 0.033);
    f.reset();
    expect(f.filter(999, 5)).toBe(999);
  });

  it('survives duplicate timestamps without NaN', () => {
    const f = new OneEuroFilter();
    f.filter(1, 1);
    expect(Number.isFinite(f.filter(2, 1))).toBe(true);
  });
});
