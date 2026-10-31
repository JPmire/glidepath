import * as C from './constants';
import { gapForScore, hitsGate, nextGapY, speedForScore } from './gameRules';
import { stepClassic, stepFollow, type GliderBody } from './springDamperPhysics';
export { circleIntersectsRect, gapForScore, speedForScore } from './gameRules';

export type GameState = 'CALIBRATING' | 'READY' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';
/** PALM / NO_HAND resume by gesture; MENU waits for the pause menu; RESUMING counts down to play. */
export type PauseReason = 'PALM' | 'NO_HAND' | 'MENU' | 'RESUMING';
export type ControlMode = 'FOLLOW' | 'FLAP';

export interface ControlInput {
  /** Filtered pointed altitude in canvas px, or null when no hand. */
  targetY: number | null;
  /** A steering hand is visible (anything but the pause gesture). */
  steering: boolean;
  /** Debounced pause gesture (open palm held). */
  pause: boolean;
  /** Edge-triggered flap (thumb tap, key or click). */
  flap: boolean;
  handPresent: boolean;
}

export interface Gate {
  /** Unique for the session (never reset), so art and postmarks can be cached per gate. */
  id: number;
  x: number;
  width: number;
  gapY: number;
  gapH: number;
  scored: boolean;
}

const NO_HAND_GRACE_SEC = 0.5;
const PLAY_BOTTOM = C.CANVAS_HEIGHT - C.GROUND_HEIGHT;

export class GameEngine {
  state: GameState = 'CALIBRATING';
  pauseReason: PauseReason | null = null;
  mode: ControlMode = 'FOLLOW';
  glider: GliderBody = { y: C.CANVAS_HEIGHT / 2, vy: 0 };
  gates: Gate[] = [];
  score = 0;
  best = 0;
  readyProgress = 0;
  /** Latest pointed altitude, for the laser reticle. */
  targetY: number | null = null;
  physics = { omegaN: C.SPRING_OMEGA_N, zeta: C.SPRING_ZETA, vMax: C.GLIDER_MAX_VY };

  private spawnTimer = 0;
  private stateTime = 0;
  private noHandTime = 0;
  private lastGapY = C.CANVAS_HEIGHT / 2;
  private nextGateId = 1;
  private hovering = false;

  constructor(private readonly rng: () => number = Math.random) {}

  get speed(): number {
    return speedForScore(this.score);
  }

  get canRestart(): boolean {
    return this.state === 'READY' || (this.state === 'GAME_OVER' && this.stateTime >= C.GAME_OVER_COOLDOWN_SEC);
  }

  setState(s: GameState): void {
    this.state = s;
    this.stateTime = 0;
    this.readyProgress = 0;
    if (s !== 'PAUSED') this.pauseReason = null;
  }

  /** Start a fresh run immediately (also used by keyboard / click). */
  launch(): void {
    this.gates = [];
    this.score = 0;
    this.spawnTimer = C.GATE_SPAWN_MS / 1000; // first gate spawns on the next tick
    this.noHandTime = 0;
    this.glider.vy = 0;
    // A flap run ends on the street; the next one starts mid-air and hovers until the first flap.
    if ((this.hovering = this.mode === 'FLAP')) this.glider.y = C.FLAP_LAUNCH_Y;
    this.lastGapY = this.glider.y;
    this.setState('PLAYING');
  }

  /** Open the pause menu: freezes a run (or a gesture hold) until `resume()`. */
  hold(): void {
    if (this.state === 'PLAYING' || this.state === 'PAUSED') this.pause('MENU');
  }

  /** Leave the pause menu: the world restarts after a short countdown. */
  resume(): void {
    if (this.state === 'PAUSED') this.pause('RESUMING');
  }

  update(dt: number, input: ControlInput): void {
    dt = Math.min(dt, C.MAX_DT);
    this.stateTime += dt;
    if (input.targetY !== null) this.targetY = this.clampTarget(input.targetY);

    switch (this.state) {
      case 'CALIBRATING':
        return;
      case 'READY':
        this.moveGlider(dt, input, false);
        return this.trackHold(dt, input);
      case 'GAME_OVER':
        if (this.stateTime >= C.GAME_OVER_COOLDOWN_SEC) this.trackHold(dt, input);
        return;
      case 'PAUSED':
        return this.tickPaused(dt, input);
      case 'PLAYING':
        return this.tickPlaying(dt, input);
    }
  }

  private tickPaused(dt: number, input: ControlInput): void {
    if (this.pauseReason === 'MENU') return;
    // Glider tracks the finger so the player can line up before the world resumes.
    if (this.mode === 'FOLLOW') this.moveGlider(dt, input, false);
    if (this.pauseReason === 'RESUMING') this.readyProgress += dt / C.RESUME_COUNTDOWN_SEC;
    else this.readyProgress = input.steering && !input.pause ? this.readyProgress + dt / C.RESUME_HOLD_SEC : 0;
    if (this.readyProgress < 1) return;
    if (this.mode === 'FLAP') this.glider.vy = Math.min(0, this.glider.vy); // no plunge on resume
    this.setState('PLAYING');
  }

  private trackHold(dt: number, input: ControlInput): void {
    this.readyProgress = input.steering && !input.pause ? this.readyProgress + dt / C.READY_HOLD_SEC : 0;
    if (this.readyProgress >= 1) this.launch();
  }

  private tickPlaying(dt: number, input: ControlInput): void {
    if (input.pause) return this.pause('PALM');
    this.noHandTime = input.handPresent ? 0 : this.noHandTime + dt;
    if (this.noHandTime > NO_HAND_GRACE_SEC && this.mode === 'FOLLOW') return this.pause('NO_HAND');

    this.moveGlider(dt, input, true);
    if (this.state !== 'PLAYING') return;

    this.spawnTimer += dt;
    if (this.spawnTimer >= C.GATE_SPAWN_MS / 1000) {
      this.spawnTimer = 0;
      this.spawnGate();
    }

    const dx = this.speed * dt;
    for (const g of this.gates) {
      g.x -= dx;
      if (!g.scored && g.x + g.width < C.GLIDER_X - C.GLIDER_HITBOX) {
        g.scored = true;
        this.score++;
      }
      if (hitsGate(this.glider.y, g, PLAY_BOTTOM)) return this.crash();
    }
    this.gates = this.gates.filter((g) => g.x + g.width > -10);
  }

  private moveGlider(dt: number, input: ControlInput, live: boolean): void {
    if (input.flap) this.hovering = false;
    if (this.mode === 'FLAP' && (this.state === 'READY' || this.hovering)) {
      stepFollow(this.glider, C.FLAP_LAUNCH_Y, dt, this.physics); // hover at the launch altitude
    } else if (this.mode === 'FOLLOW' || !live) {
      if (this.targetY !== null) stepFollow(this.glider, this.targetY, dt, this.physics);
    } else {
      stepClassic(this.glider, input.flap, dt, { gravity: C.GRAVITY, flapVy: C.FLAP_VY, vMax: this.physics.vMax });
    }
    const r = C.GLIDER_HITBOX;
    if (this.glider.y < r) {
      this.glider.y = r;
      this.glider.vy = Math.max(0, this.glider.vy);
    }
    if (this.glider.y > PLAY_BOTTOM - r) {
      if (live && this.mode === 'FLAP') return this.crash();
      this.glider.y = PLAY_BOTTOM - r;
      this.glider.vy = Math.min(0, this.glider.vy);
    }
  }

  private clampTarget(y: number): number {
    return Math.max(C.GLIDER_RADIUS, Math.min(PLAY_BOTTOM - C.GLIDER_RADIUS, y));
  }

  private spawnGate(): void {
    const gapH = gapForScore(this.score);
    this.lastGapY = nextGapY(this.rng(), this.lastGapY, gapH, PLAY_BOTTOM);
    this.gates.push({ id: this.nextGateId++, x: C.CANVAS_WIDTH + 10, width: C.GATE_WIDTH, gapY: this.lastGapY, gapH, scored: false });
  }

  private pause(reason: PauseReason): void {
    this.setState('PAUSED');
    this.pauseReason = reason;
  }
  private crash(): void {
    this.best = Math.max(this.best, this.score);
    this.setState('GAME_OVER');
  }
}
