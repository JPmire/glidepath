import { pencil, withInk } from './ink';
import { halftone } from './paper';
import { INK } from './palette';
import { polyPath, rng, wobbleRect } from './wobble';

/**
 * Leg 1 gates. Every filled shape stays inside the collision rect (x, y, w, h); only graphite
 * smoke and string, which are visibly not solid, may cross it.
 */

/** Bottom obstacle: a brick chimney stack with a blue capstone at the gap edge. */
export function drawChimney(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number): void {
  const capH = 16;
  const bx = x + 6;
  const bw = w - 12;
  const body = polyPath(wobbleRect(bx, y + capH, bw, h - capH, seed, 1.5));
  // Paper underlay so the stack is opaque against the scenery instead of overprinting it.
  withInk(ctx, 'paper', (c) => c.fill(body));
  withInk(ctx, 'red', (c) => c.fill(body));
  // Mortar knocked out of the red, staggered courses.
  withInk(ctx, 'paper', (c) => {
    c.save();
    c.clip(body);
    c.globalAlpha = 0.85;
    for (let row = 0, yy = y + capH + 9; yy < y + h; row++, yy += 10) {
      c.fillRect(bx, yy, bw, 1.6);
      for (let xx = bx + (row % 2 ? 10 : 0); xx < bx + bw; xx += 21) c.fillRect(xx, yy - 10, 1.6, 10);
    }
    c.restore();
  });
  // Shadow side: blue screen overprinting the brick.
  withInk(ctx, 'blue', (c) => c.fillRect(bx + bw * 0.66, y + capH, bw * 0.34, h - capH), halftone(ctx, 'blue', 0.4));

  const cap = polyPath(wobbleRect(x, y, w, capH, seed + 1, 1.2, 10));
  withInk(ctx, 'blue', (c) => c.fill(cap));
  withInk(ctx, 'paper', (c) => c.fillRect(x + 4, y + capH - 5, w - 8, 1.5));
  // Heavy keyline: gameplay objects always carry a firm edge the scenery never has.
  withInk(ctx, 'graphite', (c) => {
    c.lineWidth = 2.6;
    c.lineJoin = 'round';
    c.stroke(body);
    c.stroke(cap);
  });

  // Smoke: pencil curls drifting up out of the stack (decoration, not solid).
  const r = rng(seed + 9);
  const smoke = new Path2D();
  const sx = x + w * (0.3 + r() * 0.4);
  smoke.moveTo(sx, y - 4);
  for (let i = 1; i <= 3; i++) {
    const cy = y - 4 - i * 16;
    smoke.bezierCurveTo(sx - 14 + i * 3, cy + 10, sx + 16 - i * 2, cy + 6, sx + i * 7, cy - 4);
  }
  pencil(ctx, smoke, 1.4);
}

/** Top obstacle: a column of brown-paper parcels, tied with string, stacked down from the sky. */
export function drawParcels(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number): void {
  const r = rng(seed);
  let bottom = y + h;
  let first = true;
  while (bottom > y) {
    const ph = Math.min(bottom - y, 30 + r() * 26);
    const inset = first ? 0 : r() * 7;
    const px = x + inset + (first ? 0 : (r() - 0.5) * 4 + 2);
    const pw = w - inset * 2;
    const top = bottom - ph;
    const box = polyPath(wobbleRect(Math.max(x, px), top, Math.min(pw, x + w - Math.max(x, px)), ph, seed + top, 1.4, 12));
    withInk(ctx, 'paper', (c) => c.fill(box));
    withInk(ctx, 'ochre', (c) => c.fill(box));
    withInk(ctx, 'graphite', (c) => c.fill(box), halftone(ctx, 'graphite', 0.12, 4));
    withInk(ctx, 'graphite', (c) => {
      c.lineWidth = 2.4;
      c.lineJoin = 'round';
      c.stroke(box);
      c.globalAlpha = 0.8;
      c.lineWidth = 1.1;
      c.beginPath(); // string, tied in a cross
      const sx = px + pw * (0.35 + r() * 0.3);
      c.moveTo(sx, top + 1);
      c.lineTo(sx, bottom - 1);
      c.moveTo(px + 1, top + ph * 0.5);
      c.lineTo(px + pw - 1, top + ph * 0.5);
      c.stroke();
    });
    if (r() < 0.55 && pw > 40) {
      const lx = px + 6 + r() * (pw - 36);
      const ly = top + 4 + r() * Math.max(0, ph * 0.5 - 14);
      withInk(ctx, 'paper', (c) => c.fillRect(lx, ly, 22, 11));
      withInk(ctx, 'graphite', (c) => {
        c.globalAlpha = 0.7;
        c.fillStyle = INK.graphite;
        c.fillRect(lx + 3, ly + 3, 14, 1);
        c.fillRect(lx + 3, ly + 6, 10, 1);
      });
      if (r() < 0.5) withInk(ctx, 'red', (c) => c.fillRect(lx + 17, ly + 1.5, 3.5, 4));
    }
    bottom = top;
    first = false;
  }
}
