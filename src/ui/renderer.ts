import * as C from '../game/constants';
import type { GameEngine, GameState } from '../game/gameEngine';
import { legForScore } from '../game/gameRules';
import { tiltDeg } from '../game/springDamperPhysics';
import { drawBand, type Band } from './art/band';
import { CrumpleBall } from './art/crumple';
import { GateCache } from './art/gateCache';
import { drawGlider } from './art/glider';
import { legSlip, scoreStamp, tornEdge } from './art/hudArt';
import { pencil, withInk } from './art/ink';
import { legArt, legLabel } from './art/legs';
import { drawManicule } from './art/manicule';
import { reducedMotion } from './art/motion';
import { getArtScale, printFinish } from './art/paper';
import { RouteTrail, RunRoute } from './art/routeTrail';

const GLIDER_SCALE = 1.4;
const TAIL_X = C.GLIDER_X - 34;
const AIM_X = C.GLIDER_X + 120; // the calibrated aim column
const WIPE_SEC = 1.4;

/** Draws the world in logical 1280×720 coordinates; caller sets the canvas transform. */
export class Renderer {
  readonly route = new RunRoute();
  /** The crumpled glider hit the street; strength 0–1. */
  onBounce: ((strength: number) => void) | null = null;
  private readonly trail = new RouteTrail();
  private readonly gateArt = new GateCache();
  private readonly stamps = new Map<number, number>(); // gate id → number it was delivered as
  private readonly gateLeg = new Map<number, number>(); // gate id → leg it spawned in
  private bands = new Map<number, Band[]>();
  private bandScale = 0;
  private scroll = 0;
  private time = 0;
  private leg = 0;
  private wipe = { from: 0, t: 1 };
  private prevState: GameState | null = null;
  private prevScore = 0;
  private scorePop = 0;
  private legShownAt = -Infinity;
  private readonly ball = new CrumpleBall((strength) => this.onBounce?.(strength));

  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  /** The leg on screen (absolute: keeps counting past the fourth biome). */
  get currentLeg(): number {
    return this.leg;
  }

  draw(game: GameEngine, dt: number, showReticle: boolean): void {
    const { ctx } = this;
    const calm = reducedMotion();
    this.time += dt;
    this.transitions(game);
    const moving = game.state === 'PLAYING' || game.state === 'READY';
    const dx = moving ? (game.state === 'PLAYING' ? game.speed : 90) * dt : 0;
    this.scroll += dx;
    this.wipe.t = calm ? 1 : Math.min(1, this.wipe.t + dt / WIPE_SEC);

    this.layer((n) => {
      legArt(n).sky(ctx);
      for (const b of this.bandsFor(n)) drawBand(ctx, b, this.scroll);
    });
    for (const g of game.gates) {
      if (!this.gateLeg.has(g.id)) this.gateLeg.set(g.id, this.leg);
      if (g.scored && !this.stamps.has(g.id)) this.stamps.set(g.id, game.score);
      const leg = this.gateLeg.get(g.id)!;
      this.gateArt.draw(ctx, g, this.stamps.get(g.id) ?? null, leg);
      if (leg % 4 === 3) this.mastLamp(g.x + g.width / 2, g.gapY + g.gapH / 2 + 8, g.id);
    }
    this.gateArt.retain(game.gates);
    this.layer((n) => legArt(n).street(ctx, this.scroll));
    if (this.wipe.t < 1) tornEdge(ctx, this.wipeEdge(), C.CANVAS_HEIGHT);

    if (game.state !== 'CALIBRATING') {
      const ink = legArt(this.leg).dark ? 'paper' : 'graphite';
      if (moving) this.trail.step(TAIL_X, game.glider.y, dx);
      if (game.state === 'PLAYING') this.route.record(dx, game.glider.y);
      this.drawTrail(game.glider.y, ink);
      if (showReticle && game.targetY !== null && game.state !== 'GAME_OVER') {
        pencil(ctx, new Path2D(`M${C.GLIDER_X + 44} ${game.glider.y} L${AIM_X - 24} ${game.targetY}`), 1.4, [2, 5], ink);
        drawManicule(ctx, AIM_X - 18, game.targetY, 0.62, -1);
      }
      if (game.state === 'GAME_OVER') this.ball.draw(ctx, dt, calm);
      else {
        const flutter = calm ? 0 : Math.min(1, Math.abs(game.glider.vy) / game.physics.vMax + (game.state === 'PLAYING' ? 0.25 : 0.1));
        drawGlider(ctx, C.GLIDER_X, game.glider.y, tiltDeg(game.glider.vy, game.physics.vMax), flutter, this.time, GLIDER_SCALE);
      }
    }
    if (game.state === 'PLAYING' || game.state === 'PAUSED') {
      if (game.score !== this.prevScore && !calm) this.scorePop = 1;
      this.prevScore = game.score;
      this.scorePop = Math.max(0, this.scorePop - dt * 5);
      scoreStamp(ctx, game.score, this.scorePop, legArt(this.leg).dark);
    }
    if (game.state !== 'CALIBRATING') {
      const age = this.time - this.legShownAt;
      const lift = game.state === 'READY' ? 0 : age < 2.6 ? 0 : calm ? 999 : (age - 2.6) * 220;
      if (lift < 90) legSlip(ctx, legLabel(this.leg), lift);
    }
  }

  /** Paper grain and ink dropout over everything, overlays included. Call last. */
  finish(): void {
    printFinish(this.ctx, C.CANVAS_WIDTH, C.CANVAS_HEIGHT);
  }

  private transitions(game: GameEngine): void {
    const leg = game.state === 'READY' ? 0 : legForScore(game.score);
    if (leg !== this.leg) {
      this.wipe = { from: this.leg, t: 0 };
      this.leg = leg;
      this.legShownAt = this.time;
    }
    const prev = this.prevState;
    const s = game.state;
    if (s === prev) return;
    if (s === 'PLAYING' && prev !== 'PAUSED') {
      this.route.reset();
      this.stamps.clear();
      this.gateLeg.clear();
      this.prevScore = 0;
      this.legShownAt = this.time;
    }
    if (s === 'GAME_OVER') {
      this.ball.start(C.GLIDER_X, game.glider.y, game.glider.vy);
    }
    this.prevState = s;
  }

  /** Draw a layer for the current leg; mid-wipe, the old leg shows left of the torn edge. */
  private layer(paint: (leg: number) => void): void {
    if (this.wipe.t >= 1) return paint(this.leg);
    paint(this.wipe.from);
    const { ctx } = this;
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.wipeEdge(), 0, C.CANVAS_WIDTH, C.CANVAS_HEIGHT);
    ctx.clip();
    paint(this.leg);
    ctx.restore();
  }

  private wipeEdge(): number {
    const e = 1 - (1 - this.wipe.t) ** 3; // ease out: the page is flicked, then settles
    return C.CANVAS_WIDTH + 20 - (C.CANVAS_WIDTH + 40) * e;
  }

  /** Scenery is cached per biome; only the two most recent are kept (they are large). */
  private bandsFor(n: number): Band[] {
    if (getArtScale() !== this.bandScale) {
      this.bands.clear();
      this.bandScale = getArtScale();
    }
    const key = n % 4;
    let b = this.bands.get(key);
    if (!b) {
      b = legArt(n).bands();
      this.bands.set(key, b);
      for (const k of this.bands.keys()) if (this.bands.size > 2 && k !== key && k !== this.wipe.from % 4) this.bands.delete(k);
    }
    return b;
  }

  private mastLamp(x: number, y: number, id: number): void {
    const on = reducedMotion() || Math.sin(this.time * 3.2 + id) > -0.2;
    withInk(this.ctx, 'red', (c) => {
      c.globalAlpha = on ? 1 : 0.25;
      c.beginPath();
      c.arc(x, y, 5, 0, Math.PI * 2);
      c.fill();
    });
  }

  private drawTrail(gliderY: number, ink: 'paper' | 'graphite'): void {
    const pts = this.trail.points;
    if (pts.length < 2) return;
    const p = new Path2D();
    p.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      p.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + pts[i + 1].x) / 2, (pts[i].y + pts[i + 1].y) / 2);
    }
    if (this.prevState !== 'GAME_OVER') p.lineTo(TAIL_X, gliderY);
    pencil(this.ctx, p, 2.2, [1, 7], ink);
  }
}
