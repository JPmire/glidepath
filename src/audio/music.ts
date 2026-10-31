import { arpStep, legMusic, notePool, padVoicing, type Chord, type LegMusic } from './theory';
import { bass, noiseHit, pad, pluck, thump } from './voices';

/** What the game is doing, as far as the score cares. */
export type Mood = 'menu' | 'play' | 'held' | 'over';

const LOOKAHEAD = 0.15; // s of audio scheduled ahead of the clock
const TICK_MS = 25;
const SWING = 0.12; // offbeat 8ths land a little late: a lazy, hand-played feel

const MOODS: Record<Mood, { density: number; gain: number; cutoff: (m: LegMusic) => number }> = {
  menu: { density: 0.4, gain: 0.85, cutoff: () => 3800 },
  play: { density: 0.6, gain: 1, cutoff: (m) => m.brightness },
  held: { density: 0.3, gain: 0.7, cutoff: () => 650 }, // "held at the sorting office": muffled
  over: { density: 0.22, gain: 0.75, cutoff: () => 1300 },
};

/**
 * Generative score: a pad on every bar, a music-box melody walking over the chords, and, while
 * flying, bass and brushed percussion that build with the score. Keys change with the leg at
 * the next bar line, so transitions are always musical.
 */
export class Music {
  readonly out: GainNode;
  private readonly filter: BiquadFilterNode;
  private readonly melody: GainNode;
  private readonly echo: DelayNode;
  private readonly echoSend: GainNode;
  private timer = 0;
  private nextTime = 0;
  private step = 0;
  private bar = 0;
  private leg = 0;
  private pendingLeg = 0;
  private mood: Mood = 'menu';
  private score = 0;
  private arp = { index: 7 };

  constructor(
    private readonly ctx: AudioContext,
    private readonly noise: AudioBuffer,
  ) {
    this.out = ctx.createGain();
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.Q.value = 0.5;
    this.filter.frequency.value = 3800;
    this.filter.connect(this.out);

    // Melody gets a filtered, dotted echo: it fills the gaps the sparse line leaves.
    this.melody = ctx.createGain();
    this.melody.connect(this.filter);
    this.echo = ctx.createDelay(2);
    const feedback = ctx.createGain();
    feedback.gain.value = 0.32;
    const darken = ctx.createBiquadFilter();
    darken.type = 'lowpass';
    darken.frequency.value = 2400;
    this.echoSend = ctx.createGain();
    this.melody.connect(this.echoSend).connect(this.echo).connect(darken).connect(feedback).connect(this.echo);
    darken.connect(this.filter);
    this.applyLeg(legMusic(0));
  }

  start(): void {
    if (this.timer) return;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), TICK_MS);
  }

  stop(): void {
    clearInterval(this.timer);
    this.timer = 0;
  }

  setLeg(leg: number): void {
    this.pendingLeg = leg;
  }

  setScore(score: number): void {
    this.score = score;
  }

  setMood(mood: Mood): void {
    if (mood === this.mood) return;
    this.mood = mood;
    const now = this.ctx.currentTime;
    const m = MOODS[mood];
    this.filter.frequency.setTargetAtTime(m.cutoff(legMusic(this.leg)), now, mood === 'held' ? 0.12 : 0.35);
    this.out.gain.setTargetAtTime(m.gain, now, 0.4);
  }

  /** The chord sounding now, so effects (gate chimes) can harmonise with it. */
  get chord(): Chord {
    const m = legMusic(this.leg);
    return m.progression[this.bar % m.progression.length];
  }

  private applyLeg(m: LegMusic): void {
    const stepDur = 60 / m.bpm / 2;
    this.echo.delayTime.setTargetAtTime(stepDur * 3, this.ctx.currentTime, 0.05);
    this.echoSend.gain.setTargetAtTime(m.delayWet, this.ctx.currentTime, 0.2);
    if (this.mood === 'play') this.filter.frequency.setTargetAtTime(m.brightness, this.ctx.currentTime, 1.5);
  }

  private schedule(): void {
    // After a long stall (background tab) skip ahead instead of firing a backlog of notes.
    if (this.nextTime < this.ctx.currentTime - 0.2) this.nextTime = this.ctx.currentTime + 0.05;
    while (this.nextTime < this.ctx.currentTime + LOOKAHEAD) this.playStep(this.nextTime);
  }

  private playStep(t: number): void {
    if (this.step === 0 && this.pendingLeg !== this.leg) {
      this.leg = this.pendingLeg;
      this.bar = 0;
      this.applyLeg(legMusic(this.leg));
    }
    const m = legMusic(this.leg);
    const stepDur = 60 / m.bpm / 2;
    const barDur = stepDur * 8;
    const chord = this.chord;
    const flying = this.mood === 'play';
    const intensity = flying ? (this.score >= 10 ? 2 : 1) : 0;
    const swung = t + (this.step % 2 ? stepDur * SWING : 0);
    const { ctx, out } = this;

    if (this.step === 0) {
      pad(ctx, this.filter, t, padVoicing(chord), barDur - 0.4, 0.034);
      if (intensity >= 1 || this.mood === 'held') bass(ctx, this.filter, t, chord.bass, stepDur * 3.5, 0.32);
    }
    if (intensity >= 1 && this.step === 4) bass(ctx, this.filter, t, chord.bass + (this.bar % 2 ? 7 : 12), stepDur * 2.5, 0.22);

    const density = Math.min(0.85, MOODS[this.mood].density + (flying ? Math.min(this.score, 30) * 0.006 : 0));
    const note = arpStep(this.arp, notePool(m, chord), this.step, density, Math.random);
    if (note !== null) pluck(ctx, this.melody, swung, note, this.step % 2 ? 0.11 : 0.16, m.pluckDecay);

    if (intensity >= 1 && this.step % 2) {
      noiseHit(ctx, out, this.noise, swung, { type: 'highpass', freq: 7000, dur: 0.045, gain: 0.03 + Math.random() * 0.02 });
    }
    if (intensity >= 2) {
      if (this.step === 0 || this.step === 5) thump(ctx, out, t, 95, 42, 0.28, 0.32);
      if (this.step === 2 || this.step === 6) noiseHit(ctx, out, this.noise, t, { type: 'bandpass', freq: 1900, q: 0.6, dur: 0.17, gain: 0.05, attack: 0.008 });
    }

    this.nextTime += stepDur;
    this.step = (this.step + 1) % 8;
    if (this.step === 0) this.bar++;
  }
}
