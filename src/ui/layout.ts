/** Fit the 16:9 logical canvas into the window, backed at device resolution. Reports the logical→device scale. */
export function fitCanvas(canvas: HTMLCanvasElement, w: number, h: number, onScale: (scale: number) => void): void {
  const resize = () => {
    const dpr = window.devicePixelRatio || 1;
    const fit = Math.min((window.innerWidth - 32) / w, (window.innerHeight - 32) / h);
    canvas.style.width = `${Math.round(w * fit)}px`;
    canvas.style.height = `${Math.round(h * fit)}px`;
    canvas.width = Math.round(w * fit * dpr);
    canvas.height = Math.round(h * fit * dpr);
    onScale(fit * dpr);
  };
  window.addEventListener('resize', resize);
  resize();
}

export interface KeyActions {
  space(): void;
  escape(): void;
  recalibrate(): void;
  toggleMode(): void;
  toggleSound(): void;
}

/** Global shortcuts: Space, Esc, C(alibrate), M(ode), S(ound). Ignored while using the tuning tag. */
export function bindKeys(enabled: () => boolean, actions: KeyActions, onAnyKey: () => void): void {
  window.addEventListener('keydown', (e) => {
    onAnyKey();
    if (!enabled() || (e.target as HTMLElement).closest('#settings')) return;
    if (e.code === 'Space') {
      e.preventDefault();
      return actions.space();
    }
    const key = e.key.toLowerCase();
    if (key === 'escape') actions.escape();
    else if (key === 'c') actions.recalibrate();
    else if (key === 'm') actions.toggleMode();
    else if (key === 's') actions.toggleSound();
  });
}
