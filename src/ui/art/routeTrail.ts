import type { Pt } from './wobble';

/** The pencil glidepath behind the glider: screen-space points that scroll left with the world. */
export class RouteTrail {
  points: Pt[] = [];
  private travelled = 0;

  constructor(private readonly spacing = 6) {}

  reset(): void {
    this.points = [];
    this.travelled = 0;
  }

  /** Scroll by `dx` world px and drop a point at the glider's tail every `spacing` px. */
  step(x: number, y: number, dx: number): void {
    for (const p of this.points) p.x -= dx;
    this.travelled += dx;
    if (this.points.length === 0 || this.travelled >= this.spacing) {
      this.points.push({ x, y });
      this.travelled = 0;
    }
    while (this.points.length && this.points[0].x < -20) this.points.shift();
  }
}

/**
 * The whole run as (distance, altitude), for the game-over postcard. Bounded memory: when it
 * fills up it halves its resolution, so a ten-minute run costs the same as a short one.
 */
export class RunRoute {
  points: Pt[] = [];
  private distance = 0;
  private step: number;

  constructor(
    private readonly baseStep = 10,
    private readonly maxPoints = 400,
  ) {
    this.step = baseStep;
  }

  reset(): void {
    this.points = [];
    this.distance = 0;
    this.step = this.baseStep;
  }

  record(dx: number, y: number): void {
    this.distance += dx;
    const last = this.points[this.points.length - 1];
    if (last && this.distance - last.x < this.step) return;
    this.points.push({ x: this.distance, y });
    if (this.points.length > this.maxPoints) {
      this.points = this.points.filter((_, i) => i % 2 === 0);
      this.step *= 2;
    }
  }
}
