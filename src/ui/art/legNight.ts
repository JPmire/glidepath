import { CANVAS_HEIGHT as H, CANVAS_WIDTH as W, GROUND_HEIGHT } from '../../game/constants';
import { band, FLOOR, house, ridge, type Band } from './band';
import { withInk } from './ink';
import type { LegArt } from './legs';
import { halftone } from './paper';
import { polyPath, rng, wobbleCircle, wobbleRect } from './wobble';

/**
 * Leg 4 · Night Post: the same inks printed on blue stock. Scenery stays within a few shades of
 * the sky; gates are pale paper so they still out-contrast everything.
 */

function bands(): Band[] {
  const far = band(1400, 0.1, 380, (c, wrap) => {
    wrap((dx) => {
      const hills = ridge(dx, dx + 1400, 520, (x) => 40 + 34 * Math.sin(((x - dx) / 1400) * Math.PI * 4));
      withInk(c, 'paper', (k) => k.fill(hills));
      withInk(c, 'blue', (k) => k.fill(hills));
      withInk(c, 'graphite', (k) => k.fill(hills), halftone(c, 'graphite', 0.22));
    });
  }, 'source-over');
  const mid = band(1100, 0.3, 400, (c, wrap) => {
    const r = rng(23);
    const specs = Array.from({ length: 14 }, (_, i) => [i * 80, 52 + r() * 24, 55 + r() * 80, 18 + r() * 24] as const);
    wrap((dx) => {
      const rr = rng(5);
      for (const [x, w, h, roof] of specs) {
        const p = house(x + dx, 610, w, h, roof, rr);
        withInk(c, 'paper', (k) => k.fill(p));
        withInk(c, 'blue', (k) => k.fill(p));
        withInk(c, 'graphite', (k) => k.fill(p), halftone(c, 'graphite', 0.38));
        for (let wy = 610 - h + 14; wy < 590; wy += 24)
          for (let wx = x + dx + 10; wx < x + dx + w - 16; wx += 20)
            if (rr() < 0.45) withInk(c, 'paper', (k) => k.fillRect(wx, wy, 8, 11)), withInk(c, 'ochre', (k) => k.fillRect(wx, wy, 8, 11));
      }
    });
  }, 'source-over');
  const near = band(900, 0.62, 520, (c, wrap) => {
    const r = rng(41);
    const specs = Array.from({ length: 8 }, (_, i) => [i * 112, 112, 22 + r() * 48, 14 + r() * 22] as const);
    wrap((dx) => {
      const rr = rng(8);
      for (const [x, w, h, roof] of specs) {
        const p = house(x + dx, FLOOR, w, h, roof, rr);
        withInk(c, 'paper', (k) => k.fill(p));
        withInk(c, 'blue', (k) => k.fill(p));
        withInk(c, 'graphite', (k) => k.fill(p), halftone(c, 'graphite', 0.6));
      }
      for (const lx of [200, 650]) {
        withInk(c, 'graphite', (k) => k.fillRect(dx + lx, FLOOR - 110, 4, 110));
        withInk(c, 'paper', (k) => k.fill(polyPath(wobbleCircle(dx + lx + 2, FLOOR - 114, 7, lx, 0.6, 16))));
        withInk(c, 'ochre', (k) => k.fill(polyPath(wobbleCircle(dx + lx + 2, FLOOR - 114, 7, lx, 0.6, 16))));
      }
    });
  }, 'source-over');
  return [far, mid, near];
}

function sky(ctx: CanvasRenderingContext2D): void {
  withInk(ctx, 'paper', (c) => c.fillRect(0, 0, W, H));
  withInk(ctx, 'blue', (c) => c.fillRect(0, 0, W, H));
  withInk(ctx, 'graphite', (c) => c.fillRect(0, 0, W, 160), halftone(ctx, 'graphite', 0.3));
  const r = rng(99);
  withInk(ctx, 'paper', (c) => {
    for (let i = 0; i < 70; i++) {
      c.globalAlpha = 0.4 + r() * 0.6;
      const s = r() < 0.85 ? 1.6 : 2.8;
      c.fillRect(r() * W, r() * 420, s, s);
    }
  });
  const moon = polyPath(wobbleCircle(1000, 150, 44, 8, 0.8, 40));
  withInk(ctx, 'paper', (c) => c.fill(moon));
  withInk(ctx, 'ochre', (c) => c.fill(moon), halftone(ctx, 'ochre', 0.35));
}

/** Night street: graphite, a lamplit kerb and faint cobbles. */
function street(ctx: CanvasRenderingContext2D, scroll: number): void {
  withInk(ctx, 'paper', (c) => c.fillRect(0, FLOOR, W, GROUND_HEIGHT));
  withInk(ctx, 'graphite', (c) => c.fillRect(0, FLOOR, W, GROUND_HEIGHT));
  withInk(ctx, 'paper', (c) => c.fillRect(0, FLOOR, W, 5));
  withInk(ctx, 'ochre', (c) => c.fillRect(0, FLOOR, W, 5));
  withInk(ctx, 'paper', (c) => {
    c.globalAlpha = 0.22;
    const off = scroll % 36;
    for (let row = 0; row < 3; row++)
      for (let x = -off - (row % 2) * 18; x < W; x += 36) c.fillRect(x, FLOOR + 13 + row * 11, 22, 3);
  });
}

/** Top gate: a cloud bank, its scalloped underside kept inside the collision rect. */
function cloud(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number): void {
  const r = 13;
  const p = new Path2D();
  p.moveTo(x, y);
  p.lineTo(x + w, y);
  p.lineTo(x + w, y + h - r);
  const n = Math.round(w / (r * 2));
  const step = w / n;
  for (let i = n - 1; i >= 0; i--) p.arc(x + step * (i + 0.5), y + h - r, step / 2, 0, Math.PI);
  p.closePath();
  withInk(c, 'paper', (k) => k.fill(p));
  withInk(c, 'fog', (k) => k.fill(p), halftone(c, 'fog', 0.45));
  withInk(c, 'paper', (k) => k.fill(polyPath(wobbleRect(x + 10, y + h - 40, w * 0.4, 8, seed, 2))));
  withInk(c, 'graphite', (k) => ((k.lineWidth = 2.6), (k.lineJoin = 'round'), k.stroke(p)));
}

/** Bottom gate: a lattice radio mast. Its warning lamp blinks (drawn live by the renderer). */
function mast(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number): void {
  const capH = 16;
  const body = polyPath(wobbleRect(x + 10, y + capH, w - 20, h - capH, seed, 1));
  withInk(c, 'paper', (k) => k.fill(body));
  withInk(c, 'red', (k) => {
    k.save();
    k.clip(body);
    k.lineWidth = 3;
    k.beginPath();
    for (let yy = y + capH; yy < y + h; yy += 30) {
      k.moveTo(x + 10, yy);
      k.lineTo(x + w - 10, yy + 30);
      k.moveTo(x + w - 10, yy);
      k.lineTo(x + 10, yy + 30);
      k.moveTo(x + 10, yy);
      k.lineTo(x + w - 10, yy);
    }
    k.stroke();
    k.restore();
  });
  const cap = polyPath(wobbleRect(x, y, w, capH, seed + 1, 1, 10));
  withInk(c, 'paper', (k) => k.fill(cap));
  withInk(c, 'graphite', (k) => ((k.lineWidth = 2.6), (k.lineJoin = 'round'), k.stroke(body), k.stroke(cap)));
}

export const night: LegArt = { name: 'NIGHT POST', dark: true, bands, sky, street, top: cloud, bottom: mast };
