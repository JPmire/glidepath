import type { GameEngine, GameState } from '../game/gameEngine';
import { SPEED_RANGE } from '../game/difficulty';
import { legForScore } from '../game/gameRules';
import { Music, type Mood } from './music';
import { Sfx } from './sfx';
import { chimeNote } from './theory';
import { noiseBuffer } from './voices';

export interface AudioSettings {
  sound: boolean;
  music: boolean;
  volume: number;
}

const MOOD: Record<GameState, Mood> = { CALIBRATING: 'menu', READY: 'menu', PLAYING: 'play', PAUSED: 'held', GAME_OVER: 'over' };
const MUSIC_LEVEL = 0.8;

/**
 * Listens to the game and plays it: picks the score's mood and key, fires effects on state and
 * score changes, and drives the wind bed. Created lazily on a user gesture (autoplay rules).
 */
export class AudioDirector {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private music!: Music;
  private sfx!: Sfx;
  private prevState: GameState | null = null;
  private prevScore = 0;
  private prevLeg = 0;
  private calibrationStep = 0;

  constructor(private settings: AudioSettings) {
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend();
      else void this.ctx.resume();
    });
  }

  /** Call from a click / key handler: browsers only allow audio to start inside a gesture. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    this.ctx = ctx;
    const noise = noiseBuffer(ctx);
    const glue = ctx.createDynamicsCompressor();
    glue.threshold.value = -16;
    glue.ratio.value = 3;
    glue.attack.value = 0.01;
    glue.release.value = 0.25;
    this.master = ctx.createGain();
    this.master.connect(glue).connect(ctx.destination);
    this.sfxBus = ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus = ctx.createGain();
    this.musicBus.connect(this.master);
    this.music = new Music(ctx, noise);
    this.music.out.connect(this.musicBus);
    this.sfx = new Sfx(ctx, this.sfxBus, noise);
    this.apply(this.settings);
    this.music.start();
  }

  apply(s: AudioSettings): void {
    this.settings = s;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.volume, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(s.sound ? 1 : 0, t, 0.05);
    this.musicBus.gain.setTargetAtTime(s.music ? MUSIC_LEVEL : 0, t, 0.3);
  }

  /** Once per rendered frame. `calibrationStep` is how many markers have been franked. */
  update(game: GameEngine, calibrationStep: number): void {
    if (calibrationStep > this.calibrationStep && this.ctx) this.sfx.stamp();
    this.calibrationStep = calibrationStep;
    if (!this.ctx || this.ctx.state !== 'running') return;
    const s = game.state;
    const leg = legForScore(game.score);
    this.music.setMood(MOOD[s]);
    this.music.setScore(game.score);
    this.music.setLeg(s === 'PLAYING' || s === 'PAUSED' || s === 'GAME_OVER' ? leg : 0);

    if (s !== this.prevState) this.onState(this.prevState, s);
    if (s === 'PLAYING' && game.score > this.prevScore) {
      this.sfx.stamp();
      this.sfx.chime(chimeNote(this.music.chord, game.score));
      if (leg !== this.prevLeg) this.sfx.newLeg(this.music.chord);
    }
    this.prevScore = game.score;
    this.prevLeg = leg;

    const playing = s === 'PLAYING';
    const air = playing ? (game.speed - SPEED_RANGE.from) / (SPEED_RANGE.to - SPEED_RANGE.from) : 0;
    const flutter = Math.min(1, Math.abs(game.glider.vy) / game.physics.vMax);
    this.sfx.setFlight(air, playing ? 0.25 + flutter * 0.75 : 0, playing || s === 'READY');
  }

  private onState(prev: GameState | null, s: GameState): void {
    this.prevState = s;
    const chord = this.music.chord;
    switch (s) {
      case 'PLAYING':
        if (prev === 'PAUSED') this.sfx.resume(chord);
        else this.sfx.whoosh();
        return;
      case 'PAUSED':
        this.sfx.held(chord);
        this.sfx.typewriter(9);
        return;
      case 'READY':
        if (prev === 'CALIBRATING') this.sfx.flourish(chord);
        this.sfx.typewriter(14, true);
        return;
      case 'GAME_OVER':
        this.sfx.crumple();
        this.sfx.stamp(0.75, 1.3); // RETURN TO SENDER lands on the postcard
        return;
      default:
        return;
    }
  }

  /** The crumpled glider hit the street (strength 0–1). */
  bounce(strength: number): void {
    if (!this.ctx) return;
    this.sfx.bounce(strength);
  }
}
