/**
 * Routes (difficulty presets) and the per-gate ramp. Every quantity eases from `from` to `to` over
 * the route's first `rampGates` gates, then holds. Pure; no DOM.
 */
export type DifficultyId = 'POSTCARD' | 'AIRMAIL' | 'EXPRESS' | 'STORM';

/** A value that eases from `from` (gate 0) to `to` (end of the ramp). */
export interface Ramp {
  from: number;
  to: number;
}

export interface Difficulty {
  id: DifficultyId;
  name: string;
  blurb: string;
  /** Gates over which every ramp runs from `from` to `to`. */
  rampGates: number;
  speed: Ramp; // px/s
  gap: Ramp; // gap height, px
  spawnSec: Ramp; // seconds between gates
  /** Gap centre moves at least `minShift` and at most `maxShift` from the last gate (px). */
  minShift: Ramp;
  maxShift: Ramp;
  /** Drifting gates appear from this gate on (Infinity = never), then ramp in until `rampGates`. */
  driftFrom: number;
  driftChance: Ramp; // 0–1, per gate
  driftAmp: Ramp; // px either side of the base centre
  /** Full up-and-down cycles per second. Peak sway (2π·hz·amp) stays near 250 px/s at most so a
   *  gap can still be tracked through camera + spring lag; the challenge is where it will be. */
  driftHz: Ramp;
}

/** What the next gate looks like at a given score. */
export interface GateRules {
  speed: number;
  gapH: number;
  spawnSec: number;
  minShift: number;
  maxShift: number;
  driftChance: number;
  driftAmp: number;
  driftHz: number;
}

const r = (from: number, to: number): Ramp => ({ from, to });

export const DIFFICULTIES: Record<DifficultyId, Difficulty> = {
  POSTCARD: {
    id: 'POSTCARD', name: 'Postcard', blurb: 'Unhurried. Wide gaps, gentle climbs.',
    rampGates: 60, speed: r(230, 340), gap: r(200, 165), spawnSec: r(1.65, 1.4),
    minShift: r(0, 60), maxShift: r(180, 280),
    driftFrom: 30, driftChance: r(0.15, 0.3), driftAmp: r(25, 45), driftHz: r(0.2, 0.25),
  },
  AIRMAIL: {
    id: 'AIRMAIL', name: 'Airmail', blurb: 'The usual route. Speeds up; chimneys start to sway.',
    rampGates: 50, speed: r(280, 450), gap: r(165, 135), spawnSec: r(1.45, 1.15),
    minShift: r(40, 150), maxShift: r(260, 420),
    driftFrom: 12, driftChance: r(0.2, 0.5), driftAmp: r(35, 70), driftHz: r(0.22, 0.3),
  },
  EXPRESS: {
    id: 'EXPRESS', name: 'Express', blurb: 'Fast from the first gate. Big swings, moving gaps.',
    rampGates: 40, speed: r(330, 520), gap: r(160, 132), spawnSec: r(1.3, 1.0),
    minShift: r(100, 210), maxShift: r(340, 480),
    driftFrom: 4, driftChance: r(0.35, 0.65), driftAmp: r(50, 90), driftHz: r(0.25, 0.32),
  },
  STORM: {
    id: 'STORM', name: 'Storm', blurb: 'Roof to street and back. Nothing stays still.',
    rampGates: 35, speed: r(390, 600), gap: r(152, 126), spawnSec: r(1.15, 0.95),
    minShift: r(150, 240), maxShift: r(440, 500),
    driftFrom: 0, driftChance: r(0.5, 0.85), driftAmp: r(70, 110), driftHz: r(0.3, 0.36),
  },
};

export const DIFFICULTY_ORDER: readonly DifficultyId[] = ['POSTCARD', 'AIRMAIL', 'EXPRESS', 'STORM'];
export const DEFAULT_DIFFICULTY: DifficultyId = 'AIRMAIL';

/** Slowest start and fastest top speed across all routes (for normalising, e.g. wind noise). */
export const SPEED_RANGE: Ramp = {
  from: Math.min(...DIFFICULTY_ORDER.map((id) => DIFFICULTIES[id].speed.from)),
  to: Math.max(...DIFFICULTY_ORDER.map((id) => DIFFICULTIES[id].speed.to)),
};

/** Look up a route, falling back to the default for unknown (e.g. stale stored) ids. */
export const difficultyFor = (id: string | undefined): Difficulty =>
  DIFFICULTIES[id as DifficultyId] ?? DIFFICULTIES[DEFAULT_DIFFICULTY];

const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const at = (ramp: Ramp, t: number) => ramp.from + (ramp.to - ramp.from) * t;

/** How far along the route's ramp a score is, 0–1. */
export const rampProgress = (d: Difficulty, score: number) => clamp01(score / d.rampGates);

export function rulesFor(d: Difficulty, score: number): GateRules {
  const t = rampProgress(d, score);
  const drifting = score >= d.driftFrom;
  const td = drifting ? clamp01((score - d.driftFrom) / Math.max(1, d.rampGates - d.driftFrom)) : 0;
  return {
    speed: at(d.speed, t),
    gapH: at(d.gap, t),
    spawnSec: at(d.spawnSec, t),
    minShift: at(d.minShift, t),
    maxShift: at(d.maxShift, t),
    driftChance: drifting ? at(d.driftChance, td) : 0,
    driftAmp: at(d.driftAmp, td),
    driftHz: at(d.driftHz, td),
  };
}
