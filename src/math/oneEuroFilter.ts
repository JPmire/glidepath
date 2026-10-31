/** alpha(fc, dt) = 1 / (1 + 1 / (2π·fc·dt)) */
export function smoothingAlpha(cutoff: number, dt: number): number {
  const tau = 1.0 / (2.0 * Math.PI * cutoff);
  return 1.0 / (1.0 + tau / dt);
}

/**
 * Speed-adaptive low-pass filter (Casiez et al., 2012). Stationary input is heavily smoothed
 * (cutoff ≈ minCutoff); fast motion raises the cutoff by beta·|velocity| so lag stays tiny.
 * Defaults are tuned for screen-pixel space on a 720 px canvas.
 */
export class OneEuroFilter {
  private xPrev: number | null = null;
  private dxPrev = 0.0;
  private tPrev: number | null = null;

  constructor(
    public minCutoff = 1.0,
    public beta = 0.015,
    public dCutoff = 1.0,
  ) {}

  public filter(x: number, timestampSec: number): number {
    if (this.xPrev === null || this.tPrev === null) {
      this.xPrev = x;
      this.tPrev = timestampSec;
      return x;
    }
    const dt = Math.max(timestampSec - this.tPrev, 1e-5);
    this.tPrev = timestampSec;

    const dx = (x - this.xPrev) / dt;
    const dAlpha = smoothingAlpha(this.dCutoff, dt);
    const dxHat = dAlpha * dx + (1.0 - dAlpha) * this.dxPrev;

    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const xAlpha = smoothingAlpha(cutoff, dt);
    const xHat = xAlpha * x + (1.0 - xAlpha) * this.xPrev;

    this.xPrev = xHat;
    this.dxPrev = dxHat;
    return xHat;
  }

  public reset(): void {
    this.xPrev = null;
    this.dxPrev = 0.0;
    this.tPrev = null;
  }
}
