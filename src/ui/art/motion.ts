const query = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

/**
 * Live OS "reduce motion" preference. When set: no flutter, pops, peels, bounces or page wipes;
 * state still changes, it just cuts instead of moving.
 */
export const reducedMotion = (): boolean => query?.matches ?? false;
