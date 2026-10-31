import { padVoicing, type Chord } from './theory';
import { noiseHit, pluck, thump } from './voices';

/** One-shot effects plus the continuous wind/paper-flutter bed. All synthesised. */
export class Sfx {
  private readonly wind: GainNode;
  private readonly windFilter: BiquadFilterNode;
  private readonly flutter: GainNode;
  private readonly flutterRate: OscillatorNode;

  constructor(
    private readonly ctx: AudioContext,
    private readonly out: AudioNode,
    private readonly noise: AudioBuffer,
  ) {
    // Wind: looping noise through a soft bandpass whose pitch rises with airspeed.
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.Q.value = 0.6;
    this.windFilter.frequency.value = 500;
    this.wind = ctx.createGain();
    this.wind.gain.value = 0;
    this.loop().connect(this.windFilter).connect(this.wind).connect(out);

    // Paper flutter: a thin high band, amplitude-modulated at wing-flap rate.
    const thin = ctx.createBiquadFilter();
    thin.type = 'bandpass';
    thin.frequency.value = 2600;
    thin.Q.value = 2.5;
    const am = ctx.createGain();
    am.gain.value = 0.5;
    this.flutterRate = ctx.createOscillator();
    this.flutterRate.frequency.value = 18;
    const depth = ctx.createGain();
    depth.gain.value = 0.5;
    this.flutterRate.connect(depth).connect(am.gain);
    this.flutterRate.start();
    this.flutter = ctx.createGain();
    this.flutter.gain.value = 0;
    this.loop().connect(thin).connect(am).connect(this.flutter).connect(out);
  }

  private loop(): AudioBufferSourceNode {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.start();
    return src;
  }

  private get now(): number {
    return this.ctx.currentTime;
  }

  /** Continuous bed. `air` 0–1 is airspeed, `flutter` 0–1 how hard the paper is working. */
  setFlight(air: number, flutter: number, active: boolean): void {
    const t = this.now;
    this.wind.gain.setTargetAtTime(active ? 0.05 + air * 0.07 : 0.018, t, 0.25);
    this.windFilter.frequency.setTargetAtTime(380 + air * 700 + flutter * 500, t, 0.2);
    this.flutter.gain.setTargetAtTime(active ? flutter * 0.05 : 0, t, 0.08);
    this.flutterRate.frequency.setTargetAtTime(14 + flutter * 16, t, 0.1);
  }

  /** Rubber stamp on paper: a felt thud, the slap of the stamp face, a dry paper tick. */
  stamp(at = 0, weight = 1): void {
    const t = this.now + at;
    thump(this.ctx, this.out, t, 170, 62, 0.13, 1.1 * weight);
    noiseHit(this.ctx, this.out, this.noise, t, { type: 'bandpass', freq: 950, q: 0.9, dur: 0.05, gain: 0.6 * weight });
    noiseHit(this.ctx, this.out, this.noise, t + 0.004, { type: 'highpass', freq: 3500, dur: 0.018, gain: 0.14 * weight });
  }

  /** Gate chime: one music-box note from the chord that is playing, so it always fits. */
  chime(midi: number): void {
    pluck(this.ctx, this.out, this.now + 0.01, midi, 0.34, 1.4);
  }

  /** Paper launched into the air: a rising, panning swish. */
  whoosh(): void {
    noiseHit(this.ctx, this.out, this.noise, this.now, {
      type: 'bandpass', freq: 380, toFreq: 2600, q: 1.1, dur: 0.5, gain: 0.7, attack: 0.12, pan: [-0.5, 0.6],
    });
  }

  /** Crash: the letter balling up. Dense crackle grains that thin out, over a soft impact. */
  crumple(): void {
    const t = this.now;
    thump(this.ctx, this.out, t, 120, 45, 0.16, 0.7);
    noiseHit(this.ctx, this.out, this.noise, t, { type: 'bandpass', freq: 1400, q: 0.7, dur: 0.08, gain: 0.5 });
    let g = t + 0.01;
    for (let i = 0; i < 34; i++) {
      g += 0.006 + Math.random() * 0.022 * (1 + i / 12);
      noiseHit(this.ctx, this.out, this.noise, g, {
        type: 'bandpass', freq: 1500 + Math.random() * 4500, q: 2 + Math.random() * 5,
        dur: 0.006 + Math.random() * 0.018, gain: (0.18 + Math.random() * 0.4) * (1 - i / 40),
        pan: [Math.random() * 0.6 - 0.3, Math.random() * 0.6 - 0.3],
      });
    }
  }

  /** The paper ball landing on the street. */
  bounce(strength: number): void {
    const t = this.now;
    thump(this.ctx, this.out, t, 110, 50, 0.1, 0.6 * strength);
    for (let i = 0; i < 6; i++) {
      noiseHit(this.ctx, this.out, this.noise, t + i * 0.012 + Math.random() * 0.01, {
        type: 'bandpass', freq: 2000 + Math.random() * 3000, q: 3, dur: 0.012, gain: 0.14 * strength,
      });
    }
  }

  /** A slip being typed: uneven key clicks, optionally ending on the carriage-return bell. */
  typewriter(keys: number, bell = false): void {
    let t = this.now + 0.05;
    for (let i = 0; i < keys; i++) {
      t += 0.045 + Math.random() * 0.05 + (Math.random() < 0.15 ? 0.08 : 0);
      noiseHit(this.ctx, this.out, this.noise, t, { type: 'bandpass', freq: 2300 + Math.random() * 900, q: 1.4, dur: 0.012, gain: 0.17 });
      thump(this.ctx, this.out, t, 420, 260, 0.025, 0.06);
    }
    if (!bell) return;
    t += 0.12;
    for (const [ratio, g] of [[1, 0.09], [2.76, 0.04], [5.4, 0.02]] as const) {
      const o = this.ctx.createOscillator();
      o.frequency.value = 2093 * ratio;
      const e = this.ctx.createGain();
      e.gain.setValueAtTime(g, t);
      e.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.connect(e).connect(this.out);
      o.start(t);
      o.stop(t + 1);
    }
  }

  /** Held: two notes falling. Resume: the same two rising. */
  held(chord: Chord): void {
    const [a, b] = this.pair(chord);
    pluck(this.ctx, this.out, this.now, b, 0.16, 1.2);
    pluck(this.ctx, this.out, this.now + 0.16, a, 0.16, 1.6);
  }

  resume(chord: Chord): void {
    const [a, b] = this.pair(chord);
    pluck(this.ctx, this.out, this.now, a, 0.16, 0.9);
    pluck(this.ctx, this.out, this.now + 0.11, b, 0.18, 1.2);
  }

  /** New leg: a page turning and the new key's chord rolled upward. */
  newLeg(chord: Chord): void {
    noiseHit(this.ctx, this.out, this.noise, this.now, { type: 'bandpass', freq: 900, toFreq: 3200, q: 0.9, dur: 0.45, gain: 0.16, attack: 0.08, pan: [0.6, -0.6] });
    this.flourish(chord, 0.25);
  }

  /** Rolled chord, for leg changes and finishing calibration. */
  flourish(chord: Chord, at = 0): void {
    padVoicing(chord, 67, 91).forEach((n, i) => pluck(this.ctx, this.out, this.now + at + i * 0.075, n, 0.15, 1.6));
  }

  private pair(chord: Chord): [number, number] {
    const v = padVoicing(chord, 69, 84);
    return [v[0], v[Math.min(2, v.length - 1)]];
  }
}
