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
    // A drifting gate is rendered once at its base height with `amp` of slack above and below,
    // then slid with its gap so the walls always end exactly at the collision rect. The street is
    // overprinted (it shows what is under it), so whatever would sink below the floor is cropped.
    const amp = g.drift?.amp ?? 0;
    const y = g.drift ? g.gapY - g.drift.baseY - amp : 0;
    const h = FLOOR - y;
    const sh = (e.canvas.height * h) / (FLOOR + amp * 2);
    ctx.drawImage(e.canvas, 0, 0, e.canvas.width, sh, g.x - PAD, y, g.width + PAD * 2, h);
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
    const amp = g.drift?.amp ?? 0;
    const baseY = g.drift?.baseY ?? g.gapY;
    canvas.height = Math.ceil((FLOOR + amp * 2) * s);
    const c = canvas.getContext('2d')!;
    c.scale(s, s);
    c.translate(PAD, amp);
    const top = baseY - g.gapH / 2;
    const bottom = baseY + g.gapH / 2;
    const art = legArt(leg);
    art.top(c, 0, -amp, g.width, top + amp, g.id * 31 + 7);
    art.bottom(c, 0, bottom, g.width, FLOOR + amp - bottom, g.id * 31 + 107);
    if (stamp !== null) {
      const cy = bottom + Math.min(64, (FLOOR - bottom) / 2 + 6);
      postmark(c, g.width / 2, cy, 27, {
        top: 'DELIVERED', bottom: `LEG ${leg + 1}`, center: String(stamp), rot: ((g.id * 37) % 30) - 15, ink: 'blue', alpha: 0.85, seed: g.id,
      });
    }
    return canvas;
  }
}
