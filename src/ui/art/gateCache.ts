import { CANVAS_HEIGHT, GROUND_HEIGHT } from '../../game/constants';
import type { Gate } from '../../game/gameEngine';
import { legArt } from './legs';
import { getArtScale } from './paper';
import { postmark } from './stamps';

const FLOOR = CANVAS_HEIGHT - GROUND_HEIGHT;
const PAD = 30; // room either side for smoke curls

interface Entry {
  canvas: HTMLCanvasElement;
  stamp: number | null;
  leg: number;
}

/**
 * Gate art is rendered once per gate into its own bitmap (and once more when it is postmarked),
 * so the per-frame cost is a single drawImage regardless of how ornate the art gets.
 */
export class GateCache {
  private entries = new Map<number, Entry>();
  private scale = 0;

  /** `leg` is fixed per gate (the leg it spawned in), so it never re-renders mid-flight. */
  draw(ctx: CanvasRenderingContext2D, g: Gate, stamp: number | null, leg: number): void {
    if (getArtScale() !== this.scale) {
      this.entries.clear();
      this.scale = getArtScale();
    }
    let e = this.entries.get(g.id);
    if (!e || e.stamp !== stamp || e.leg !== leg) {
      e = { canvas: this.render(g, stamp, leg), stamp, leg };
      this.entries.set(g.id, e);
    }
    ctx.drawImage(e.canvas, g.x - PAD, 0, g.width + PAD * 2, FLOOR);
  }

  /** Forget gates that have left the world. */
  retain(gates: readonly Gate[]): void {
    if (this.entries.size <= gates.length) return;
    const live = new Set(gates.map((g) => g.id));
    for (const id of this.entries.keys()) if (!live.has(id)) this.entries.delete(id);
  }

  private render(g: Gate, stamp: number | null, leg: number): HTMLCanvasElement {
    const s = this.scale;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil((g.width + PAD * 2) * s);
    canvas.height = Math.ceil(FLOOR * s);
    const c = canvas.getContext('2d')!;
    c.scale(s, s);
    c.translate(PAD, 0);
    const top = g.gapY - g.gapH / 2;
    const bottom = g.gapY + g.gapH / 2;
    const art = legArt(leg);
    art.top(c, 0, 0, g.width, top, g.id * 31 + 7);
    art.bottom(c, 0, bottom, g.width, FLOOR - bottom, g.id * 31 + 107);
    if (stamp !== null) {
      const cy = bottom + Math.min(64, (FLOOR - bottom) / 2 + 6);
      postmark(c, g.width / 2, cy, 27, {
        top: 'DELIVERED', bottom: `LEG ${leg + 1}`, center: String(stamp), rot: ((g.id * 37) % 30) - 15, ink: 'blue', alpha: 0.85, seed: g.id,
      });
    }
    return canvas;
  }
}
