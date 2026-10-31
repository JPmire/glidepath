export type ScreenName = 'home' | 'howto' | 'settings' | 'pause';

const NAMES: readonly ScreenName[] = ['home', 'howto', 'settings', 'pause'];

/**
 * The DOM menus laid over the canvas. One screen at a time; Settings and How to play remember
 * where they were opened from, so Back / Done returns to Home or to the pause menu.
 */
export class Screens {
  current: ScreenName | null = null;
  /** Called after every change, with the screen now showing (null = the game). */
  onChange: (current: ScreenName | null) => void = () => {};
  private stack: ScreenName[] = [];

  constructor(private readonly veil: HTMLElement) {
    for (const b of document.querySelectorAll<HTMLElement>('[data-open]')) {
      b.addEventListener('click', () => this.open(b.dataset.open as ScreenName));
    }
    for (const b of document.querySelectorAll<HTMLElement>('[data-back]')) {
      b.addEventListener('click', () => this.back());
    }
  }

  /** Open a sub-screen on top of the current one. */
  open(name: ScreenName): void {
    if (this.current && this.current !== name) this.stack.push(this.current);
    this.show(name);
  }

  back(): void {
    this.show(this.stack.pop() ?? null);
  }

  /** Jump straight to a screen (or to the game with null), forgetting the history. */
  reset(name: ScreenName | null): void {
    this.stack = [];
    this.show(name);
  }

  private show(name: ScreenName | null): void {
    this.current = name;
    for (const n of NAMES) document.getElementById(n)!.hidden = n !== name;
    this.veil.hidden = name === null || name === 'home';
    (document.activeElement as HTMLElement | null)?.blur();
    if (name) document.getElementById(name)!.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
    this.onChange(name);
  }
}

const BEST_KEY = 'glidepath.best.v1';

export function loadBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function saveBest(best: number): void {
  try {
    localStorage.setItem(BEST_KEY, String(best));
  } catch {
    /* storage unavailable */
  }
}
