import { describe, expect, it } from 'vitest';
import { circleIntersectsRect, GameEngine, gapForScore, speedForScore, type ControlInput } from './gameEngine';
import { legForScore } from './gameRules';
import { FLAP_LAUNCH_Y, GATE_GAP, GATE_GAP_MIN, GATE_SPEED, GATE_SPEED_MAX, GLIDER_X } from './constants';

const idle: ControlInput = { targetY: 360, steering: true, pause: false, flap: false, handPresent: true };
const dt = 1 / 120;

function seeded(seed = 1) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

function playing(): GameEngine {
  const g = new GameEngine(seeded());
  g.setState('READY');
  g.launch();
  return g;
}

describe('circleIntersectsRect', () => {
  it('detects overlap, edge grazing and separation', () => {
    expect(circleIntersectsRect(50, 50, 10, 55, 0, 20, 100)).toBe(true);
    expect(circleIntersectsRect(31, 50, 10, 40, 0, 20, 100)).toBe(true);
    expect(circleIntersectsRect(30, 50, 10, 40, 0, 20, 100)).toBe(false); // exactly touching
    expect(circleIntersectsRect(29, 50, 10, 40, 0, 20, 100)).toBe(false);
    expect(circleIntersectsRect(45, 112, 10, 40, 0, 20, 100)).toBe(false);
  });
});

describe('difficulty curve', () => {
  it('speeds up 8 px/s every 5 points, capped at 480', () => {
    expect(speedForScore(0)).toBe(GATE_SPEED);
    expect(speedForScore(5)).toBe(GATE_SPEED + 8);
    expect(speedForScore(14)).toBe(GATE_SPEED + 16);
    expect(speedForScore(10_000)).toBe(GATE_SPEED_MAX);
  });
  it('narrows the gap down to the minimum', () => {
    expect(gapForScore(0)).toBe(GATE_GAP);
    expect(gapForScore(10_000)).toBe(GATE_GAP_MIN);
  });
});

describe('GameEngine state machine', () => {
  it('READY launches after pointing steadily for the hold time', () => {
    const g = new GameEngine(seeded());
    g.setState('READY');
    for (let i = 0; i < 80; i++) g.update(dt, idle);
    expect(g.state).toBe('READY');
    for (let i = 0; i < 30; i++) g.update(dt, idle);
    expect(g.state).toBe('PLAYING');
  });

  it('READY hold resets when the hand stops steering', () => {
    const g = new GameEngine(seeded());
    g.setState('READY');
    for (let i = 0; i < 60; i++) g.update(dt, idle);
    g.update(dt, { ...idle, steering: false });
    expect(g.readyProgress).toBe(0);
  });

  it('PLAYING -> PAUSED on the palm; world freezes; steering held resumes', () => {
    const g = playing();
    for (let i = 0; i < 300; i++) g.update(dt, idle);
    g.update(dt, { ...idle, pause: true });
    expect(g.state).toBe('PAUSED');
    expect(g.pauseReason).toBe('PALM');
    const xs = g.gates.map((p) => p.x);
    for (let i = 0; i < 60; i++) g.update(dt, { ...idle, pause: true });
    expect(g.gates.map((p) => p.x)).toEqual(xs);
    for (let i = 0; i < 60; i++) g.update(dt, idle); // 0.5 s < resume hold
    expect(g.state).toBe('PAUSED');
    for (let i = 0; i < 20; i++) g.update(dt, idle);
    expect(g.state).toBe('PLAYING');
  });

  it('the glider lines up with the finger while paused', () => {
    const g = playing();
    g.update(dt, { ...idle, pause: true });
    for (let i = 0; i < 120; i++) g.update(dt, { ...idle, targetY: 150, steering: false, pause: true });
    expect(g.glider.y).toBeCloseTo(150, 0);
  });

  it('pauses when the hand is lost', () => {
    const g = playing();
    for (let i = 0; i < 120; i++) g.update(dt, { ...idle, handPresent: false, steering: false, targetY: null });
    expect(g.state).toBe('PAUSED');
    expect(g.pauseReason).toBe('NO_HAND');
  });

  it('spawns gates on the spawn interval and scrolls them left', () => {
    const g = playing();
    g.update(dt, idle);
    expect(g.gates.length).toBe(1);
    const x0 = g.gates[0].x;
    for (let i = 0; i < 120; i++) g.update(dt, idle);
    expect(g.gates[0].x).toBeLessThan(x0 - 250);
    for (let i = 0; i < 120; i++) g.update(dt, idle);
    expect(g.gates.length).toBe(2);
  });

  it('scores when the glider passes a gate it fits through', () => {
    const g = playing();
    let guard = 0;
    while (g.score === 0 && g.state === 'PLAYING' && guard++ < 2000) {
      const next = g.gates.find((p) => p.x + p.width > GLIDER_X - 40) ?? g.gates[0];
      g.update(dt, { ...idle, targetY: next ? next.gapY : 360 });
    }
    expect(g.state).toBe('PLAYING');
    expect(g.score).toBe(1);
  });

  it('collides with a gate wall -> GAME_OVER, then restarts after cooldown + hold', () => {
    const g = playing();
    let guard = 0;
    while (g.state === 'PLAYING' && guard++ < 2000) {
      const next = g.gates[0];
      const wall = next ? (next.gapY > 360 ? 40 : 640) : 360;
      g.update(dt, { ...idle, targetY: wall });
    }
    expect(g.state).toBe('GAME_OVER');
    expect(g.best).toBeGreaterThanOrEqual(0);
    for (let i = 0; i < 300; i++) g.update(dt, idle);
    expect(g.state).toBe('PLAYING');
    expect(g.score).toBe(0);
    expect(g.gates.length).toBeLessThanOrEqual(1);
  });

  it('classic mode: hitting the ground ends the run', () => {
    const g = playing();
    g.mode = 'FLAP';
    for (let i = 0; i < 240 && g.state === 'PLAYING'; i++) g.update(dt, idle);
    expect(g.state).toBe('GAME_OVER');
  });

  it('classic mode: a run that ended on the street restarts in the air, not straight into it', () => {
    const g = new GameEngine(seeded());
    g.mode = 'FLAP';
    g.setState('READY');
    g.launch();
    g.update(dt, { ...idle, flap: true });
    for (let i = 0; i < 600 && g.state === 'PLAYING'; i++) g.update(dt, idle);
    expect(g.state).toBe('GAME_OVER');
    expect(g.glider.y).toBeGreaterThan(600);
    for (let i = 0; i < 300 && g.state === 'GAME_OVER'; i++) g.update(dt, idle); // cooldown + hold
    expect(g.state).toBe('PLAYING');
    for (let i = 0; i < 240; i++) g.update(dt, { ...idle, targetY: 690 }); // two seconds, no flap yet
    expect(g.state).toBe('PLAYING');
    expect(g.glider.y).toBeCloseTo(FLAP_LAUNCH_Y, 0);
    g.update(dt, { ...idle, flap: true }); // the first flap hands the glider to gravity
    for (let i = 0; i < 240 && g.state === 'PLAYING'; i++) g.update(dt, idle);
    expect(g.state).toBe('GAME_OVER');
  });

  it('classic mode: READY hovers at the launch altitude whatever the finger says', () => {
    const g = new GameEngine(seeded());
    g.mode = 'FLAP';
    g.setState('READY');
    for (let i = 0; i < 60; i++) g.update(dt, { ...idle, targetY: 690, steering: false });
    expect(g.glider.y).toBeCloseTo(FLAP_LAUNCH_Y, 0);
  });

  it('pause menu freezes everything, even a steering hand, until resumed; then counts down', () => {
    const g = playing();
    for (let i = 0; i < 300; i++) g.update(dt, idle);
    g.hold();
    expect(g.state).toBe('PAUSED');
    expect(g.pauseReason).toBe('MENU');
    const xs = g.gates.map((p) => p.x);
    for (let i = 0; i < 240; i++) g.update(dt, idle);
    expect(g.state).toBe('PAUSED');
    expect(g.gates.map((p) => p.x)).toEqual(xs);
    g.resume();
    expect(g.pauseReason).toBe('RESUMING');
    for (let i = 0; i < 120; i++) g.update(dt, { ...idle, steering: false }); // 1 s < countdown
    expect(g.state).toBe('PAUSED');
    for (let i = 0; i < 30; i++) g.update(dt, { ...idle, steering: false });
    expect(g.state).toBe('PLAYING');
  });

  it('hold() only applies to a run in progress', () => {
    const g = new GameEngine(seeded());
    g.setState('READY');
    g.hold();
    expect(g.state).toBe('READY');
  });

  it('gives every gate a unique id that survives restarts (art and postmarks are cached by it)', () => {
    const g = playing();
    const seen = new Set<number>();
    for (let run = 0; run < 2; run++) {
      for (let i = 0; i < 600; i++) {
        g.update(dt, idle);
        for (const gate of g.gates) seen.add(gate.id);
      }
      g.launch();
    }
    const ids = [...seen];
    expect(ids.length).toBeGreaterThan(4);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Math.min(...ids)).toBeGreaterThan(0);
  });
});

describe('legForScore', () => {
  it('advances a leg every 10 gates and keeps counting past the last biome', () => {
    expect([0, 9, 10, 19, 20, 45].map(legForScore)).toEqual([0, 0, 1, 1, 2, 4]);
    expect(legForScore(-3)).toBe(0);
  });
});
