import type { Band } from './band';
import { coast } from './legCoast';
import { night } from './legNight';
import { pass } from './legPass';
import { town } from './legTown';

/**
 * One leg of the journey: its scenery, its lethal street and its two gate obstacles. Every leg
 * keeps the same value hierarchy: quiet scenery, solid keylined gates, loudest glider.
 */
export interface LegArt {
  name: string;
  /** Dark paper stock: pencil marks switch to paper ink so they stay visible. */
  dark: boolean;
  bands(): Band[];
  sky(ctx: CanvasRenderingContext2D): void;
  street(ctx: CanvasRenderingContext2D, scroll: number): void;
  /** Gate obstacles. Filled art must stay inside the (x, y, w, h) collision rect. */
  top(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number): void;
  bottom(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number): void;
}

export const LEGS: readonly LegArt[] = [town, coast, pass, night];

/** Art for absolute leg `n` (the journey loops through the four biomes forever). */
export const legArt = (n: number): LegArt => LEGS[n % LEGS.length];

/** "LEG 5 · THE TOWN": the number keeps counting even when the scenery comes round again. */
export const legLabel = (n: number): string => `LEG ${n + 1} · ${legArt(n).name}`;
