import { inkText, pencil, withInk } from './ink';
import { halftone } from './paper';
import { DISPLAY, TYPE, type Ink } from './palette';
import { airmailBand, rubberStamp } from './stamps';

export interface SlipOpts {
  x: number;
  y: number;
  w: number;
  title: string;
  lines: string[];
  rot?: number;
  stamp?: { text: string; ink: Ink };
}

/** A typewritten paper slip taped over the scene: the game's voice for READY and PAUSED. */
export function drawSlip(ctx: CanvasRenderingContext2D, o: SlipOpts): void {
  const pad = 26;
  const h = pad + 44 + o.lines.length * 27 + pad - 6;
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.rotate(((o.rot ?? 0) * Math.PI) / 180);
  withInk(ctx, 'blue', (c) => c.fillRect(9, 11, o.w, h), halftone(ctx, 'blue', 0.45, 4));
  withInk(ctx, 'paper', (c) => c.fillRect(0, 0, o.w, h));
  const spine = new Path2D();
  spine.rect(0, 0, 10, h);
  airmailBand(ctx, spine, h);
  pencil(ctx, new Path2D(`M0 0 h${o.w} v${h} h${-o.w} Z`), 2);
  for (const [tx, r] of [[30, -0.35], [o.w - 30, 0.3]] as const) {
    withInk(ctx, 'fog', (c) => {
      c.globalAlpha = 0.6;
      c.translate(tx, 0);
      c.rotate(r);
      c.fillRect(-22, -8, 44, 16);
    });
  }
  inkText(ctx, 'blue', o.title, pad + 8, pad + 30, `800 36px ${DISPLAY}`, { spacing: 1 });
  o.lines.forEach((line, i) => inkText(ctx, 'graphite', line, pad + 8, pad + 72 + i * 27, `400 17px ${TYPE}`));
  if (o.stamp) rubberStamp(ctx, o.stamp.text, o.w - 64, pad + 18, 22, o.stamp.ink, 9);
  ctx.restore();
}

/** Hold-to-launch progress: a red postmark ring inking itself around the glider. */
export function holdRing(ctx: CanvasRenderingContext2D, x: number, y: number, progress: number): void {
  if (progress <= 0) return;
  withInk(ctx, 'graphite', (c) => {
    c.globalAlpha = 0.5;
    c.lineWidth = 1.2;
    c.setLineDash([2, 5]);
    c.beginPath();
    c.arc(x, y, 50, 0, Math.PI * 2);
    c.stroke();
  });
  withInk(ctx, 'red', (c) => {
    c.lineWidth = 5;
    c.lineCap = 'round';
    c.beginPath();
    c.arc(x, y, 50, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, progress));
    c.stroke();
  });
}
