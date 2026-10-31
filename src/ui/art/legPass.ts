import { CANVAS_HEIGHT as H, CANVAS_WIDTH as W, GROUND_HEIGHT } from '../../game/constants';
import { band, FLOOR, ridge, type Band } from './band';
import { withInk } from './ink';
import type { LegArt } from './legs';
import { halftone } from './paper';
import { polyPath, rng, wobbleCircle, wobbleRect } from './wobble';

/** Leg 3 · The Pass: snowy peaks, pine ridges; icy ledges above and stone cairns below. */

function pines(base: number, x0: number, count: number, spacing: number, size: number, r: () => number): Path2D {
  const p = new Path2D();
  for (let i = 0; i < count; i++) {
    const x = x0 + i * spacing + r() * spacing * 0.5;
    const h = size * (0.7 + r() * 0.6);
    p.moveTo(x - h * 0.32, base);
    p.lineTo(x, base - h);
    p.lineTo(x + h * 0.32, base);
    p.closePath();
  }
  return p;
}

function bands(): Band[] {
  const far = band(1600, 0.08, 280, (c, wrap) => {
    const r = rng(71);
    const peaks = Array.from({ length: 8 }, (_, i) => ({ x: i * 200 + r() * 80, h: 120 + r() * 110 }));
    wrap((dx) => {
      const range = new Path2D();
      range.moveTo(dx, FLOOR);
      range.lineTo(dx, 520);
      for (const p of peaks) range.lineTo(dx + p.x - 90, 520), range.lineTo(dx + p.x, 520 - p.h), range.lineTo(dx + p.x + 90, 520);
      range.lineTo(dx + 1600, 520);
      range.lineTo(dx + 1600, FLOOR);
      withInk(c, 'fog', (k) => ((k.globalAlpha = 0.5), k.fill(range)));
      for (const p of peaks) {
        const cap = new Path2D(`M${dx + p.x - 30} ${520 - p.h + 34} L${dx + p.x} ${520 - p.h} L${dx + p.x + 30} ${520 - p.h + 34} L${dx + p.x + 12} ${520 - p.h + 26} L${dx + p.x} ${520 - p.h + 36} L${dx + p.x - 12} ${520 - p.h + 26} Z`);
        withInk(c, 'paper', (k) => ((k.globalAlpha = 0.85), k.fill(cap)));
      }
    });
  });
  const mid = band(1100, 0.3, 470, (c, wrap) => {
    wrap((dx) => {
      const hill = ridge(dx, dx + 1100, 590, (x) => 26 + 18 * Math.sin(((x - dx) / 1100) * Math.PI * 4));
      withInk(c, 'fog', (k) => ((k.globalAlpha = 0.55), k.fill(hill)));
      const trees = pines(600, dx, 22, 50, 60, rng(5));
      withInk(c, 'fog', (k) => ((k.globalAlpha = 0.8), k.fill(trees)));
      withInk(c, 'blue', (k) => k.fill(trees), halftone(c, 'blue', 0.15));
    });
  });
  const near = band(900, 0.6, 520, (c, wrap) => {
    wrap((dx) => {
      const trees = pines(FLOOR + 4, dx, 12, 75, 120, rng(9));
      withInk(c, 'fog', (k) => k.fill(trees));
      withInk(c, 'blue', (k) => k.fill(trees), halftone(c, 'blue', 0.22));
    });
  });
  return [far, mid, near];
}

function sky(ctx: CanvasRenderingContext2D): void {
  withInk(ctx, 'paper', (c) => c.fillRect(0, 0, W, H));
  withInk(ctx, 'fog', (c) => c.fillRect(0, 0, W, 150), halftone(ctx, 'fog', 0.42));
  withInk(ctx, 'fog', (c) => c.fillRect(0, 150, W, 110), halftone(ctx, 'fog', 0.2));
  withInk(ctx, 'ochre', (c) => ((c.globalAlpha = 0.4), c.fill(polyPath(wobbleCircle(300, 210, 46, 13, 1, 40)))));
}

/** Snowfield: solid blue ground under a wobbling paper drift line. */
function street(ctx: CanvasRenderingContext2D, scroll: number): void {
  withInk(ctx, 'blue', (c) => c.fillRect(0, FLOOR, W, GROUND_HEIGHT));
  withInk(ctx, 'paper', (c) => {
    const off = scroll % 160;
    c.beginPath();
    c.moveTo(0, FLOOR);
    for (let x = -off; x <= W + 160; x += 20) c.lineTo(x, FLOOR + 9 + 5 * Math.sin((x + off) * 0.039));
    c.lineTo(W, FLOOR);
    c.closePath();
    c.fill();
  });
}

/** Top gate: a blue rock ledge, paper icicles hanging inside its lower edge. */
function ledge(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number): void {
  const rock = polyPath(wobbleRect(x, y, w, h, seed, 3, 10));
  withInk(c, 'paper', (k) => k.fill(rock));
  withInk(c, 'blue', (k) => k.fill(rock));
  const r = rng(seed);
  withInk(c, 'paper', (k) => {
    k.beginPath();
    for (let ix = x + 5; ix < x + w - 10; ix += 11 + r() * 6) {
      const len = 14 + r() * 26;
      k.moveTo(ix, y + h - len - 6);
      k.lineTo(ix + 9, y + h - len - 6);
      k.lineTo(ix + 4.5, y + h - 3);
      k.closePath();
    }
    k.fill();
    k.fillRect(x + 4, y + h - 46, w - 8, 4); // a shelf of snow
  });
  withInk(c, 'graphite', (k) => ((k.lineWidth = 2.6), (k.lineJoin = 'round'), k.stroke(rock)));
}

/** Bottom gate: a cairn of stacked stones with a snowcap, built up from the ground. */
function cairn(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number): void {
  const r = rng(seed);
  let top = y + h;
  let first = true;
  while (top > y) {
    const sh = Math.min(top - y, 28 + r() * 22);
    const last = top - sh <= y;
    const inset = last ? 0 : r() * 8;
    const stone = new Path2D();
    stone.roundRect(x + inset, top - sh, w - inset * 2, sh, 9);
    withInk(c, 'paper', (k) => k.fill(stone));
    withInk(c, 'fog', (k) => k.fill(stone));
    withInk(c, 'graphite', (k) => k.fill(stone), halftone(c, 'graphite', first ? 0.3 : 0.18 + r() * 0.12, 4));
    withInk(c, 'graphite', (k) => ((k.lineWidth = 2.4), k.stroke(stone)));
    top -= sh;
    first = false;
  }
  const snow = new Path2D(`M${x + 2} ${y + 16} Q${x + w * 0.25} ${y + 2} ${x + w * 0.5} ${y + 6} T${x + w - 2} ${y + 14} L${x + w - 6} ${y + 20} L${x + 6} ${y + 22} Z`);
  withInk(c, 'paper', (k) => k.fill(snow));
  withInk(c, 'graphite', (k) => ((k.lineWidth = 2.2), (k.lineJoin = 'round'), k.stroke(snow)));
}

export const pass: LegArt = { name: 'THE PASS', dark: false, bands, sky, street, top: ledge, bottom: cairn };
