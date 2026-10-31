/** Pure music theory for the generative score. No Web Audio here, so it is unit tested. */

export const midiToHz = (m: number) => 440 * 2 ** ((m - 69) / 12);

export interface Chord {
  /** Bass note (MIDI). */
  bass: number;
  /** Chord tones as semitones above the bass. */
  intervals: readonly number[];
}

export interface LegMusic {
  bpm: number;
  tonic: number;
  /** Melody scale as semitones above the tonic (pentatonics: nothing can clash). */
  scale: readonly number[];
  /** One chord per bar, looped. */
  progression: readonly Chord[];
  /** Music-box tine ring time (s). */
  pluckDecay: number;
  /** Echo send level for the melody. */
  delayWet: number;
  /** Music-bus lowpass while flying (Hz): darker legs sound further away. */
  brightness: number;
}

const MAJOR_PENT = [0, 2, 4, 7, 9];
const MINOR_PENT = [0, 3, 5, 7, 10];

/** One score per leg: warm town, bright coast, cold pass, dreamy night. */
export const LEG_MUSIC: readonly LegMusic[] = [
  {
    // The Town: D major, unhurried. Dmaj9 · Bm9 · Gmaj9 · A7sus4
    bpm: 84, tonic: 62, scale: MAJOR_PENT, pluckDecay: 1.3, delayWet: 0.22, brightness: 6500,
    progression: [{ bass: 38, intervals: [0, 4, 7, 11, 14] }, { bass: 35, intervals: [0, 3, 7, 10, 14] },
      { bass: 43, intervals: [0, 4, 7, 11, 14] }, { bass: 45, intervals: [0, 5, 7, 10, 14] }],
  },
  {
    // The Coast: A major, a little quicker and airier. Aadd9 · F#m7 · Dmaj9 · E6sus4
    bpm: 92, tonic: 69, scale: MAJOR_PENT, pluckDecay: 1.1, delayWet: 0.3, brightness: 8000,
    progression: [{ bass: 45, intervals: [0, 4, 7, 14] }, { bass: 42, intervals: [0, 3, 7, 10] },
      { bass: 38, intervals: [0, 4, 7, 11, 14] }, { bass: 40, intervals: [0, 5, 7, 9, 14] }],
  },
  {
    // The Pass: E minor, slower and colder. Em9 · Cmaj7 · Gadd9 · Dsus2
    bpm: 76, tonic: 64, scale: MINOR_PENT, pluckDecay: 1.6, delayWet: 0.28, brightness: 4800,
    progression: [{ bass: 40, intervals: [0, 3, 7, 10, 14] }, { bass: 36, intervals: [0, 4, 7, 11] },
      { bass: 43, intervals: [0, 4, 7, 14] }, { bass: 38, intervals: [0, 2, 7, 12] }],
  },
  {
    // Night Post: B♭ lydian, a lullaby. B♭maj7♯11 · Gm9 · E♭maj9 · F6/9
    bpm: 70, tonic: 70, scale: MAJOR_PENT, pluckDecay: 2.0, delayWet: 0.36, brightness: 3800,
    progression: [{ bass: 46, intervals: [0, 4, 7, 11, 18] }, { bass: 43, intervals: [0, 3, 7, 10, 14] },
      { bass: 39, intervals: [0, 4, 7, 11, 14] }, { bass: 41, intervals: [0, 4, 9, 14] }],
  },
];

export const legMusic = (leg: number): LegMusic => LEG_MUSIC[((leg % LEG_MUSIC.length) + LEG_MUSIC.length) % LEG_MUSIC.length];

/** Pad voicing: chord tones from an octave above the bass, folded into [lo, hi], no doubles. */
export function padVoicing(c: Chord, lo = 50, hi = 79): number[] {
  const notes = c.intervals.map((i) => {
    let n = c.bass + 12 + i;
    while (n > hi) n -= 12;
    while (n < lo) n += 12;
    return n;
  });
  return [...new Set(notes)].sort((a, b) => a - b);
}

export interface NotePool {
  notes: number[];
  chordTone: boolean[];
}

/** Melody notes in [lo, hi]: the scale plus the chord, with chord tones flagged. */
export function notePool(m: LegMusic, c: Chord, lo = 69, hi = 88): NotePool {
  const chordPcs = new Set(c.intervals.map((i) => (c.bass + i) % 12));
  const scalePcs = new Set(m.scale.map((s) => (m.tonic + s) % 12));
  const notes: number[] = [];
  const chordTone: boolean[] = [];
  for (let n = lo; n <= hi; n++) {
    const inChord = chordPcs.has(n % 12);
    if (!inChord && !scalePcs.has(n % 12)) continue;
    notes.push(n);
    chordTone.push(inChord);
  }
  return { notes, chordTone };
}

/** How likely each 8th of the bar is to sound: downbeats speak, offbeats answer. */
export const STEP_WEIGHTS = [1, 0.3, 0.75, 0.35, 0.95, 0.3, 0.7, 0.45] as const;

/**
 * One melody step: a gentle random walk (mostly steps, some thirds, rare leaps) that lands on
 * a chord tone on every strong beat. Returns a MIDI note, or null for a rest.
 */
export function arpStep(state: { index: number }, pool: NotePool, step: number, density: number, rng: () => number): number | null {
  if (rng() > density * STEP_WEIGHTS[step % STEP_WEIGHTS.length]) return null;
  const last = pool.notes.length - 1;
  const r = rng();
  const dir = rng() < 0.5 ? -1 : 1;
  const move = r < 0.45 ? dir : r < 0.8 ? 2 * dir : r < 0.92 ? 0 : 4 * dir;
  let i = Math.max(0, Math.min(last, state.index + move));
  if (i === 0 || i === last) i += i === 0 ? 2 : -2; // drift back toward the middle
  i = Math.max(0, Math.min(last, i));
  if (step % 2 === 0 && !pool.chordTone[i]) i = nearestChordTone(pool, i);
  state.index = i;
  return pool.notes[i];
}

function nearestChordTone(pool: NotePool, i: number): number {
  for (let d = 1; d < pool.notes.length; d++) {
    if (pool.chordTone[i - d]) return i - d;
    if (pool.chordTone[i + d]) return i + d;
  }
  return i;
}

/** The chime for gate `k`: chord tones high up, climbing as the score climbs. */
export function chimeNote(c: Chord, k: number, lo = 76, hi = 91): number {
  const tones: number[] = [];
  for (let n = lo; n <= hi; n++) if (c.intervals.some((i) => (c.bass + i) % 12 === n % 12)) tones.push(n);
  return tones[((k % tones.length) + tones.length) % tones.length];
}
