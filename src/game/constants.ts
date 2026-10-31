/** Logical canvas; rendered at devicePixelRatio for crisp output on Retina displays. */
export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 720;
export const GROUND_HEIGHT = 48;

export const SPRING_OMEGA_N = 20.0; // rad/s, slider 14–30
export const SPRING_ZETA = 1.0; // critically damped
export const GLIDER_MAX_VY = 850; // px/s
export const GLIDER_MAX_TILT_DEG = 35;
export const GLIDER_RADIUS = 20; // visual
export const GLIDER_HITBOX = 17; // 3 px grace margin
export const GLIDER_X = 280;

export const GRAVITY = 1400; // px/s², classic flap mode
export const FLAP_VY = -460; // px/s
export const FLAP_LAUNCH_Y = 300; // classic mode starts every run airborne here, never on the street

// Speed, gap size and gate spacing come from the chosen route: see difficulty.ts.
export const GATE_WIDTH = 78;
export const GATE_GAP = 165; // the Airmail route's opening gap (style frames draw at this size)
export const GATE_MARGIN = 60; // min distance from gap edge to ceiling/ground

export const READY_HOLD_SEC = 0.8; // show a steering hand this long to launch
export const RESUME_HOLD_SEC = 0.6; // after a pause, steer this long to resume
export const RESUME_COUNTDOWN_SEC = 1.2; // after leaving the pause menu, the world waits this long
export const GAME_OVER_COOLDOWN_SEC = 0.9;
export const MAX_DT = 0.05;
