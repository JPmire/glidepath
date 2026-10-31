import { CANVAS_HEIGHT as H, CANVAS_WIDTH as W, GROUND_HEIGHT } from '../../game/constants';
import { getArtScale } from './paper';

export const FLOOR = H - GROUND_HEIGHT;

/** A pre-rendered, seamlessly tiling parallax band covering only rows [top, FLOOR]. */
export interface Band {
  canvas: HTMLCanvasElement;
  period: number;
  parallax: number;
  top: number;
  /** Day bands overprint (multiply); night bands are painted opaque so lit windows can glow. */
  blend: GlobalCompositeOperation;
}

type Paint = (c: CanvasRenderingContext2D, wrap: (fn: (dx: number) => void) => void) => void;

export function band(period: number, parallax: number, top: number, paint: Paint, blend: GlobalCompositeOperation = 'multiply'): Band {
  const s = getArtScale();
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(period * s);
  canvas.height = Math.ceil((FLOOR - top) * s);
  const c = canvas.getContext('2d')!;
  c.scale(s, s);
  c.translate(0, -top);
  paint(c, (fn) => [-period, 0, period].forEach(fn));
  return { canvas, period, parallax, top, blend };
}

/** Draw a band scrolled by `scroll` world px. */
export function drawBand(ctx: CanvasRenderingContext2D, b: Band, scroll: number): void {
  const off = -((scroll * b.parallax) % b.period);
  ctx.save();
  ctx.globalCompositeOperation = b.blend;
  for (let x = off; x < W; x += b.period) ctx.drawImage(b.canvas, x, b.top, b.period, FLOOR - b.top);
  ctx.restore();
}

/** Gabled or flat-roofed house silhouette, optionally with a chimney. */
export function house(x: number, base: number, w: number, h: number, roof: number, r: () => number): Path2D {
  const p = new Path2D();
  p.moveTo(x, base);
  p.lineTo(x, base - h);
  if (r() < 0.65) p.lineTo(x + w / 2, base - h - roof); // gable
  else p.lineTo(x + w * 0.15, base - h - roof * 0.5), p.lineTo(x + w * 0.85, base - h - roof * 0.5);
  p.lineTo(x + w, base - h);
  p.lineTo(x + w, base);
  p.closePath();
  if (r() < 0.6) p.rect(x + w * (0.2 + r() * 0.5), base - h - roof * 0.9, 7, roof * 0.6); // chimney
  return p;
}

/** Rolling ridge line across [x0, x1] with a base at `base`, for hills and mountains. */
export function ridge(x0: number, x1: number, base: number, height: (x: number) => number): Path2D {
  const p = new Path2D();
  p.moveTo(x0, FLOOR);
  for (let x = x0; x <= x1; x += 16) p.lineTo(x, base - height(x));
  p.lineTo(x1, FLOOR);
  p.closePath();
  return p;
}
