import { CANVAS_HEIGHT as H, CANVAS_WIDTH as W, GROUND_HEIGHT } from '../../game/constants';
import { band, FLOOR, house, type Band } from './band';
import { drawChimney, drawParcels } from './gates';
import { withInk } from './ink';
import type { LegArt } from './legs';
import { halftone } from './paper';
import { polyPath, rng, wobbleCircle } from './wobble';

/**
 * Scenery is the quiet layer: fog and light screens only, so gates and the glider always
 * out-contrast it. Solid blue is reserved for the street, which is lethal.
 *
 * Leg 1 · The Town: far hills with a spire, a mid row of houses, near rooftops with wires.
 */
function buildTown(): Band[] {
  const far = band(1400, 0.12, 300, (c, wrap) => {
    const hills = new Path2D();
    hills.moveTo(-1400, FLOOR);
    for (let x = -1400; x <= 2800; x += 20) hills.lineTo(x, 470 - 38 * Math.sin((x / 1400) * Math.PI * 4) - 14 * Math.sin((x / 1400) * Math.PI * 10 + 1));
    hills.lineTo(2800, FLOOR);
    withInk(c, 'fog', (k) => ((k.globalAlpha = 0.5), k.fill(hills)));
    wrap((dx) => {
      const sx = 520 + dx;
      const spire = new Path2D(`M${sx} 470 L${sx} 380 L${sx + 9} 330 L${sx + 18} 380 L${sx + 18} 470 Z`);
      withInk(c, 'fog', (k) => ((k.globalAlpha = 0.7), k.fill(spire)));
      // A distant hamlet; same seed in every wrap copy so the tile stays seamless.
      const r = rng(11);
      for (let i = 0; i < 4; i++) withInk(c, 'fog', (k) => ((k.globalAlpha = 0.6), k.fill(house(1000 + i * 40 + dx, 486, 30, 16 + r() * 14, 12, r))));
    });
  });

  const mid = band(1100, 0.3, 400, (c, wrap) => {
    const r = rng(23);
    const specs: [number, number, number, number, boolean][] = [];
    for (let x = 0; x < 1100; ) {
      const w = 52 + r() * 46;
      specs.push([x, w, 55 + r() * 85, 18 + r() * 26, r() < 0.5]);
      x += w + (r() < 0.3 ? 24 + r() * 40 : 2);
    }
    wrap((dx) => {
      const rr = rng(5);
      for (const [x, w, h, roof, lit] of specs) {
        const p = house(x + dx, 610, w, h, roof, rr);
        withInk(c, 'fog', (k) => ((k.globalAlpha = 0.75), k.fill(p)));
        if (!lit) continue;
        for (let wy = 610 - h + 14; wy < 590; wy += 24)
          for (let wx = x + dx + 10; wx < x + dx + w - 16; wx += 20)
            if (rr() < 0.6) withInk(c, 'ochre', (k) => ((k.globalAlpha = 0.55), k.fillRect(wx, wy, 8, 11)));
      }
    });
  });

  const near = band(900, 0.62, 500, (c, wrap) => {
    const r = rng(41);
    const specs: [number, number, number, number][] = [];
    for (let x = 0; x < 900; ) {
      const w = 70 + r() * 80;
      specs.push([x, w, 22 + r() * 48, 14 + r() * 22]);
      x += w;
    }
    wrap((dx) => {
      const rr = rng(8);
      for (const [x, w, h, roof] of specs) {
        const p = house(x + dx, FLOOR, w, h, roof, rr);
        withInk(c, 'fog', (k) => k.fill(p));
        withInk(c, 'blue', (k) => k.fill(p), halftone(c, 'blue', 0.18));
      }
      const poles = [120, 570].map((p) => p + dx);
      for (const px of poles) withInk(c, 'fog', (k) => k.fillRect(px, FLOOR - 150, 4, 150));
      const wires = new Path2D();
      for (let i = 0; i < 3; i++) {
        const y = FLOOR - 144 + i * 7;
        wires.moveTo(poles[0] + 2, y);
        wires.quadraticCurveTo((poles[0] + poles[1]) / 2, y + 34, poles[1] + 2, y);
        wires.moveTo(poles[1] + 2, y);
        wires.quadraticCurveTo(poles[1] + 167, y + 34, poles[0] + 902, y);
      }
      withInk(c, 'graphite', (k) => ((k.globalAlpha = 0.28), (k.lineWidth = 1), k.stroke(wires)));
    });
  });
  return [far, mid, near];
}

/** Sky: stepped halftone bands (never a gradient) and a striped sun. */
function drawSky(ctx: CanvasRenderingContext2D): void {
  withInk(ctx, 'paper', (c) => c.fillRect(0, 0, W, H));
  withInk(ctx, 'fog', (c) => c.fillRect(0, 0, W, 110), halftone(ctx, 'fog', 0.38));
  withInk(ctx, 'fog', (c) => c.fillRect(0, 110, W, 90), halftone(ctx, 'fog', 0.2));
  withInk(ctx, 'fog', (c) => c.fillRect(0, 200, W, 80), halftone(ctx, 'fog', 0.08));
  const sun = polyPath(wobbleCircle(820, 380, 92, 77, 1.2, 60));
  withInk(ctx, 'ochre', (c) => ((c.globalAlpha = 0.6), c.fill(sun)));
  withInk(ctx, 'red', (c) => {
    c.save();
    c.clip(sun);
    c.fillStyle = halftone(ctx, 'red', 0.18);
    c.fillRect(720, 380, 200, 100);
    c.restore();
  });
  withInk(ctx, 'paper', (c) => {
    c.save();
    c.clip(sun);
    for (let i = 0; i < 6; i++) c.fillRect(710, 392 + i * 13, 220, 3 + i * 0.9);
    c.restore();
  });
}

/** Street: a kerb line and cobbles knocked out of the blue, scrolling at world speed. */
function drawStreet(ctx: CanvasRenderingContext2D, scroll: number): void {
  withInk(ctx, 'blue', (c) => c.fillRect(0, FLOOR, W, GROUND_HEIGHT));
  withInk(ctx, 'ochre', (c) => c.fillRect(0, FLOOR, W, 5));
  withInk(ctx, 'paper', (c) => {
    c.globalAlpha = 0.55;
    const off = scroll % 36;
    for (let row = 0; row < 3; row++)
      for (let x = -off - (row % 2) * 18; x < W; x += 36) c.fillRect(x, FLOOR + 13 + row * 11, 22, 3);
  });
}

export const town: LegArt = {
  name: 'THE TOWN',
  dark: false,
  bands: buildTown,
  sky: drawSky,
  street: drawStreet,
  top: drawParcels,
  bottom: drawChimney,
};
