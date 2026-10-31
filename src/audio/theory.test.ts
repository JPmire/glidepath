import { describe, expect, it } from 'vitest';
import { arpStep, chimeNote, LEG_MUSIC, legMusic, midiToHz, notePool, padVoicing } from './theory';

function seeded(seed = 1) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

const pc = (n: number) => ((n % 12) + 12) % 12;

describe('midiToHz', () => {
  it('tunes A4 to 440 and doubles per octave', () => {
    expect(midiToHz(69)).toBeCloseTo(440, 6);
    expect(midiToHz(81)).toBeCloseTo(880, 6);
    expect(midiToHz(60)).toBeCloseTo(261.626, 2);
  });
});

describe('legMusic', () => {
  it('loops through the four legs, including past the end', () => {
    expect(legMusic(0)).toBe(LEG_MUSIC[0]);
    expect(legMusic(5)).toBe(LEG_MUSIC[1]);
    expect(legMusic(-1)).toBe(LEG_MUSIC[3]);
  });
});

describe.each(LEG_MUSIC.map((m, i) => [i, m] as const))('leg %i score', (_, m) => {
  it('pad voicings sit in range without duplicate notes', () => {
    for (const c of m.progression) {
      const v = padVoicing(c);
      expect(new Set(v).size).toBe(v.length);
      for (const n of v) {
        expect(n).toBeGreaterThanOrEqual(50);
        expect(n).toBeLessThanOrEqual(79);
      }
    }
  });

  it('melody pools hold only scale or chord tones, and every chord has chord tones to land on', () => {
    for (const c of m.progression) {
      const pool = notePool(m, c);
      const allowed = new Set([...m.scale.map((s) => pc(m.tonic + s)), ...c.intervals.map((i) => pc(c.bass + i))]);
      expect(pool.notes.every((n) => allowed.has(pc(n)))).toBe(true);
      expect(pool.chordTone.filter(Boolean).length).toBeGreaterThanOrEqual(4);
    }
  });

  it('the melody always lands on a chord tone on strong beats and stays in the pool', () => {
    const rng = seeded(11);
    for (const c of m.progression) {
      const pool = notePool(m, c);
      const state = { index: Math.floor(pool.notes.length / 2) };
      for (let step = 0; step < 400; step++) {
        const n = arpStep(state, pool, step, 1, rng);
        if (n === null) continue;
        expect(pool.notes).toContain(n);
        if (step % 2 === 0) expect(pool.chordTone[pool.notes.indexOf(n)]).toBe(true);
      }
    }
  });

  it('gate chimes are always chord tones', () => {
    for (const c of m.progression) {
      for (let k = 0; k < 20; k++) {
        const n = chimeNote(c, k);
        expect(c.intervals.map((i) => pc(c.bass + i))).toContain(pc(n));
      }
    }
  });
});

describe('arpStep', () => {
  it('is deterministic for a seed and rests more at low density', () => {
    const m = LEG_MUSIC[0];
    const pool = notePool(m, m.progression[0]);
    const run = (density: number) => {
      const rng = seeded(3);
      const state = { index: 5 };
      return Array.from({ length: 64 }, (_, s) => arpStep(state, pool, s, density, rng));
    };
    expect(run(0.5)).toEqual(run(0.5));
    const rests = (xs: (number | null)[]) => xs.filter((x) => x === null).length;
    expect(rests(run(0.2))).toBeGreaterThan(rests(run(0.9)));
  });
});
