export interface Point2D {
  x: number;
  y: number;
}

export interface Landmark2D {
  x: number;
  y: number;
}

/**
 * Steering feature in mirrored image space (u = 1 − x):
 *   anchor = mean(PIP 6, DIP 7, TIP 8)   — √3 less jitter than the tip alone, and survives the
 *                                          tip being hidden behind the finger when aiming at the lens
 *   u      = anchor + γ·(TIP 8 − MCP 5)   — finger pitch adds travel so the arm can stay still
 */
export function pointerFeature(lm: Landmark2D[], rayGain: number): Point2D {
  const ax = (lm[6].x + lm[7].x + lm[8].x) / 3;
  const ay = (lm[6].y + lm[7].y + lm[8].y) / 3;
  return {
    x: 1 - (ax + rayGain * (lm[8].x - lm[5].x)),
    y: ay + rayGain * (lm[8].y - lm[5].y),
  };
}

/**
 * Rejects single-frame landmark glitches: a jump larger than `maxJump` is held back for one
 * frame and accepted only if the next sample confirms it. Real fast motion costs one frame.
 */
export class SpikeGate {
  private last: Point2D | null = null;
  private pending: Point2D | null = null;

  constructor(public maxJump = 0.18) {}

  filter(p: Point2D): Point2D {
    if (!this.last) return (this.last = p);
    const jump = Math.hypot(p.x - this.last.x, p.y - this.last.y);
    if (jump <= this.maxJump) {
      this.pending = null;
      return (this.last = p);
    }
    if (this.pending && Math.hypot(p.x - this.pending.x, p.y - this.pending.y) <= this.maxJump) {
      this.pending = null;
      return (this.last = p);
    }
    this.pending = p;
    return this.last;
  }

  reset(): void {
    this.last = null;
    this.pending = null;
  }
}
