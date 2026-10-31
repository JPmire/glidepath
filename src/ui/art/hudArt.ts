import { CANVAS_WIDTH as W } from '../../game/constants';
import { inkText, pencil, withInk } from './ink';
import { TYPE } from './palette';
import { postDate, postmark } from './stamps';
import { polyPath, wobbleCircle } from './wobble';

let paperDisc: Path2D | null = null;

/** The score: a date-stamp postmark top-left. On dark stock it sits on a scrap of envelope. */
export function scoreStamp(ctx: CanvasRenderingContext2D, score: number, pop: number, dark: boolean): void {
  ctx.save();
  ctx.translate(96, 96);
  const s = 1 + 0.2 * pop * pop;
  ctx.scale(s, s);
  if (dark) {
    paperDisc ??= polyPath(wobbleCircle(0, 0, 76, 17, 3, 30));
    withInk(ctx, 'paper', (c) => c.fill(paperDisc!));
  }
  postmark(ctx, 0, 0, 62, { top: 'GLIDEPATH · AIRMAIL', bottom: postDate(), center: String(score), rot: -6, cancel: !dark, seed: 4 });
  ctx.restore();
}

/** The leg title, taped across the top. `lift` peels it up and away. */
export function legSlip(ctx: CanvasRenderingContext2D, label: string, lift: number): void {
  ctx.save();
  ctx.translate(W / 2, 40 - lift);
  ctx.rotate((-1.2 * Math.PI) / 180);
  withInk(ctx, 'paper', (c) => c.fillRect(-170, -20, 340, 40));
  pencil(ctx, new Path2D('M-170 -20 h340 v40 h-340 Z'), 1.4);
  inkText(ctx, 'graphite', label, 0, 6, `700 18px ${TYPE}`, { align: 'center', spacing: 3 });
  for (const [tx, r] of [[-168, -0.5], [168, 0.45]] as const) {
    withInk(ctx, 'fog', (c) => {
      c.globalAlpha = 0.6;
      c.translate(tx, -16);
      c.rotate(r);
      c.fillRect(-18, -7, 36, 14);
    });
  }
  ctx.restore();
}

/** Torn page edge for the leg wipe: a paper deckle with a pencil line along it. */
export function tornEdge(ctx: CanvasRenderingContext2D, x: number, height: number): void {
  const p = new Path2D();
  p.moveTo(x, 0);
  for (let y = 0; y <= height; y += 12) p.lineTo(x + Math.sin(y * 0.37) * 5 + Math.sin(y * 0.11) * 4, y);
  withInk(ctx, 'paper', (c) => ((c.lineWidth = 7), c.stroke(p)));
  pencil(ctx, p, 1.6);
}
