import { describe, expect, it } from 'vitest';
import { jitter, rng, wobbleCircle, wobbleRect } from './wobble';

describe('rng', () => {
  it('is deterministic per seed and stays in [0, 1)', () => {
    const a = rng(42);
    const b = rng(42);
    for (let i = 0; i < 100; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('differs between seeds', () => {
    expect(rng(1)()).not.toBe(rng(2)());
  });
});

describe('wobbleRect', () => {
  it('never leaves the collision rect', () => {
    for (let seed = 0; seed < 50; seed++) {
      for (const p of wobbleRect(100, 40, 78, 300, seed, 2)) {
        expect(p.x).toBeGreaterThanOrEqual(100);
        expect(p.x).toBeLessThanOrEqual(178);
        expect(p.y).toBeGreaterThanOrEqual(40);
        expect(p.y).toBeLessThanOrEqual(340);
      }
    }
  });

  it('is identical for the same seed (no boiling unless asked)', () => {
    expect(wobbleRect(0, 0, 50, 50, 7)).toEqual(wobbleRect(0, 0, 50, 50, 7));
  });
});

describe('jitter / wobbleCircle', () => {
  it('displaces by at most amp', () => {
    const src = [{ x: 0, y: 0 }, { x: 10, y: 5 }];
    for (const [i, p] of jitter(src, 3, 1.5).entries()) {
      expect(Math.abs(p.x - src[i].x)).toBeLessThanOrEqual(1.5);
      expect(Math.abs(p.y - src[i].y)).toBeLessThanOrEqual(1.5);
    }
  });

  it('keeps the radius within amp', () => {
    for (const p of wobbleCircle(0, 0, 20, 9, 2)) {
      expect(Math.hypot(p.x, p.y)).toBeGreaterThanOrEqual(18 - 1e-9);
      expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(22 + 1e-9);
    }
  });
});
