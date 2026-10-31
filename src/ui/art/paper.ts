import { INK, SCREEN_ANGLE, type Ink } from './palette';
import { rng } from './wobble';

let artScale = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
const dpr = () => artScale;

/** Device px per logical px of the main canvas. Changing it rebuilds every cached pattern. */
export function setArtScale(s: number): void {
  if (s === artScale) return;
  artScale = s;
  halftones.clear();
  finishCache = null;
}

export const getArtScale = () => artScale;

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

/** Device-pixel pattern drawn at 1:1 regardless of the context's DPR scale. */
function devicePattern(ctx: CanvasRenderingContext2D, tile: HTMLCanvasElement, angleDeg = 0): CanvasPattern {
  const p = ctx.createPattern(tile, 'repeat')!;
  p.setTransform(new DOMMatrix().rotate(angleDeg).scale(1 / dpr()));
  return p;
}

const halftones = new Map<string, CanvasPattern>();

/** Dot screen of `ink` at `coverage` (0–0.75), rotated to that ink's screen angle. */
export function halftone(ctx: CanvasRenderingContext2D, ink: Ink, coverage: number, cell = 5): CanvasPattern {
  const key = `${ink}:${coverage}:${cell}`;
  const hit = halftones.get(key);
  if (hit) return hit;
  const s = Math.round(cell * dpr());
  const [tile, t] = canvas(s, s);
  t.fillStyle = INK[ink];
  t.beginPath();
  t.arc(s / 2, s / 2, s * Math.sqrt(Math.min(coverage, 0.75) / Math.PI), 0, Math.PI * 2);
  t.fill();
  const p = devicePattern(ctx, tile, SCREEN_ANGLE[ink]);
  halftones.set(key, p);
  return p;
}

/** Horizontal line screen, for sea, sky bands and shading that should read as printed. */
export function lineScreen(ctx: CanvasRenderingContext2D, ink: Ink, weight: number, pitch = 5, angleDeg = 0): CanvasPattern {
  const key = `line:${ink}:${weight}:${pitch}:${angleDeg}`;
  const hit = halftones.get(key);
  if (hit) return hit;
  const s = Math.round(pitch * dpr());
  const [tile, t] = canvas(s, s);
  t.fillStyle = INK[ink];
  t.fillRect(0, 0, s, Math.max(1, Math.round(weight * dpr())));
  const p = devicePattern(ctx, tile, angleDeg);
  halftones.set(key, p);
  return p;
}

interface Finish {
  grain: CanvasPattern;
  dropout: CanvasPattern;
}
let finishCache: Finish | null = null;

function buildFinish(ctx: CanvasRenderingContext2D): Finish {
  const size = 384;
  const r = rng(1337);

  // Grain: near-white noise plus faint fibres, multiplied over everything.
  const [g, gc] = canvas(size, size);
  const img = gc.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 255 - Math.pow(r(), 3) * 34;
    img.data[i] = v;
    img.data[i + 1] = v - 1;
    img.data[i + 2] = v - 4;
    img.data[i + 3] = 255;
  }
  gc.putImageData(img, 0, 0);
  gc.strokeStyle = 'rgba(120, 100, 70, 0.10)';
  gc.lineWidth = 1;
  for (let i = 0; i < 70; i++) {
    const x = r() * size;
    const y = r() * size;
    const a = r() * Math.PI * 2;
    const len = 6 + r() * 22;
    gc.beginPath();
    gc.moveTo(x, y);
    gc.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + (r() - 0.5) * 6, y + Math.sin(a) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len);
    gc.stroke();
  }

  // Dropout: sparse paper-coloured specks where ink failed to take.
  const [d, dc] = canvas(size, size);
  dc.fillStyle = INK.paper;
  for (let i = 0; i < 900; i++) {
    dc.globalAlpha = 0.25 + r() * 0.6;
    const s = r() < 0.85 ? 1 : 2;
    dc.fillRect(Math.floor(r() * size), Math.floor(r() * size), s, s);
  }
  return { grain: devicePattern(ctx, g), dropout: devicePattern(ctx, d) };
}

/** Print finish over the whole frame: two pattern fills, cheap at 120 Hz. */
export function printFinish(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  finishCache ??= buildFinish(ctx);
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = finishCache.grain;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = finishCache.dropout;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}
