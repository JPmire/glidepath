import { CANVAS_WIDTH as W, GLIDER_X } from '../game/constants';
import type { GameEngine } from '../game/gameEngine';
import { legForScore } from '../game/gameRules';
import { legLabel } from './art/legs';
import { drawPostcard } from './art/postcard';
import { drawSlip, holdRing } from './art/slip';
import type { Pt } from './art/wobble';

/** Overlays for READY / PAUSED / GAME_OVER. `mouse` swaps gesture hints for click hints. */
export function drawStateCard(ctx: CanvasRenderingContext2D, game: GameEngine, mouse: boolean, route: readonly Pt[]): void {
  const slip = { x: W - 500, y: 150, w: 440, rot: 1.5 };
  switch (game.state) {
    case 'READY':
      holdRing(ctx, GLIDER_X, game.glider.y, game.readyProgress);
      drawSlip(ctx, {
        ...slip,
        title: 'READY FOR POSTING',
        lines: [
          mouse ? 'Move the mouse to steer.' : 'Point at the screen to steer.',
          mouse ? 'Click or press Space to post.' : 'Keep your hand up to post · or Space.',
          ...(mouse ? [] : ['An open palm holds the letter.']),
          ...(game.mode === 'FLAP' ? [mouse ? 'Tap mode: click or Space flaps.' : 'Tap mode: thumb to index finger flaps.'] : []),
        ],
      });
      return;
    case 'PAUSED': {
      const lost = game.pauseReason === 'NO_HAND';
      holdRing(ctx, GLIDER_X, game.glider.y, game.readyProgress);
      drawSlip(ctx, {
        ...slip,
        title: lost ? 'ADDRESSEE NOT FOUND' : 'HELD AT SORTING OFFICE',
        lines: [
          lost ? 'Raise your hand to resume.' : 'Point to resume.',
          'The glider follows your finger while held,',
          'so line it up first.',
        ],
        stamp: { text: 'HELD', ink: 'red' },
      });
      return;
    }
    case 'GAME_OVER':
      drawPostcard(ctx, {
        x: W / 2 + 120,
        y: 330,
        score: game.score,
        best: game.best,
        newBest: game.score >= game.best,
        route,
        leg: legLabel(legForScore(game.score)),
        hint: !game.canRestart ? ' ' : mouse ? 'Click or press Space to post again.' : 'Keep pointing to post again · or Space.',
        progress: game.readyProgress,
      });
      return;
    default:
      return;
  }
}
