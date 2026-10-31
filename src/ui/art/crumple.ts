import { FLOOR } from './band';
import { drawCrumpled } from './glider';

/** After a crash: the glider balls up, drops, bounces once on the street and rolls to a stop. */
export class CrumpleBall {
  private x = 0;
  private y = 0;
  private vy = 0;
  private spin = 0;
  private bounced = false;

  /** Called with impact strength 0–1 each time the ball hits the street. */
  constructor(private readonly onImpact: (strength: number) => void) {}

  start(x: number, y: number, vy: number): void {
    Object.assign(this, { x, y, vy: Math.min(vy * 0.3, 0) - 120, spin: 0, bounced: false });
  }

  draw(ctx: CanvasRenderingContext2D, dt: number, calm: boolean): void {
    const rest = FLOOR - 20;
    if (this.y < rest || this.vy < 0) {
      this.vy += 1600 * dt;
      this.y += this.vy * dt;
      this.x -= 50 * dt;
      if (!calm) this.spin += 7 * dt;
      if (this.y >= rest) {
        this.onImpact(Math.min(1, this.vy / 900));
        this.y = rest;
        this.vy = this.bounced || calm ? 0 : -this.vy * 0.32;
        this.bounced = true;
      }
    }
    drawCrumpled(ctx, this.x, this.y, this.spin);
  }
}
