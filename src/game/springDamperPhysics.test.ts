import { describe, expect, it } from 'vitest';
import { OneEuroFilter } from '../math/oneEuroFilter';
import { stepClassic, stepFollow, tiltDeg, type GliderBody } from './springDamperPhysics';

const follow = { omegaN: 20, zeta: 1, vMax: 850 };
const body = (y = 360, vy = 0): GliderBody => ({ y, vy });

describe('stepFollow (critically damped spring-damper)', () => {
  it('converges to the target without overshoot', () => {
    const b = body(200);
    let maxY = -Infinity;
    for (let i = 0; i < 240; i++) {
      stepFollow(b, 450, 1 / 120, follow);
      maxY = Math.max(maxY, b.y);
    }
    expect(b.y).toBeCloseTo(450, 1);
    expect(maxY).toBeLessThanOrEqual(450 + 1e-6);
  });

  it('never exceeds vMax', () => {
    const b = body(0);
    for (let i = 0; i < 60; i++) {
      stepFollow(b, 720, 1 / 120, follow);
      expect(Math.abs(b.vy)).toBeLessThanOrEqual(850);
    }
  });

  it('is frame-rate independent: 60 Hz and 120 Hz agree after 0.5 s', () => {
    const a = body(100);
    const c = body(100);
    for (let i = 0; i < 60; i++) stepFollow(a, 500, 1 / 120, follow);
    for (let i = 0; i < 30; i++) stepFollow(c, 500, 1 / 60, follow);
    expect(Math.abs(a.y - c.y)).toBeLessThan(6);
  });

  it('bounds per-frame velocity step on a 250 px dodge (30 FPS 1-Euro target -> 120 Hz)', () => {
    const filter = new OneEuroFilter(1.2, 0.015, 1.0);
    for (let k = 0; k < 30; k++) filter.filter(300, k / 30);
    const b = body(300);
    let target = 300;
    let prevVy = 0;
    let maxStep = 0;
    for (let i = 0; i < 120; i++) {
      if (i % 4 === 0) target = filter.filter(550, 1 + i / 120); // new camera frame every 4 renders
      stepFollow(b, target, 1 / 120, follow);
      maxStep = Math.max(maxStep, Math.abs(b.vy - prevVy) / 120);
      prevVy = b.vy;
    }
    // Raw (unfiltered) 250 px step peaks at ~6.94 px/frame²; filtered input must be gentler.
    expect(maxStep).toBeLessThan(6);
  });
});

describe('stepClassic (gravity + flap)', () => {
  it('falls under gravity', () => {
    const b = body(100);
    stepClassic(b, false, 0.1, { gravity: 1400, flapVy: -460, vMax: 850 });
    expect(b.vy).toBeCloseTo(140, 6);
    expect(b.y).toBeGreaterThan(100);
  });
  it('flap sets an upward impulse', () => {
    const b = body(300, 400);
    stepClassic(b, true, 1 / 120, { gravity: 1400, flapVy: -460, vMax: 850 });
    expect(b.vy).toBeLessThan(-440);
    expect(b.y).toBeLessThan(300);
  });
});

describe('tiltDeg', () => {
  it('maps vy/vMax to ±35° and clamps to [-30°, +35°]', () => {
    expect(tiltDeg(0, 850)).toBe(0);
    expect(tiltDeg(850, 850)).toBe(35);
    expect(tiltDeg(-850, 850)).toBe(-30);
  });
});
