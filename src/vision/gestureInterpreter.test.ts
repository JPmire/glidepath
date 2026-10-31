import { describe, expect, it } from 'vitest';
import { makeHand, type FixtureOptions } from '../test/handFixture';
import { DROPOUT_HOLD_MS, GestureInterpreter, PALM_HOLD_MS } from './gestureInterpreter';
import type { HandResult } from './types';

function hand(opts: FixtureOptions = {}): HandResult {
  const { world, image } = makeHand(opts);
  return { landmarks: image, worldLandmarks: world, handedness: 'Right', score: 0.9 };
}
const palm = () => hand({ extended: [true, true, true, true] });

describe('GestureInterpreter', () => {
  it('reports NO_HAND when no hand has been seen', () => {
    const g = new GestureInterpreter(672);
    expect(g.update(null, 0)).toMatchObject({ handPresent: false, posture: 'NO_HAND', targetY: null });
  });

  it('steers with a pointing hand, including when aimed at the lens', () => {
    const g = new GestureInterpreter(672);
    for (const pitch of [0, 45, 80]) {
      const s = g.update(hand({ indexPitchDeg: pitch, indexWorldCurled: pitch > 60 }), pitch);
      expect(s.posture).toBe('STEER');
      expect(s.pauseHeld).toBe(false);
      expect(s.targetY).not.toBeNull();
    }
  });

  it('maps higher hands to higher (smaller) altitude', () => {
    const g = new GestureInterpreter(672);
    const high = g.update(hand({ at: { x: 0.5, y: 0.6 } }), 0).targetY!;
    const g2 = new GestureInterpreter(672);
    const low = g2.update(hand({ at: { x: 0.5, y: 0.9 } }), 0).targetY!;
    expect(high).toBeLessThan(low);
  });

  it(`pauses only after an open palm is held ${PALM_HOLD_MS} ms, and freezes the target meanwhile`, () => {
    const g = new GestureInterpreter(672);
    const y0 = g.update(hand(), 0).targetY;
    expect(g.update(palm(), 33).pauseHeld).toBe(false);
    expect(g.update(palm(), 33 + PALM_HOLD_MS - 1).pauseHeld).toBe(false);
    const s = g.update(palm(), 33 + PALM_HOLD_MS);
    expect(s.pauseHeld).toBe(true);
    expect(s.targetY).toBe(y0);
    expect(g.update(hand(), 600).pauseHeld).toBe(false);
  });

  it('a closed fist never pauses', () => {
    const g = new GestureInterpreter(672);
    for (let t = 0; t < 1000; t += 33) expect(g.update(hand({ extended: [false, false, false, false] }), t).pauseHeld).toBe(false);
  });

  it(`bridges tracking dropouts up to ${DROPOUT_HOLD_MS} ms`, () => {
    const g = new GestureInterpreter(672);
    const y = g.update(hand(), 0).targetY;
    expect(g.update(null, DROPOUT_HOLD_MS)).toMatchObject({ handPresent: true, targetY: y });
    expect(g.update(null, DROPOUT_HOLD_MS + 50).handPresent).toBe(false);
  });

  it('emits one flapStart per thumb tap, with hysteresis and a refractory period', () => {
    const g = new GestureInterpreter(672);
    expect(g.update(hand(), 0).flapStart).toBe(false);
    expect(g.update(hand({ thumbOnIndex: true }), 33).flapStart).toBe(true);
    expect(g.update(hand({ thumbOnIndex: true }), 66).flapStart).toBe(false);
    expect(g.update(hand(), 99).touching).toBe(false);
    expect(g.update(hand({ thumbOnIndex: true }), 120).flapStart).toBe(false); // refractory
    g.update(hand(), 200);
    expect(g.update(hand({ thumbOnIndex: true }), 300).flapStart).toBe(true);
  });
});
