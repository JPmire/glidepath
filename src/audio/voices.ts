import { midiToHz } from './theory';

/** Synth voices for score and effects. Everything is synthesised: no sample files ship. */

export function noiseBuffer(ctx: BaseAudioContext, seconds = 2): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

/** Attack then exponential decay on a fresh gain node; returns the node to connect into. */
function env(ctx: BaseAudioContext, out: AudioNode, t: number, peak: number, attack: number, decay: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  g.connect(out);
  return g;
}

function osc(ctx: BaseAudioContext, type: OscillatorType, hz: number, into: AudioNode, t: number, dur: number, detune = 0): OscillatorNode {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = hz;
  o.detune.value = detune;
  o.connect(into);
  o.start(t);
  o.stop(t + dur + 0.05);
  return o;
}

/**
 * Music-box tine: a sine with a quick octave partial and a faint inharmonic "tink" on top.
 * Soft, round and short, so a generative melody never turns into noise.
 */
export function pluck(ctx: BaseAudioContext, out: AudioNode, t: number, midi: number, vel: number, decay: number): void {
  const f = midiToHz(midi);
  const partials: [number, number, number][] = [[1, 1, decay], [2, 0.18, decay * 0.3], [5.4, 0.05, 0.07]];
  for (const [ratio, gain, d] of partials) osc(ctx, 'sine', f * ratio, env(ctx, out, t, vel * gain, 0.004, d), t, d + 0.01);
}

/** Warm pad: triangle + quiet detuned saw per note, slow swell, through a soft lowpass. */
export function pad(ctx: BaseAudioContext, out: AudioNode, t: number, midis: readonly number[], dur: number, vel: number): void {
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 950;
  lp.Q.value = 0.4;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vel, t + 1.1);
  g.gain.setValueAtTime(vel, t + dur);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 1.6);
  lp.connect(g).connect(out);
  const tail = dur + 1.7;
  for (const m of midis) {
    const hz = midiToHz(m);
    osc(ctx, 'triangle', hz, lp, t, tail, -4);
    const sawGain = ctx.createGain();
    sawGain.gain.value = 0.28;
    sawGain.connect(lp);
    osc(ctx, 'sawtooth', hz, sawGain, t, tail, 7);
  }
}

/** Round bass: sine body with a quiet triangle octave for definition on small speakers. */
export function bass(ctx: BaseAudioContext, out: AudioNode, t: number, midi: number, dur: number, vel: number): void {
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 420;
  lp.connect(out);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vel, t + 0.02);
  g.gain.exponentialRampToValueAtTime(vel * 0.55, t + 0.35);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g.connect(lp);
  const hz = midiToHz(midi);
  osc(ctx, 'sine', hz, g, t, dur);
  const oct = ctx.createGain();
  oct.gain.value = 0.18;
  oct.connect(g);
  osc(ctx, 'triangle', hz * 2, oct, t, dur);
}

export interface NoiseHit {
  dur: number;
  gain: number;
  type: BiquadFilterType;
  freq: number;
  q?: number;
  /** Sweep the filter to here over the hit (whooshes). */
  toFreq?: number;
  attack?: number;
  pan?: [number, number];
}

/** Filtered noise burst: shakers, brushes, paper, wind gusts, stamp slaps. */
export function noiseHit(ctx: BaseAudioContext, out: AudioNode, noise: AudioBuffer, t: number, h: NoiseHit): void {
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = h.type;
  f.frequency.setValueAtTime(h.freq, t);
  if (h.toFreq) f.frequency.exponentialRampToValueAtTime(h.toFreq, t + h.dur);
  f.Q.value = h.q ?? 0.8;
  let tail: AudioNode = env(ctx, out, t, h.gain, h.attack ?? 0.002, h.dur);
  if (h.pan) {
    const p = ctx.createStereoPanner();
    p.pan.setValueAtTime(h.pan[0], t);
    p.pan.linearRampToValueAtTime(h.pan[1], t + h.dur);
    p.connect(tail);
    tail = p;
  }
  src.connect(f).connect(tail);
  src.start(t, Math.random() * (noise.duration - h.dur - 0.1));
  src.stop(t + (h.attack ?? 0) + h.dur + 0.05);
}

/** Pitched-down sine thump: kick drums, stamp bodies, the paper ball landing. */
export function thump(ctx: BaseAudioContext, out: AudioNode, t: number, from: number, to: number, dur: number, gain: number): void {
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(to, t + dur * 0.7);
  o.connect(env(ctx, out, t, gain, 0.003, dur));
  o.start(t);
  o.stop(t + dur + 0.05);
}
