import { CANVAS_HEIGHT, GROUND_HEIGHT } from '../../game/constants';
import { inkText, pencil, withInk } from './ink';
import { halftone } from './paper';
import { TYPE } from './palette';
import { airmailStamp, postDate, postmark, rubberStamp } from './stamps';
import type { Pt } from './wobble';

const FLOOR = CANVAS_HEIGHT - GROUND_HEIGHT;

export interface PostcardOpts {
  x: number;
  y: number;
  score: number;
  best: number;
  newBest: boolean;
  route: readonly Pt[];
  leg: string;
  hint: string;
  progress: number;
}

/** Game over: a postcard of this run, its route traced in pencil, stamped RETURN TO SENDER. */
export function drawPostcard(ctx: CanvasRenderingContext2D, o: PostcardOpts): void {
  const w = 620;
  const h = 340;
  const L = -w / 2;
  const T = -h / 2;
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.rotate((-2.5 * Math.PI) / 180);
  withInk(ctx, 'blue', (c) => c.fillRect(L + 10, T + 12, w, h), halftone(ctx, 'blue', 0.45, 4));
  withInk(ctx, 'paper', (c) => c.fillRect(L, T, w, h));
  pencil(ctx, new Path2D(`M${L} ${T} h${w} v${h} h${-w} Z`), 2.4);
  pencil(ctx, new Path2D(`M${L + 344} ${T + 34} V${T + h - 70}`), 1.2);

  // Left: the route map.
  const box = { x: L + 24, y: T + 56, w: 298, h: 160 };
  inkText(ctx, 'graphite', 'YOUR GLIDEPATH', box.x, T + 40, `700 15px ${TYPE}`, { spacing: 2 });
  withInk(ctx, 'fog', (c) => c.fillRect(box.x, box.y, box.w, box.h), halftone(ctx, 'fog', 0.35));
  pencil(ctx, new Path2D(`M${box.x} ${box.y} h${box.w} v${box.h} h${-box.w} Z`), 1);
  routeInto(ctx, o.route, box);
  inkText(ctx, 'graphite', `${o.score} ${o.score === 1 ? 'gate' : 'gates'} delivered`, box.x, box.y + box.h + 30, `700 17px ${TYPE}`);
  inkText(ctx, 'graphite', `Best ${o.best}`, box.x, box.y + box.h + 54, `400 17px ${TYPE}`);

  // Right: stamp, postmark, address.
  airmailStamp(ctx, -L - 78, T + 22, 54, 64);
  postmark(ctx, -L - 112, T + 72, 46, { top: 'GLIDEPATH', bottom: postDate(), center: String(o.score), rot: -12, seed: o.score + 3 });
  const ax = L + 366;
  ['TO: THE SKY ABOVE', o.leg, 'BY AIR, BY HAND'].forEach((line, i) => {
    const y = T + 158 + i * 38;
    pencil(ctx, new Path2D(`M${ax} ${y + 6} H${-L - 26}`), 1);
    inkText(ctx, 'graphite', line, ax + 4, y, `400 16px ${TYPE}`);
  });
  if (o.newBest && o.score > 0) rubberStamp(ctx, 'NEW BEST', L + 210, T + 262, 18, 'blue', -5);
  rubberStamp(ctx, 'RETURN TO SENDER', L + 214, T + 132, 28, 'red', -9);

  // Footer: how to go again, with the hold progress inking in underneath.
  inkText(ctx, 'graphite', o.hint, L + 24, T + h - 32, `700 16px ${TYPE}`);
  if (o.progress > 0) withInk(ctx, 'red', (c) => c.fillRect(L + 24, T + h - 20, (w - 48) * Math.min(1, o.progress), 4));
  ctx.restore();
}

function routeInto(ctx: CanvasRenderingContext2D, route: readonly Pt[], box: { x: number; y: number; w: number; h: number }): void {
  if (route.length < 2) return;
  const span = route[route.length - 1].x - route[0].x || 1;
  const px = (p: Pt) => box.x + 8 + ((p.x - route[0].x) / span) * (box.w - 16);
  const py = (p: Pt) => box.y + 8 + (p.y / FLOOR) * (box.h - 16);
  const path = new Path2D();
  route.forEach((p, i) => (i ? path.lineTo(px(p), py(p)) : path.moveTo(px(p), py(p))));
  pencil(ctx, path, 1.8, [1, 4]);
  const a = route[0];
  const z = route[route.length - 1];
  withInk(ctx, 'blue', (c) => {
    c.beginPath();
    c.arc(px(a), py(a), 4, 0, Math.PI * 2);
    c.fill();
  });
  withInk(ctx, 'red', (c) => {
    c.lineWidth = 3;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(px(z) - 6, py(z) - 6);
    c.lineTo(px(z) + 6, py(z) + 6);
    c.moveTo(px(z) + 6, py(z) - 6);
    c.lineTo(px(z) - 6, py(z) + 6);
    c.stroke();
  });
}
