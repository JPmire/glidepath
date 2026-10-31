import { CANVAS_HEIGHT } from '../game/constants';
import type { GameEngine } from '../game/gameEngine';
import { legForScore } from '../game/gameRules';
import { legArt } from './art/legs';
import { loadBest, saveBest, Screens, type ScreenName } from './screens';
import { MODE_LABEL } from './settingsPanel';

export interface MenuHooks {
  play(kind: 'camera' | 'mouse'): void;
  /** Leaving the game for the home screen. */
  home(): void;
  /** The settings sheet is about to show; refresh its calibration status. */
  calibrationShown(): void;
  inGame(): boolean;
}

const $ = (id: string) => document.getElementById(id)!;

/** The flow around the game: home → play → pause menu → settings / home, and the best score. */
export class Menus {
  private readonly screens = new Screens($('veil'));
  private savedBest: number;

  constructor(private readonly engine: GameEngine, private readonly hooks: MenuHooks) {
    this.savedBest = engine.best = loadBest();
    this.screens.onChange = (s) => this.changed(s);
    $('btn-play').addEventListener('click', () => hooks.play('camera'));
    $('btn-mouse').addEventListener('click', () => hooks.play('mouse'));
    $('btn-pause').addEventListener('click', () => this.pause());
    $('btn-resume').addEventListener('click', () => this.resume());
    $('btn-restart').addEventListener('click', () => this.restart());
    $('btn-home').addEventListener('click', () => this.home());
    // Switching tabs or windows mid-run opens the pause menu instead of flying blind.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && engine.state === 'PLAYING') this.pause();
    });
    window.addEventListener('blur', () => {
      if (engine.state === 'PLAYING') this.pause();
    });
    this.home();
  }

  /** A menu screen is covering the game (which is frozen meanwhile). */
  get open(): boolean {
    return this.screens.current !== null;
  }

  enterGame(): void {
    this.screens.reset(null);
  }

  home(): void {
    this.hooks.home();
    this.engine.setState('READY');
    this.engine.glider.y = CANVAS_HEIGHT / 2 - 40;
    this.engine.glider.vy = 0;
    const best = $('home-best');
    best.textContent = this.savedBest > 0 ? `${this.savedBest} ${this.savedBest === 1 ? 'gate' : 'gates'}` : 'not yet posted';
    best.classList.toggle('empty', this.savedBest === 0);
    this.screens.reset('home');
  }

  pause(): void {
    if (!this.hooks.inGame() || this.screens.current === 'pause') return;
    this.engine.hold();
    const { score, best, state, mode } = this.engine;
    $('pause-score').textContent = String(score);
    $('pause-best').textContent = String(Math.max(best, score));
    const leg = legForScore(score);
    $('pause-leg').textContent = `${leg + 1} · ${legArt(leg).name}`;
    $('pause-mode').textContent = MODE_LABEL[mode];
    $('btn-resume').textContent = state === 'PAUSED' ? 'Resume' : 'Back to the game';
    this.screens.reset('pause');
  }

  /** Esc inside a menu: close the pause menu, or step back out of a sub-screen. */
  back(): void {
    if (this.screens.current === 'pause') this.resume();
    else if (this.screens.current !== 'home') this.screens.back();
  }

  /** Persist a new best as soon as a run sets it. */
  recordBest(): void {
    if (this.engine.best <= this.savedBest) return;
    this.savedBest = this.engine.best;
    saveBest(this.savedBest);
  }

  private resume(): void {
    this.screens.reset(null);
    this.engine.resume();
  }

  private restart(): void {
    this.screens.reset(null);
    this.engine.setState('READY');
  }

  private changed(s: ScreenName | null): void {
    $('btn-pause').hidden = s !== null || !this.hooks.inGame();
    if (s === 'settings') this.hooks.calibrationShown();
  }
}
