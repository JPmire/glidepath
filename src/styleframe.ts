/** Dev-only still frames of the art, for checking it without a camera. */
import '@fontsource/big-shoulders-stencil-display/800';
import '@fontsource/courier-prime/400';
import '@fontsource/courier-prime/700';
import { CANVAS_HEIGHT as H, CANVAS_WIDTH as W, GATE_GAP, GATE_WIDTH, GLIDER_X, GROUND_HEIGHT } from './game/constants';
import { makeHand } from './test/handFixture';
import { CAL_X, TARGET_YS } from './ui/calibrationOverlay';
import { drawEnvelope } from './ui/art/envelope';
import { drawChimney, drawParcels } from './ui/art/gates';
import { drawGlider } from './ui/art/glider';
import { inkText, pencil, withInk } from './ui/art/ink';
import { drawManicule } from './ui/art/manicule';
import { halftone, printFinish } from './ui/art/paper';
import { TYPE } from './ui/art/palette';
import { drawBand } from './ui/art/band';
import { town } from './ui/art/legTown';
import { legArt, legLabel } from './ui/art/legs';
import { legSlip as tapedLegSlip, scoreStamp } from './ui/art/hudArt';
import { perforatedPath, postmark, rubberStamp } from './ui/art/stamps';

const FLOOR = H - GROUND_HEIGHT;
const BONES: ReadonlyArray<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

function gate(ctx: CanvasRenderingContext2D, x: number, gapY: number, seed: number): void {
  const top = gapY - GATE_GAP / 2;
  const bottom = gapY + GATE_GAP / 2;
  drawParcels(ctx, x, 0, GATE_WIDTH, top, seed);
  drawChimney(ctx, x, bottom, GATE_WIDTH, FLOOR - bottom, seed + 100);
}

function trail(ctx: CanvasRenderingContext2D, gy: number): void {
  const pts = [[-10, 372], [60, 346], [120, 312], [175, 298], [225, 306], [262, 324], [GLIDER_X - 30, gy - 2]];
  const p = new Path2D();
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    p.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  p.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
  pencil(ctx, p, 2.2, [1, 7]);
}

function legSlip(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.translate(W / 2, 40);
  ctx.rotate((-1.2 * Math.PI) / 180);
  withInk(ctx, 'paper', (c) => c.fillRect(-170, -20, 340, 40));
  pencil(ctx, new Path2D('M-170 -20 h340 v40 h-340 Z'), 1);
  inkText(ctx, 'graphite', 'LEG 1 — THE TOWN', 0, 6, `700 18px ${TYPE}`, { align: 'center', spacing: 3 });
  for (const [tx, rot] of [[-168, -0.5], [168, 0.45]] as const) {
    withInk(ctx, 'fog', (c) => {
      c.globalAlpha = 0.6;
      c.translate(tx, -16);
      c.rotate(rot);
      c.fillRect(-18, -7, 36, 14);
    });
  }
  ctx.restore();
}

function pipStamp(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const w = 252;
  const h = 150;
  const edge = perforatedPath(x, y, w, h, 4, 14);
  withInk(ctx, 'paper', (c) => c.fill(edge));
  pencil(ctx, edge, 0.8);
  const ix = x + 10;
  const iy = y + 10;
  const iw = w - 20;
  const ih = h - 34;
  withInk(ctx, 'blue', (c) => c.fillRect(ix, iy, iw, ih), halftone(ctx, 'blue', 0.28, 4));
  withInk(ctx, 'blue', (c) => {
    c.lineWidth = 1;
    c.setLineDash([3, 4]);
    for (const v of [0.22, 0.5, 0.8]) {
      c.beginPath();
      c.moveTo(ix, iy + v * ih);
      c.lineTo(ix + iw, iy + v * ih);
      c.stroke();
    }
  });
  const hand = makeHand({ extended: [true, false, false, false], indexPitchDeg: 18, at: { x: 0.5, y: 0.82 } }).image;
  // The fixture hand is small in frame; enlarge about the wrist so the preview reads.
  const s = 1.7;
  const pt = (i: number) =>
    [ix + (1 - (0.5 + (hand[i].x - hand[0].x) * s)) * iw, iy + (0.9 + (hand[i].y - hand[0].y) * s) * ih] as const;
  withInk(ctx, 'blue', (c) => {
    c.lineWidth = 2;
    c.lineCap = 'round';
    c.beginPath();
    for (const [a, b] of BONES) c.moveTo(...pt(a)), c.lineTo(...pt(b));
    c.stroke();
    for (let i = 0; i < 21; i++) c.beginPath(), c.arc(...pt(i), 2.2, 0, Math.PI * 2), c.fill();
  });
  withInk(ctx, 'red', (c) => {
    c.beginPath();
    c.arc(...pt(8), 4.5, 0, Math.PI * 2);
    c.fill();
  });
  inkText(ctx, 'graphite', 'PAR AVION', x + 12, y + h - 10, `700 12px ${TYPE}`, { spacing: 1.5 });
  rubberStamp(ctx, 'STEERING', x + w - 66, y + h - 18, 16, 'red', -5);
}

async function main(): Promise<void> {
  await Promise.all([
    document.fonts.load(`800 40px "Big Shoulders Stencil Display"`),
    document.fonts.load(`700 16px "Courier Prime"`),
    document.fonts.load(`400 16px "Courier Prime"`),
  ]);
  const canvas = document.getElementById('frame') as HTMLCanvasElement;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d', { alpha: false })!;
  ctx.scale(dpr, dpr);

  // #envelope previews calibration mid-way (marker 2 dwelling), which otherwise needs a camera.
  if (location.hash === '#envelope') {
    drawEnvelope(ctx, { x: CAL_X, targets: TARGET_YS, index: 1, dwell: 0.6, hint: 'Good. Hold it…', error: false, flash: 0 });
    printFinish(ctx, W, H);
    return;
  }

  // #leg=N previews leg N's scenery, gates and street (Town is the default frame below).
  const legMatch = /^#leg=(\d)$/.exec(location.hash);
  if (legMatch) {
    const art = legArt(Number(legMatch[1]));
    art.sky(ctx);
    for (const b of art.bands()) drawBand(ctx, b, 820);
    for (const [x, gapY, seed] of [[150, 300, 1], [566, 430, 2], [972, 250, 3]]) {
      art.top(ctx, x, 0, GATE_WIDTH, gapY - GATE_GAP / 2, seed);
      art.bottom(ctx, x, gapY + GATE_GAP / 2, GATE_WIDTH, FLOOR - gapY - GATE_GAP / 2, seed + 100);
    }
    art.street(ctx, 820);
    trail(ctx, 352);
    drawGlider(ctx, GLIDER_X, 352, 9, 0.5, 0.3, 1.4);
    scoreStamp(ctx, 10 * Number(legMatch[1]) + 3, 0, art.dark);
    tapedLegSlip(ctx, legLabel(Number(legMatch[1])), 0);
    printFinish(ctx, W, H);
    return;
  }

  const scroll = 820;
  const gliderY = 352;
  town.sky(ctx);
  for (const b of town.bands()) drawBand(ctx, b, scroll);
  gate(ctx, 150, 300, 1);
  gate(ctx, 566, 430, 2);
  gate(ctx, 972, 250, 3);
  postmark(ctx, 189, 470, 30, { top: 'DELIVERED', bottom: 'LEG 1', center: '11', rot: 14, ink: 'blue', alpha: 0.8, seed: 21 });
  town.street(ctx, scroll);

  trail(ctx, gliderY);
  const targetY = 418;
  pencil(ctx, new Path2D(`M${GLIDER_X + 36} ${gliderY + 6} L${GLIDER_X + 96} ${targetY}`), 1.4, [2, 5]);
  drawManicule(ctx, GLIDER_X + 102, targetY, 0.62, -1);
  drawGlider(ctx, GLIDER_X, gliderY, 9, 0.5, 0.3, 1.4);

  postmark(ctx, 92, 92, 62, { top: 'GLIDEPATH · AIRMAIL', bottom: '31 OCT 2026', center: '12', rot: -6, cancel: true, seed: 4 });
  legSlip(ctx);
  pipStamp(ctx, 22, 548);
  printFinish(ctx, W, H);
}

void main();
