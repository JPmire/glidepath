import { withInk } from './ink';
import { INK } from './palette';

// The printer's pointing hand, drawn pointing right in a ~100×50 box. Fingertip at (97, 12.5).
const TIP = { x: 97, y: 12.5 };
const HAND =
  'M15 11 C24 6 34 5 45 7 L91 7 C99 7 99 18 91 18 L56 18 C64 18 66 27 57 28 ' +
  'C65 29 65 37 56 37 C63 38 62 46 53 46 L41 46 C30 47 22 45 15 42 Z';
const CUFF = 'M3 6 L15 9 L15 44 L3 47 C1 34 1 19 3 6 Z';
const DETAIL = 'M22 14 C32 15 42 20 56 18 M85 9 C83 11 83 15 85 17 M9 9 C8 22 8 32 9 44 M48 28 L57 28 M47 37 L56 37';

// Built on first draw so importing this module stays DOM-free (tests run in Node).
let paths: { hand: Path2D; cuff: Path2D; detail: Path2D } | null = null;

/** Draws the manicule with its fingertip at (x, y), pointing right (dir 1) or left (dir −1). */
export function drawManicule(ctx: CanvasRenderingContext2D, x: number, y: number, scale = 0.6, dir: 1 | -1 = 1): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir * scale, scale);
  ctx.translate(-TIP.x, -TIP.y);
  paths ??= { hand: new Path2D(HAND), cuff: new Path2D(CUFF), detail: new Path2D(DETAIL) };
  const { hand, cuff, detail } = paths;
  withInk(ctx, 'paper', (c) => c.fill(hand));
  withInk(ctx, 'blue', (c) => c.fill(cuff));
  withInk(ctx, 'graphite', (c) => {
    c.lineWidth = 2.4 / scale;
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.strokeStyle = INK.graphite;
    c.stroke(hand);
    c.stroke(cuff);
    c.lineWidth = 1.6 / scale;
    c.stroke(detail);
  });
  ctx.restore();
}
