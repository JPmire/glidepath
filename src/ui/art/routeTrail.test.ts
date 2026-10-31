import { describe, expect, it } from 'vitest';
import { RouteTrail, RunRoute } from './routeTrail';

describe('RouteTrail', () => {
  it('scrolls points left and spaces new ones by distance travelled', () => {
    const t = new RouteTrail(6);
    for (let i = 0; i < 30; i++) t.step(250, 300 + i, 2);
    // 60 px travelled at 6 px spacing → about 10 points, oldest furthest left.
    expect(t.points.length).toBeGreaterThanOrEqual(9);
    expect(t.points.length).toBeLessThanOrEqual(11);
    expect(t.points[0].x).toBeLessThan(t.points[t.points.length - 1].x);
  });

  it('forgets points once they scroll off screen', () => {
    const t = new RouteTrail(6);
    for (let i = 0; i < 2000; i++) t.step(250, 300, 4);
    expect(t.points.every((p) => p.x >= -20)).toBe(true);
    expect(t.points.length).toBeLessThan(80);
  });

  it('still drops a point when standing still, so the head stays attached', () => {
    const t = new RouteTrail(6);
    t.step(250, 300, 0);
    expect(t.points).toHaveLength(1);
  });
});

describe('RunRoute', () => {
  it('stays bounded on a very long run and keeps the start', () => {
    const r = new RunRoute(10, 400);
    for (let i = 0; i < 200_000; i++) r.record(3, 300 + Math.sin(i / 50) * 100);
    expect(r.points.length).toBeLessThanOrEqual(400);
    expect(r.points.length).toBeGreaterThan(150);
    expect(r.points[0].x).toBe(3); // the very first sample is kept through every halving
  });

  it('distance is monotonic', () => {
    const r = new RunRoute();
    for (let i = 0; i < 5000; i++) r.record(2.5, 300);
    for (let i = 1; i < r.points.length; i++) expect(r.points[i].x).toBeGreaterThan(r.points[i - 1].x);
  });

  it('reset clears everything', () => {
    const r = new RunRoute();
    for (let i = 0; i < 100; i++) r.record(5, 300);
    r.reset();
    expect(r.points).toHaveLength(0);
  });
});
