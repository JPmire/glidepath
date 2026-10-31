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
  /** A menu screen is open: only Esc (back) is ours, the rest drive its buttons natively. */
  menuOpen(): boolean;
  inGame(): boolean;
  back(): void;
  space(): void;
  escape(): void;
  pause(): void;
  recalibrate(): void;
  toggleMode(): void;
  toggleSound(): void;
}

/** Global shortcuts: Space, Esc, P(ause), C(alibrate), M(ode), S(ound). */
export function bindKeys(actions: KeyActions, onAnyKey: () => void): void {
  window.addEventListener('keydown', (e) => {
    onAnyKey();
    const key = e.key.toLowerCase();
    if (actions.menuOpen()) {
      if (key === 'escape') actions.back();
      return;
    }
    if (!actions.inGame()) return;
    if (e.code === 'Space') {
      e.preventDefault();
      return actions.space();
    }
    if (key === 'escape') actions.escape();
    else if (key === 'p') actions.pause();
    else if (key === 'c') actions.recalibrate();
    else if (key === 'm') actions.toggleMode();
    else if (key === 's') actions.toggleSound();
  });
}
