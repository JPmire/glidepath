import { describe, expect, it } from 'vitest';
import { mapVertical, type VerticalCalibration } from '../math/verticalCalibration';
import type { GestureSnapshot } from '../vision/gestureInterpreter';
import { CalibrationWizard, TARGET_YS } from './calibrationOverlay';

function noise(seed: number) {
  let s = seed;
  return () => (((s = (s * 16807) % 2147483647) / 2147483647) - 0.5) * 2;
}

const snap = (v: number, posture: GestureSnapshot['posture'] = 'STEER'): GestureSnapshot => ({
  handPresent: posture !== 'NO_HAND', posture, feature: { x: 0.5, y: v }, targetY: 0, pauseHeld: false, touching: false, flapStart: false,
});

/** Simulates a player aiming at each marker with tremor, moving between targets. */
function run(w: CalibrationWizard, vs: number[], tremor: number, glitchEvery = 0): void {
  const rnd = noise(7);
  let frame = 0;
  for (const v of vs) {
    for (let i = 0; i < 90; i++) {
      frame++;
      const glitch = glitchEvery && frame % glitchEvery === 0 ? 0.2 : 0;
      w.onSample(snap(v + tremor * rnd() + glitch), 1 / 30);
    }
  }
}

describe('CalibrationWizard', () => {
  it('completes from 3 steady-ish holds with realistic tremor and occasional glitches', () => {
    let result: VerticalCalibration | null = null;
    const w = new CalibrationWizard((c) => (result = c));
    run(w, [0.3, 0.45, 0.62], 0.012, 17);
    expect(result).not.toBeNull();
    const cal = result!;
    // Within 12 px of the markers (gate gaps are 130–165 px).
    expect(Math.abs(mapVertical(cal, 0.3) - TARGET_YS[0])).toBeLessThan(12);
    expect(Math.abs(mapVertical(cal, 0.62) - TARGET_YS[2])).toBeLessThan(12);
  });

  it('does not double-capture the same pose; waits for the finger to move', () => {
    const w = new CalibrationWizard(() => {});
    run(w, [0.3], 0.004);
    expect(w.index).toBe(1);
    run(w, [0.3], 0.004);
    expect(w.index).toBe(1);
  });

  it('ignores the open palm and lost hand', () => {
    const w = new CalibrationWizard(() => {});
    for (let i = 0; i < 90; i++) w.onSample(snap(0.3, 'OPEN_PALM'), 1 / 30);
    for (let i = 0; i < 90; i++) w.onSample(snap(0.3, 'NO_HAND'), 1 / 30);
    expect(w.index).toBe(0);
  });

  it('Space captures immediately', () => {
    const w = new CalibrationWizard(() => {});
    for (let i = 0; i < 5; i++) w.onSample(snap(0.4 + i * 0.01), 1 / 30);
    w.captureNow();
    expect(w.index).toBe(1);
  });

  it('restarts with a message when the captures have no vertical spread', () => {
    const w = new CalibrationWizard(() => {});
    for (const v of [0.4, 0.43, 0.41]) {
      for (let i = 0; i < 6; i++) w.onSample(snap(v), 1 / 30);
      w.captureNow();
      for (let i = 0; i < 20; i++) w.onSample(snap(v), 1 / 30); // cooldown
    }
    expect(w.index).toBe(0);
    expect(w.message).toMatch(/too close/);
  });
});
