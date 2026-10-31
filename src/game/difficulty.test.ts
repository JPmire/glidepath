import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, DIFFICULTY_ORDER, difficultyFor, rulesFor } from './difficulty';
import { makeGate, nextGapY, stepDrift } from './gameRules';

const FLOOR = 672;

describe('routes', () => {
  it('ramp from the opening values to the final ones, then hold', () => {
    const d = DIFFICULTIES.AIRMAIL;
    expect(rulesFor(d, 0).speed).toBe(d.speed.from);
    expect(rulesFor(d, d.rampGates / 2).speed).toBeCloseTo((d.speed.from + d.speed.to) / 2);
    expect(rulesFor(d, d.rampGates).gapH).toBe(d.gap.to);
    expect(rulesFor(d, 10_000)).toEqual(rulesFor(d, d.rampGates));
  });

  it('get harder in order: faster, tighter, closer, bigger swings', () => {
    for (let i = 1; i < DIFFICULTY_ORDER.length; i++) {
      const [easy, hard] = [DIFFICULTIES[DIFFICULTY_ORDER[i - 1]], DIFFICULTIES[DIFFICULTY_ORDER[i]]];
      for (const k of ['from', 'to'] as const) {
        expect(hard.speed[k]).toBeGreaterThan(easy.speed[k]);
        expect(hard.gap[k]).toBeLessThan(easy.gap[k]);
        expect(hard.spawnSec[k]).toBeLessThan(easy.spawnSec[k]);
        expect(hard.minShift[k]).toBeGreaterThan(easy.minShift[k]);
      }
      expect(hard.driftFrom).toBeLessThan(easy.driftFrom);
    }
  });

  it('no drifting gates before the route allows them', () => {
    const d = DIFFICULTIES.AIRMAIL;
    expect(rulesFor(d, d.driftFrom - 1).driftChance).toBe(0);
    expect(rulesFor(d, d.driftFrom).driftChance).toBe(d.driftChance.from);
  });

  it('falls back to the default route for unknown ids', () => {
    expect(difficultyFor('NOPE').id).toBe('AIRMAIL');
    expect(difficultyFor('STORM').id).toBe('STORM');
  });

  it('every route leaves the glider room to fit through the tightest gap', () => {
    for (const id of DIFFICULTY_ORDER) expect(DIFFICULTIES[id].gap.to).toBeGreaterThan(17 * 2 + 60);
  });
});

describe('nextGapY', () => {
  const lim = { minShift: 150, maxShift: 400 };
  it('swings at least minShift and at most maxShift from the last gap', () => {
    for (let r = 0; r < 1; r += 0.01) {
      const y = nextGapY(r, 336, 140, FLOOR, lim);
      expect(Math.abs(y - 336)).toBeGreaterThanOrEqual(150 - 1e-9);
      expect(Math.abs(y - 336)).toBeLessThanOrEqual(400 + 1e-9);
    }
  });

  it('from near the ceiling it can only swing down', () => {
    for (let r = 0; r < 1; r += 0.05) expect(nextGapY(r, 140, 140, FLOOR, lim)).toBeGreaterThan(140 + 149);
  });

  it('falls back to a legal height when no far-enough one exists', () => {
    const y = nextGapY(0.5, 336, 140, FLOOR, { minShift: 1000, maxShift: 1200 });
    expect(y).toBeGreaterThanOrEqual(60 + 70);
    expect(y).toBeLessThanOrEqual(FLOOR - 60 - 70);
  });
});

describe('drifting gates', () => {
  it('slide around their base, within the amplitude', () => {
    const rules = { ...rulesFor(DIFFICULTIES.STORM, 0), driftChance: 1 };
    const g = makeGate(1, 336, rules, FLOOR, () => 0.3);
    expect(g.drift).toBeDefined();
    const seen = new Set<number>();
    for (let i = 0; i < 400; i++) {
      stepDrift(g, 1 / 120);
      expect(Math.abs(g.gapY - g.drift!.baseY)).toBeLessThanOrEqual(g.drift!.amp + 1e-9);
      seen.add(Math.round(g.gapY));
    }
    expect(seen.size).toBeGreaterThan(20);
  });

  it('a gate that rolls above the drift chance stays still', () => {
    const rules = { ...rulesFor(DIFFICULTIES.STORM, 0), driftChance: 0.2 };
    const g = makeGate(1, 336, rules, FLOOR, () => 0.9);
    expect(g.drift).toBeUndefined();
  });
});
