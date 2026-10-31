import { CANVAS_HEIGHT as H, CANVAS_WIDTH as W, GROUND_HEIGHT } from '../../game/constants';
import { band, FLOOR, ridge, type Band } from './band';
import { pencil, withInk } from './ink';
import type { LegArt } from './legs';
import { halftone, lineScreen } from './paper';
import { polyPath, rng, wobbleCircle, wobbleRect } from './wobble';

/** Leg 2 · The Coast: headlands, white cliffs, a striped sea; lighthouses and rock overhangs. */

function bands(): Band[] {
  const far = band(1500, 0.1, 380, (c, wrap) => {
    withInk(c, 'fog', (k) => ((k.globalAlpha = 0.45), k.fill(ridge(-1500, 3000, 520, (x) => 40 + 30 * Math.sin((x / 1500) * Math.PI * 6)))));
    wrap((dx) => {
      const lx = 980 + dx; // a distant lighthouse on the far headland
      withInk(c, 'fog', (k) => ((k.globalAlpha = 0.7), k.fill(new Path2D(`M${lx} 470 L${lx + 4} 420 L${lx + 12} 420 L${lx + 16} 470 Z`))));
    });
  });
  const mid = band(1200, 0.28, 440, (c, wrap) => {
    const r = rng(61);
    const tops: number[] = Array.from({ length: 13 }, () => 500 + r() * 60);
    wrap((dx) => {
      const cliff = new Path2D();
      cliff.moveTo(dx, FLOOR);
      tops.forEach((y, i) => cliff.lineTo(dx + i * 100, y));
      cliff.lineTo(dx + 1200, tops[0]);
      cliff.lineTo(dx + 1200, FLOOR);
      cliff.closePath();
      withInk(c, 'fog', (k) => ((k.globalAlpha = 0.6), k.fill(cliff)));
      withInk(c, 'blue', (k) => k.fill(cliff), halftone(c, 'blue', 0.12));
    });
  });
  const near = band(800, 0.6, 590, (c, wrap) => {
    wrap((dx) => {
      withInk(c, 'fog', (k) => ((k.globalAlpha = 0.7), k.fillRect(dx, 600, 800, FLOOR - 600)));
      withInk(c, 'blue', (k) => ((k.globalAlpha = 0.45), k.fillRect(dx, 600, 800, FLOOR - 600)), lineScreen(c, 'blue', 1.4, 7));
      const waves = new Path2D();
      for (let i = 0; i < 9; i++) {
        const x = dx + i * 90 + (i % 3) * 17;
        const y = 616 + ((i * 23) % 44);
        waves.moveTo(x, y);
        waves.quadraticCurveTo(x + 10, y - 6, x + 20, y);
        waves.quadraticCurveTo(x + 30, y - 6, x + 40, y);
      }
      withInk(c, 'paper', (k) => ((k.lineWidth = 2), (k.lineCap = 'round'), k.stroke(waves)));
    });
  });
  return [far, mid, near];
}

function sky(ctx: CanvasRenderingContext2D): void {
  withInk(ctx, 'paper', (c) => c.fillRect(0, 0, W, H));
  withInk(ctx, 'fog', (c) => c.fillRect(0, 0, W, 130), halftone(ctx, 'fog', 0.3));
  withInk(ctx, 'fog', (c) => c.fillRect(0, 130, W, 120), halftone(ctx, 'fog', 0.12));
  withInk(ctx, 'ochre', (c) => ((c.globalAlpha = 0.55), c.fill(polyPath(wobbleCircle(1040, 250, 64, 31, 1, 48)))));
  const gulls = new Path2D();
  for (const [x, y, s] of [[760, 170, 1], [800, 196, 0.8], [860, 160, 0.7], [380, 230, 0.9]] as const) {
    gulls.moveTo(x - 9 * s, y);
    gulls.quadraticCurveTo(x - 4 * s, y - 6 * s, x, y);
    gulls.quadraticCurveTo(x + 4 * s, y - 6 * s, x + 9 * s, y);
  }
  pencil(ctx, gulls, 1.5);
}

/** Boardwalk: solid ochre planks with a blue rail, lethal like every ground. */
function street(ctx: CanvasRenderingContext2D, scroll: number): void {
  withInk(ctx, 'paper', (c) => c.fillRect(0, FLOOR, W, GROUND_HEIGHT));
  withInk(ctx, 'ochre', (c) => c.fillRect(0, FLOOR, W, GROUND_HEIGHT));
  withInk(ctx, 'blue', (c) => c.fillRect(0, FLOOR, W, 6));
  withInk(ctx, 'graphite', (c) => {
    c.globalAlpha = 0.7;
    const off = scroll % 34;
    for (let x = -off; x < W; x += 34) c.fillRect(x, FLOOR + 6, 2, GROUND_HEIGHT - 6);
    c.fillRect(0, FLOOR + 6, W, 2);
  });
}

/** Bottom gate: red-and-white striped lighthouse, the lamp room as the cap at the gap edge. */
function lighthouse(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number): void {
  const capH = 20;
  const body = polyPath(wobbleRect(x + 8, y + capH, w - 16, h - capH, seed, 1.2));
  withInk(c, 'paper', (k) => k.fill(body));
  withInk(c, 'red', (k) => {
    k.save();
    k.clip(body);
    for (let yy = y + capH + 12; yy < y + h; yy += 44) k.fillRect(x, yy, w, 22);
    k.restore();
  });
  withInk(c, 'blue', (k) => k.fillRect(x + 8 + (w - 16) * 0.66, y + capH, (w - 16) * 0.34, h - capH), halftone(c, 'blue', 0.35));
  const cap = polyPath(wobbleRect(x, y, w, capH, seed + 1, 1, 10));
  withInk(c, 'blue', (k) => k.fill(cap));
  withInk(c, 'ochre', (k) => k.fillRect(x + w * 0.3, y + 5, w * 0.4, 8)); // the lamp
  withInk(c, 'graphite', (k) => {
    k.lineWidth = 2.6;
    k.lineJoin = 'round';
    k.stroke(body);
    k.stroke(cap);
  });
}

/** Top gate: a slate rock overhang with strata and a jagged underside. */
function overhang(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number): void {
  const rock = polyPath(wobbleRect(x, y, w, h, seed, 5, 9));
  withInk(c, 'paper', (k) => k.fill(rock));
  withInk(c, 'fog', (k) => k.fill(rock));
  withInk(c, 'blue', (k) => k.fill(rock), halftone(c, 'blue', 0.5));
  const r = rng(seed);
  const strata = new Path2D();
  for (let yy = y + h - 18; yy > y; yy -= 22 + r() * 16) {
    strata.moveTo(x + 4, yy);
    strata.lineTo(x + w * 0.5, yy + (r() - 0.5) * 8);
    strata.lineTo(x + w - 4, yy + (r() - 0.5) * 8);
  }
  c.save();
  c.clip(rock);
  pencil(c, strata, 1.2);
  c.restore();
  withInk(c, 'graphite', (k) => ((k.lineWidth = 2.6), (k.lineJoin = 'round'), k.stroke(rock)));
}

export const coast: LegArt = { name: 'THE COAST', dark: false, bands, sky, street, top: overhang, bottom: lighthouse };
