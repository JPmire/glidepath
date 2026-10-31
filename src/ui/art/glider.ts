import { withInk } from './ink';
import { halftone } from './paper';
import { INK } from './palette';
import { airmailStamp } from './stamps';
import { polyPath, wobbleCircle } from './wobble';

/**
 * The airmail glider: a folded envelope with a red/blue chevron border, a crease and a stamp.
 * `flutter` (0–1) shakes the trailing edge; `t` is seconds, for the flutter phase.
 */
export function drawGlider(ctx: CanvasRenderingContext2D, x: number, y: number, angleDeg: number, flutter = 0, t = 0, scale = 1): void {
  const wobble = Math.sin(t * 38) * 2.2 * flutter + Math.sin(t * 23 + 1) * 1.1 * flutter;
  const N = { x: 32, y: 0 }; // nose
  const U = { x: -29, y: -20 + wobble }; // trailing tip of the top wing
  const R = { x: -15, y: 3 }; // wing root
  const K = { x: -22, y: 16 + wobble * 0.4 }; // keel tail

  const wing = new Path2D();
  wing.moveTo(N.x, N.y);
  wing.lineTo(U.x, U.y);
  wing.lineTo(R.x, R.y);
  wing.closePath();
  const keel = new Path2D();
  keel.moveTo(N.x, N.y);
  keel.lineTo(R.x, R.y);
  keel.lineTo(K.x, K.y);
  keel.closePath();

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((angleDeg * Math.PI) / 180);
  ctx.scale(scale, scale);

  // Separation from the world: a hard printed cast shadow, then a paper cut-out border.
  const silhouette = new Path2D();
  silhouette.addPath(wing);
  silhouette.addPath(keel);
  withInk(ctx, 'blue', (c) => {
    c.globalAlpha = 0.55;
    c.translate(5, 9);
    c.fill(silhouette);
  }, halftone(ctx, 'blue', 0.5, 4));
  withInk(ctx, 'paper', (c) => {
    c.lineWidth = 8;
    c.lineJoin = 'round';
    c.strokeStyle = INK.paper;
    c.stroke(silhouette);
  });

  // Keel in shadow: paper with a blue screen over it.
  withInk(ctx, 'paper', (c) => c.fill(keel));
  withInk(ctx, 'blue', (c) => c.fill(keel), halftone(ctx, 'blue', 0.22, 4));

  // Top wing: envelope paper with the airmail chevron border along the leading edge.
  withInk(ctx, 'paper', (c) => c.fill(wing));
  ctx.save();
  ctx.clip(wing);
  ctx.translate(N.x, N.y);
  ctx.rotate(Math.atan2(U.y - N.y, U.x - N.x));
  const len = Math.hypot(U.x - N.x, U.y - N.y);
  for (let i = 0, s = 0; s < len + 10; i++, s += 7) {
    withInk(ctx, i % 2 ? 'blue' : 'red', (c) => {
      c.beginPath();
      c.moveTo(s, -8);
      c.lineTo(s + 4, -8);
      c.lineTo(s + 8, 8);
      c.lineTo(s + 4, 8);
      c.closePath();
      c.fill();
    });
  }
  ctx.restore();
  airmailStamp(ctx, -15, -9, 10, 8);

  withInk(ctx, 'graphite', (c) => {
    c.lineJoin = 'round';
    c.lineWidth = 2.2;
    c.strokeStyle = INK.graphite;
    c.stroke(keel);
    c.stroke(wing);
    c.globalAlpha = 0.7;
    c.beginPath(); // the fold crease
    c.moveTo(N.x - 2, N.y + 0.4);
    c.lineTo(R.x, R.y);
    c.stroke();
  });
  ctx.restore();
}

const BALL = wobbleCircle(0, 0, 15, 404, 4.5, 11);
const CREASES = new Path2D('M-9 -6 L2 -2 L8 -9 M-4 7 L1 -1 L11 4 M-12 2 L-5 1');

/** The glider after a crash: a crumpled airmail ball, chevron scraps showing through. */
export function drawCrumpled(ctx: CanvasRenderingContext2D, x: number, y: number, rotation: number, scale = 1.4): void {
  const ball = polyPath(BALL);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(scale, scale);
  withInk(ctx, 'paper', (c) => {
    c.lineWidth = 7;
    c.lineJoin = 'round';
    c.strokeStyle = INK.paper;
    c.stroke(ball);
    c.fill(ball);
  });
  withInk(ctx, 'blue', (c) => c.fill(ball), halftone(ctx, 'blue', 0.22, 4));
  withInk(ctx, 'red', (c) => c.fill(new Path2D('M4 -14 L11 -9 L7 -6 Z M-14 5 L-9 11 L-7 6 Z')));
  withInk(ctx, 'blue', (c) => c.fill(new Path2D('M9 -11 L14 -4 L10 -3 Z M-11 9 L-5 13 L-5 9 Z')));
  withInk(ctx, 'graphite', (c) => {
    c.lineJoin = 'round';
    c.lineWidth = 2.2;
    c.stroke(ball);
    c.lineWidth = 1.2;
    c.globalAlpha = 0.75;
    c.stroke(CREASES);
  });
  ctx.restore();
}
