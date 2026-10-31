import { withInk } from './ink';
import { DISPLAY, TYPE, type Ink } from './palette';
import { polyPath, wobbleCircle } from './wobble';

/** Postage-stamp outline: a rectangle with semicircular perforation bites along every edge. */
export function perforatedPath(x: number, y: number, w: number, h: number, r = 3.5, pitch = 12): Path2D {
  const p = new Path2D();
  const nx = Math.max(1, Math.round(w / pitch));
  const ny = Math.max(1, Math.round(h / pitch));
  const sx = w / nx;
  const sy = h / ny;
  p.moveTo(x, y);
  for (let i = 0; i < nx; i++) p.arc(x + sx * (i + 0.5), y, r, Math.PI, 0, true);
  p.lineTo(x + w, y);
  for (let i = 0; i < ny; i++) p.arc(x + w, y + sy * (i + 0.5), r, -Math.PI / 2, Math.PI / 2, true);
  p.lineTo(x + w, y + h);
  for (let i = nx - 1; i >= 0; i--) p.arc(x + sx * (i + 0.5), y + h, r, 0, Math.PI, true);
  p.lineTo(x, y + h);
  for (let i = ny - 1; i >= 0; i--) p.arc(x, y + sy * (i + 0.5), r, Math.PI / 2, -Math.PI / 2, true);
  p.closePath();
  return p;
}

function arcText(c: CanvasRenderingContext2D, text: string, r: number, top: boolean): void {
  const chars = [...text];
  const widths = chars.map((ch) => c.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) / r;
  let a = top ? -Math.PI / 2 - total / 2 : Math.PI / 2 + total / 2;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  chars.forEach((ch, i) => {
    const da = widths[i] / r;
    c.save();
    c.rotate(top ? a + da / 2 : a - da / 2);
    c.translate(r, 0);
    c.rotate(top ? Math.PI / 2 : -Math.PI / 2);
    c.fillText(ch, 0, 0);
    c.restore();
    a += top ? da : -da;
  });
}

export interface PostmarkOpts {
  top: string;
  bottom: string;
  center: string;
  rot?: number;
  ink?: Ink;
  /** Wavy cancellation bars trailing to the right. */
  cancel?: boolean;
  alpha?: number;
  seed?: number;
}

/** Circular date-stamp: double ring, text on both arcs, a big stencil centre. */
export function postmark(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, o: PostmarkOpts): void {
  const ink = o.ink ?? 'red';
  withInk(ctx, ink, (c) => {
    c.translate(cx, cy);
    c.rotate(((o.rot ?? 0) * Math.PI) / 180);
    c.globalAlpha = o.alpha ?? 0.92;
    c.lineWidth = Math.max(1.5, r * 0.05);
    c.stroke(polyPath(wobbleCircle(0, 0, r, o.seed ?? 3, r * 0.02, 48)));
    c.lineWidth = Math.max(1, r * 0.03);
    c.stroke(polyPath(wobbleCircle(0, 0, r * 0.66, (o.seed ?? 3) + 1, r * 0.015, 40)));
    c.font = `700 ${Math.round(r * 0.2)}px ${TYPE}`;
    arcText(c, o.top, r * 0.83, true);
    arcText(c, o.bottom, r * 0.83, false);
    c.font = `800 ${Math.round(r * 0.78)}px ${DISPLAY}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(o.center, 0, r * 0.05);
    if (o.cancel) {
      c.lineWidth = Math.max(1.5, r * 0.05);
      for (let i = -2; i <= 2; i++) {
        c.beginPath();
        const y = i * r * 0.22;
        for (let x = r * 1.12; x <= r * 3.2; x += 3) c.lineTo(x, y + Math.sin(x * 0.11) * r * 0.06);
        c.stroke();
      }
    }
  });
}

/** Rubber-stamp word in a double-ruled box, e.g. STEERING, HELD, RETURN TO SENDER. */
export function rubberStamp(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size = 22, ink: Ink = 'blue', rot = -3): void {
  withInk(ctx, ink, (c) => {
    c.translate(x, y);
    c.rotate((rot * Math.PI) / 180);
    c.font = `800 ${size}px ${DISPLAY}`;
    c.letterSpacing = `${size * 0.08}px`;
    const w = c.measureText(text).width + size * 0.9;
    const h = size * 1.35;
    c.globalAlpha = 0.9;
    c.lineWidth = size * 0.09;
    c.strokeRect(-w / 2, -h / 2, w, h);
    c.lineWidth = size * 0.04;
    c.strokeRect(-w / 2 + size * 0.17, -h / 2 + size * 0.17, w - size * 0.34, h - size * 0.34);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text, size * 0.04, size * 0.06);
  });
}

/** Small airmail stamp: perforated paper, red field, a tiny glider knocked out. */
export function airmailStamp(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const edge = perforatedPath(x, y, w, h, Math.max(1, w * 0.06), Math.max(3, w * 0.2));
  withInk(ctx, 'paper', (c) => c.fill(edge));
  withInk(ctx, 'red', (c) => c.fillRect(x + w * 0.14, y + h * 0.14, w * 0.72, h * 0.72));
  // Wing and keel as two separate facets, so the red fold line between them reads as a plane.
  const P = (u: number, v: number) => [x + w * u, y + h * v] as const;
  const [N, U, R, K] = [P(0.8, 0.36), P(0.2, 0.24), P(0.38, 0.47), P(0.3, 0.68)];
  withInk(ctx, 'paper', (c) => {
    c.beginPath();
    c.moveTo(...N);
    c.lineTo(...U);
    c.lineTo(...R);
    c.closePath();
    c.moveTo(N[0] - w * 0.03, N[1] + h * 0.04);
    c.lineTo(R[0], R[1] + h * 0.05);
    c.lineTo(...K);
    c.closePath();
    c.fill();
  });
  withInk(ctx, 'graphite', (c) => {
    c.globalAlpha = 0.6;
    c.lineWidth = 0.8;
    c.stroke(edge);
  });
}

/** Airmail border: red / blue diagonal bars, clipped to `region` (envelope edges, slip spines). */
export function airmailBand(ctx: CanvasRenderingContext2D, region: Path2D, extent: number, fillRule: CanvasFillRule = 'nonzero'): void {
  ctx.save();
  ctx.clip(region, fillRule);
  ctx.rotate(Math.PI / 4);
  for (let k = -extent * 1.5; k < extent * 1.5; k += 28) {
    withInk(ctx, 'red', (c) => c.fillRect(k, -extent * 1.5, 9, extent * 3));
    withInk(ctx, 'blue', (c) => c.fillRect(k + 14, -extent * 1.5, 9, extent * 3));
  }
  ctx.restore();
}

/** Today as a date-stamp reads it: 31 OCT 2026. */
export function postDate(d = new Date()): string {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase().replace('SEPT', 'SEP');
}
