import { CANVAS_HEIGHT as H, CANVAS_WIDTH as W } from '../../game/constants';
import { inkText, pencil, withInk } from './ink';
import { drawManicule } from './manicule';
import { DISPLAY, TYPE } from './palette';
import { airmailBand, airmailStamp, perforatedPath, postmark } from './stamps';

export interface EnvelopeView {
  /** The aim column and the three marker altitudes, in canvas px. */
  x: number;
  targets: readonly number[];
  index: number;
  /** 0–1 progress on the current marker. */
  dwell: number;
  hint: string;
  error: boolean;
  /** 1 → 0 just after a capture; the fresh postmark lands with it. */
  flash: number;
}

const SLOT_W = 50;
const SLOT_H = 60;

/** Calibration as addressing an envelope: point at each empty stamp until it is franked. */
export function drawEnvelope(ctx: CanvasRenderingContext2D, v: EnvelopeView): void {
  withInk(ctx, 'paper', (c) => c.fillRect(0, 0, W, H));
  const frame = new Path2D();
  frame.rect(0, 0, W, H);
  frame.rect(18, 18, W - 36, H - 36);
  airmailBand(ctx, frame, W, 'evenodd');

  inkText(ctx, 'graphite', 'FROM: YOUR RIGHT HAND', 48, 64, `700 15px ${TYPE}`, { spacing: 2 });
  inkText(ctx, 'graphite', 'c/o THE CAMERA', 48, 86, `400 15px ${TYPE}`, { spacing: 2 });
  pencil(ctx, new Path2D(`M${v.x} 60 V${H - 60}`), 1.2, [2, 8]);

  v.targets.forEach((y, i) => {
    const sx = v.x - SLOT_W / 2;
    const sy = y - SLOT_H / 2;
    if (i < v.index) {
      airmailStamp(ctx, sx, sy, SLOT_W, SLOT_H);
      const land = i === v.index - 1 ? 1 + v.flash * 0.6 : 1;
      ctx.save();
      ctx.translate(v.x + 10, y + 4);
      ctx.scale(land, land);
      postmark(ctx, 0, 0, 30, { top: 'ADDRESSED', bottom: `${i + 1} OF ${v.targets.length}`, center: '✓', rot: -14 + i * 11, ink: 'blue', seed: 50 + i });
      ctx.restore();
      return;
    }
    const active = i === v.index;
    const slot = perforatedPath(sx, sy, SLOT_W, SLOT_H, 3, 10);
    withInk(ctx, 'graphite', (c) => {
      c.globalAlpha = active ? 0.95 : 0.35;
      c.lineWidth = active ? 2.2 : 1.2;
      c.setLineDash(active ? [] : [3, 4]);
      c.stroke(slot);
    });
    if (!active) return;
    if (v.dwell > 0) {
      withInk(ctx, 'red', (c) => {
        c.lineWidth = 6;
        c.lineCap = 'round';
        c.beginPath();
        c.arc(v.x, y, 50, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, v.dwell));
        c.stroke();
      });
    }
    drawManicule(ctx, v.x + 64, y, 0.7, -1);
  });

  const tx = v.x + 230;
  const step = Math.min(v.index + 1, v.targets.length);
  inkText(ctx, 'graphite', `STEP ${step} OF ${v.targets.length}`, tx, 220, `700 16px ${TYPE}`, { spacing: 3 });
  inkText(ctx, 'blue', 'ADDRESS THE ENVELOPE', tx, 290, `800 72px ${DISPLAY}`, { spacing: 1 });
  const lines = ['Point at the empty stamp the way you will', 'while playing, then hold roughly still.'];
  lines.forEach((l, i) => {
    pencil(ctx, new Path2D(`M${tx} ${352 + i * 40} H${W - 70}`), 1);
    inkText(ctx, 'graphite', l, tx + 2, 346 + i * 40, `400 20px ${TYPE}`);
  });
  inkText(ctx, v.error ? 'red' : 'blue', v.hint, tx + 2, 446, `700 20px ${TYPE}`);
  inkText(ctx, 'graphite', 'Space franks it now · Esc skips', tx + 2, H - 70, `400 15px ${TYPE}`, { spacing: 1 });
}
