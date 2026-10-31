import { describe, expect, it } from 'vitest';
import { defaultCalibration, fitVertical, mapVertical } from './verticalCalibration';

describe('fitVertical / mapVertical', () => {
  const cal = fitVertical([
    { v: 0.3, y: 100 },
    { v: 0.62, y: 572 },
    { v: 0.4, y: 336 },
  ]);

  it('passes exactly through every control point', () => {
    expect(mapVertical(cal, 0.3)).toBeCloseTo(100, 9);
    expect(mapVertical(cal, 0.4)).toBeCloseTo(336, 9);
    expect(mapVertical(cal, 0.62)).toBeCloseTo(572, 9);
  });

  it('captures a non-linear (wrist pivot) response between points', () => {
    expect(mapVertical(cal, 0.35)).toBeCloseTo(218, 9); // upper segment is steep
    expect(mapVertical(cal, 0.51)).toBeCloseTo(454, 9); // lower segment is shallow
  });

  it('extrapolates linearly past the ends', () => {
    expect(mapVertical(cal, 0.25)).toBeCloseTo(-18, 9);
    expect(mapVertical(cal, 0.73)).toBeCloseTo(690, 9);
  });

  it('drops a fumbled middle capture that breaks monotonicity', () => {
    const c = fitVertical([
      { v: 0.3, y: 100 },
      { v: 0.25, y: 336 },
      { v: 0.6, y: 572 },
    ]);
    expect(c.v).toEqual([0.3, 0.6]);
  });

  it('rejects captures with no vertical spread', () => {
    expect(() =>
      fitVertical([
        { v: 0.5, y: 100 },
        { v: 0.51, y: 572 },
      ]),
    ).toThrow(/too close/);
  });

  it('default maps the ergonomic band to the play area', () => {
    const d = defaultCalibration(672);
    expect(mapVertical(d, 0.2)).toBe(0);
    expect(mapVertical(d, 0.75)).toBeCloseTo(672, 9);
  });
});
