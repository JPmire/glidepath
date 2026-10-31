import { describe, expect, it } from 'vitest';
import { makeHand } from '../test/handFixture';
import { classifyPosture, fingerBendDeg, fingerExtended, FINGERS, thumbTouchRatio } from './postureValidator';

describe('fingerBendDeg', () => {
  it('is small for a straight finger and large for a curled one', () => {
    const { world } = makeHand({ extended: [true, false, false, false] });
    expect(fingerBendDeg(world, FINGERS.index)).toBeLessThan(30);
    expect(fingerBendDeg(world, FINGERS.middle)).toBeGreaterThan(150);
  });
});

describe('fingerExtended', () => {
  it('needs both the 3D bend and the 2D reach to agree', () => {
    const palm = makeHand({ extended: [true, true, true, true] });
    expect(fingerExtended(palm.world, palm.image, FINGERS.middle)).toBe(true);
    const point = makeHand();
    expect(fingerExtended(point.world, point.image, FINGERS.middle)).toBe(false);
  });
});

describe('classifyPosture', () => {
  it('detects an open palm', () => {
    const { world, image } = makeHand({ extended: [true, true, true, true] });
    expect(classifyPosture(world, image)).toBe('OPEN_PALM');
  });

  it.each([0, 20, 45, 70, 85])('pointing pitched %i° toward the camera is STEER, never a pause', (pitch) => {
    const { world, image } = makeHand({ indexPitchDeg: pitch });
    expect(classifyPosture(world, image)).toBe('STEER');
  });

  it('a pointing index mispredicted as curled in 3D is still STEER', () => {
    const { world, image } = makeHand({ indexPitchDeg: 70, indexWorldCurled: true });
    expect(classifyPosture(world, image)).toBe('STEER');
  });

  it('a fist and a peace sign are STEER (only an open palm pauses)', () => {
    const fist = makeHand({ extended: [false, false, false, false] });
    expect(classifyPosture(fist.world, fist.image)).toBe('STEER');
    const peace = makeHand({ extended: [true, true, false, false] });
    expect(classifyPosture(peace.world, peace.image)).toBe('STEER');
  });

  it('rejects incomplete landmark sets', () => {
    expect(classifyPosture([], [])).toBe('STEER');
  });
});

describe('thumbTouchRatio', () => {
  it('is small when the thumb touches the index finger and large when it rests aside', () => {
    expect(thumbTouchRatio(makeHand({ thumbOnIndex: true }).world)).toBeLessThan(0.15);
    expect(thumbTouchRatio(makeHand().world)).toBeGreaterThan(0.45);
  });

  it('works while pointing at the lens (scale-invariant 3D measure)', () => {
    expect(thumbTouchRatio(makeHand({ thumbOnIndex: true, indexPitchDeg: 60 }).world)).toBeLessThan(0.15);
  });
});
