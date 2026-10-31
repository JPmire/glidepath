import { INK, REGISTER, type Ink } from './palette';

/**
 * Print one ink pass: multiply-blended (overprints mix like real riso inks) and shifted by that
 * ink's fixed misregistration. `paper` is a knockout: it covers instead of multiplying.
 */
export function withInk(
  ctx: CanvasRenderingContext2D,
  ink: Ink,
  draw: (ctx: CanvasRenderingContext2D) => void,
  fill: string | CanvasPattern = INK[ink],
): void {
  ctx.save();
  ctx.globalCompositeOperation = ink === 'paper' ? 'source-over' : 'multiply';
  const [dx, dy] = REGISTER[ink];
  ctx.translate(dx, dy);
  ctx.fillStyle = fill;
  ctx.strokeStyle = INK[ink];
  draw(ctx);
  ctx.restore();
}

/** Pencil stroke: graphite (or paper, on dark stock), slightly translucent, round caps. */
export function pencil(ctx: CanvasRenderingContext2D, path: Path2D, width = 1.6, dash: number[] = [], ink: Ink = 'graphite'): void {
  withInk(ctx, ink, (c) => {
    c.globalAlpha = 0.85;
    c.lineWidth = width;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.setLineDash(dash);
    c.stroke(path);
  });
}

/** Text set in one ink, with optional rotation about its anchor. */
export function inkText(
  ctx: CanvasRenderingContext2D,
  ink: Ink,
  text: string,
  x: number,
  y: number,
  font: string,
  opts: { align?: CanvasTextAlign; rot?: number; spacing?: number } = {},
): void {
  withInk(ctx, ink, (c) => {
    c.translate(x, y);
    if (opts.rot) c.rotate((opts.rot * Math.PI) / 180);
    c.font = font;
    c.textAlign = opts.align ?? 'left';
    c.textBaseline = 'alphabetic';
    if (opts.spacing) c.letterSpacing = `${opts.spacing}px`;
    c.fillText(text, 0, 0);
  });
}
