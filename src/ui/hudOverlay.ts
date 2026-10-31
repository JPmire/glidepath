import type { Point2D } from '../math/pointing';
import type { VerticalCalibration } from '../math/verticalCalibration';
import type { GestureSnapshot } from '../vision/gestureInterpreter';
import type { HandResult } from '../vision/types';
import { inkText, pencil, withInk } from './art/ink';
import { INK, TYPE } from './art/palette';
import { perforatedPath } from './art/stamps';

const CONNECTIONS: ReadonlyArray<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

export interface Telemetry {
  renderFps: number;
  cameraFps: number;
  inferenceMs: number;
  latencyMs: number;
  delegate: string;
}

export type PillState = 'STEERING' | 'OPEN PALM' | 'PAUSED' | 'NO HAND' | 'TAP' | 'MOUSE';

/** Mirrored webcam preview as a postage stamp, with skeleton, calibrated range and status. */
export class HudOverlay {
  private ctx: CanvasRenderingContext2D;
  private edge: Path2D;
  private readonly fps = new FpsMeter();

  constructor(
    pip: HTMLCanvasElement,
    private readonly pill: HTMLElement,
    private readonly stats: HTMLElement,
  ) {
    const dpr = window.devicePixelRatio || 1;
    pip.width = STAMP_W * dpr;
    pip.height = STAMP_H * dpr;
    this.ctx = pip.getContext('2d')!;
    this.ctx.scale(dpr, dpr);
    this.edge = perforatedPath(3, 3, STAMP_W - 6, STAMP_H - 6, 4, 13);
  }

  static pillFor(s: GestureSnapshot): PillState {
    if (!s.handPresent) return 'NO HAND';
    if (s.pauseHeld) return 'PAUSED';
    if (s.posture === 'OPEN_PALM') return 'OPEN PALM';
    return s.touching ? 'TAP' : 'STEERING';
  }

  setPill(state: PillState): void {
    if (this.pill.dataset.label === state) return;
    this.pill.dataset.label = state;
    this.pill.textContent = STAMP_WORDS[state];
    this.pill.dataset.state = state.split(' ')[0].toLowerCase();
  }

  /** Call every frame; refreshes the telemetry line twice a second. */
  report(dt: number, telemetry: () => Omit<Telemetry, 'renderFps'>): void {
    const renderFps = this.fps.tick(dt);
    if (renderFps !== null) this.setTelemetry({ renderFps, ...telemetry() });
  }

  setTelemetry(t: Telemetry): void {
    this.stats.textContent =
      `${t.renderFps.toFixed(0)} fps render · ${t.cameraFps} fps cam · ` +
      `${t.inferenceMs.toFixed(1)} ms infer · ${t.latencyMs.toFixed(0)} ms latency · ${t.delegate}`;
  }

  draw(video: HTMLVideoElement | null, hand: HandResult | null, cal: VerticalCalibration | null, feature: Point2D | null): void {
    const { ctx } = this;
    const [x, y, w, h] = [IMG.x, IMG.y, IMG.w, IMG.h];
    ctx.clearRect(0, 0, STAMP_W, STAMP_H);
    withInk(ctx, 'paper', (c) => c.fill(this.edge));
    pencil(ctx, this.edge, 1);

    // Camera as a two-ink print: blue shadows, paper highlights.
    withInk(ctx, 'blue', (c) => c.fillRect(x, y, w, h));
    if (video && video.readyState >= 2) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      ctx.globalCompositeOperation = 'screen';
      ctx.filter = 'grayscale(1) contrast(1.25)';
      ctx.translate(x + w, y);
      ctx.scale(-1, 1); // mirror so it behaves like a mirror
      ctx.drawImage(video, 0, 0, w, h);
      ctx.restore();
    }
    withInk(ctx, 'paper', (c) => {
      c.globalCompositeOperation = 'multiply';
      c.fillRect(x, y, w, h);
    });

    if (cal) {
      // Calibrated steering band: where the feature must sit to reach top / bottom.
      withInk(ctx, 'ochre', (c) => {
        c.globalCompositeOperation = 'source-over';
        c.lineWidth = 1.5;
        c.setLineDash([3, 3]);
        c.beginPath();
        for (const v of cal.v) {
          c.moveTo(x, y + v * h);
          c.lineTo(x + w, y + v * h);
        }
        c.stroke();
      });
    }

    if (hand) {
      const pt = (i: number) => [x + (1 - hand.landmarks[i].x) * w, y + hand.landmarks[i].y * h] as const;
      ctx.save();
      ctx.strokeStyle = INK.paper;
      ctx.fillStyle = INK.paper;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (const [a, b] of CONNECTIONS) {
        ctx.moveTo(...pt(a));
        ctx.lineTo(...pt(b));
      }
      ctx.stroke();
      for (let i = 0; i < 21; i++) {
        ctx.fillStyle = i === 8 ? INK.red : INK.paper;
        ctx.beginPath();
        ctx.arc(...pt(i), i === 8 ? 4.5 : 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    if (feature) {
      ctx.save();
      ctx.strokeStyle = INK.red;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + feature.x * w, y + feature.y * h, 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    pencil(ctx, new Path2D(`M${x} ${y} h${w} v${h} h${-w} Z`), 1);
    inkText(ctx, 'graphite', 'PAR AVION · LIVE', x + 2, STAMP_H - 15, `700 11px ${TYPE}`, { spacing: 1.5 });
  }
}

/** The webcam preview is drawn as a perforated stamp: image area inset inside the perforations. */
export const STAMP_W = 264;
export const STAMP_H = 178;
const IMG = { x: 11, y: 11, w: 242, h: 136 };

/** What the rubber-stamp status says for each tracking state. */
const STAMP_WORDS: Record<PillState, string> = {
  STEERING: 'STEERING',
  'OPEN PALM': 'PALM UP',
  PAUSED: 'HELD',
  'NO HAND': 'NO HAND',
  TAP: 'TAP',
  MOUSE: 'BY MOUSE',
};

/** Render-rate meter: reports the average frame rate every half second, otherwise null. */
export class FpsMeter {
  private acc = 0;
  private frames = 0;

  tick(dt: number): number | null {
    this.acc += dt;
    this.frames++;
    if (this.acc < 0.5) return null;
    const fps = this.frames / this.acc;
    this.acc = 0;
    this.frames = 0;
    return fps;
  }
}
