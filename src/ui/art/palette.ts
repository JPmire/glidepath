/** Risograph spot inks. Depth comes from overprinting these, never from new hex values. */
export const INK = {
  paper: '#F2EADB',
  red: '#D8343F',
  blue: '#1E3F8F',
  ochre: '#E3A53A',
  graphite: '#34322E',
  fog: '#9DB4C8',
} as const;

export type Ink = keyof typeof INK;

/** Fixed per-ink misregistration (logical px), like drums that never quite line up. */
export const REGISTER: Record<Ink, readonly [number, number]> = {
  paper: [0, 0],
  red: [1.2, -0.6],
  blue: [0, 0],
  ochre: [-1, 0.8],
  graphite: [0.4, 0.3],
  fog: [-0.6, -0.4],
};

/** Halftone screen angles per ink, as on a real press. */
export const SCREEN_ANGLE: Record<Ink, number> = {
  paper: 0,
  red: 15,
  blue: 45,
  ochre: 0,
  graphite: 75,
  fog: 45,
};

export const DISPLAY = '"Big Shoulders Stencil Display", Impact, sans-serif';
export const TYPE = '"Courier Prime", "Courier New", monospace';
