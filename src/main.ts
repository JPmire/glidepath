import './fonts';
import { AudioDirector } from './audio/audioDirector';
import { CANVAS_HEIGHT as H, CANVAS_WIDTH as W, GROUND_HEIGHT, MAX_DT } from './game/constants';
import { GameEngine, type ControlInput } from './game/gameEngine';
import { setArtScale } from './ui/art/paper';
import { CalibrationWizard, clearCalibration, loadCalibration } from './ui/calibrationOverlay';
import { HudOverlay } from './ui/hudOverlay';
import { bindKeys, fitCanvas } from './ui/layout';
import { Renderer } from './ui/renderer';
import { loadSettings, mountSettings, type Settings } from './ui/settingsPanel';
import { drawStateCard } from './ui/stateCards';
import { CameraManager, describeCameraError, type VisionFrame } from './vision/cameraManager';
import { GestureInterpreter } from './vision/gestureInterpreter';
import type { HandResult } from './vision/types';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('game');
const ctx = canvas.getContext('2d', { alpha: false })!;

const engine = new GameEngine();
const gestures = new GestureInterpreter(H - GROUND_HEIGHT);
const renderer = new Renderer(ctx);
const hud = new HudOverlay($('pip'), $('pill'), $('stats'));

let source: 'none' | 'camera' | 'mouse' = 'none';
let camera: CameraManager | null = null;
let lastHand: HandResult | null = null;
let lastVision: VisionFrame | null = null;
let lastVisionTs = 0;
let noHandSince = performance.now();
let pendingFlap = false;
let mouseY = H / 2;

const settings = loadSettings();
const audio = new AudioDirector(settings);
renderer.onBounce = (strength) => audio.bounce(strength);
function applySettings(s: Settings): void {
  audio.apply(s);
  engine.physics.omegaN = s.omegaN;
  engine.mode = s.mode;
  gestures.setTuning({ minCutoff: s.minCutoff, beta: s.beta, rayGain: s.rayGain });
}
applySettings(settings);

let calibrated = loadCalibration();
gestures.setCalibration(calibrated);

const wizard = new CalibrationWizard((cal) => {
  calibrated = cal;
  gestures.setCalibration(cal);
  engine.setState('READY');
});

function recalibrate(): void {
  if (source !== 'camera') return;
  wizard.reset();
  engine.setState('CALIBRATING');
}

const syncSettings = mountSettings($('settings-body'), settings, applySettings, {
  recalibrate,
  resetCalibration: () => {
    clearCalibration();
    calibrated = null;
    gestures.setCalibration(null);
  },
});

// ---- Layout: fit 16:9 into the window, back the canvas at devicePixelRatio ----
let scale = 1;
fitCanvas(canvas, W, H, (s) => {
  scale = s;
  setArtScale(s); // halftones and cached art are rendered at true device resolution
});

// ---- Vision ----
function onVision(f: VisionFrame): void {
  const dtSec = lastVisionTs ? Math.min((f.timestampMs - lastVisionTs) / 1000, 0.1) : 1 / 30;
  lastVisionTs = f.timestampMs;
  lastVision = f;
  lastHand = f.hand;
  const snap = gestures.update(f.hand, f.timestampMs);
  if (snap.handPresent) noHandSince = performance.now();
  if (engine.state === 'CALIBRATING') wizard.onSample(snap, dtSec);
  else if (snap.flapStart) pendingFlap = true;
}

async function startCamera(): Promise<void> {
  audio.unlock();
  const btn = $<HTMLButtonElement>('btn-camera');
  const err = $('intro-error');
  btn.disabled = true;
  btn.textContent = 'Starting camera…';
  err.hidden = true;
  try {
    camera ??= new CameraManager();
    camera.onFrame = onVision;
    camera.onError = (m) => console.error('[vision]', m);
    await camera.start();
    source = 'camera';
    enterGame();
    if (calibrated) engine.setState('READY');
    else recalibrate();
  } catch (e) {
    err.textContent = describeCameraError(e);
    err.hidden = false;
    btn.disabled = false;
    btn.textContent = 'Try again';
  }
}

function startMouse(): void {
  audio.unlock();
  source = 'mouse';
  enterGame();
  $('pip').hidden = true;
  engine.setState('READY');
}

function enterGame(): void {
  $('intro').hidden = true;
  $('hud').hidden = false;
  $('settings').hidden = false;
}

$('btn-camera').addEventListener('click', () => void startCamera());
$('btn-mouse').addEventListener('click', startMouse);

// ---- Keyboard / mouse ----
function primaryAction(): void {
  if (engine.canRestart) engine.launch();
  else if (engine.state === 'PLAYING' && engine.mode === 'FLAP') pendingFlap = true;
}

function updateSettings(change: Partial<Settings>): void {
  Object.assign(settings, change);
  syncSettings(settings);
  applySettings(settings);
}

bindKeys(() => source !== 'none', {
  space: () => (engine.state === 'CALIBRATING' ? wizard.captureNow() : primaryAction()),
  escape: () => {
    if (engine.state === 'CALIBRATING') engine.setState('READY'); // skip: keep the previous / default mapping
  },
  recalibrate,
  toggleMode: () => updateSettings({ mode: settings.mode === 'FOLLOW' ? 'FLAP' : 'FOLLOW' }),
  toggleSound: () => updateSettings({ sound: !(settings.sound || settings.music), music: !(settings.sound || settings.music) }),
}, () => audio.unlock());
canvas.addEventListener('pointermove', (e) => {
  const r = canvas.getBoundingClientRect();
  mouseY = ((e.clientY - r.top) / r.height) * H;
});
canvas.addEventListener('pointerdown', () => {
  audio.unlock();
  if (source !== 'none') primaryAction();
});

// ---- 120 Hz render loop (physics decoupled from the camera frame rate) ----
let last = performance.now();

function buildInput(): ControlInput {
  const flap = pendingFlap;
  pendingFlap = false;
  if (source === 'mouse') return { targetY: mouseY, steering: false, pause: false, flap, handPresent: true };
  const s = gestures.snapshot;
  return { targetY: s.targetY, steering: s.handPresent && s.posture === 'STEER', pause: s.pauseHeld, flap, handPresent: s.handPresent };
}

function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, MAX_DT);
  last = now;
  engine.update(dt, buildInput());
  audio.update(engine, wizard.index);

  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  renderer.draw(engine, dt, settings.reticle && source === 'camera');
  if (engine.state === 'CALIBRATING' && source === 'camera') wizard.draw(ctx, dt);
  drawStateCard(ctx, engine, source === 'mouse', renderer.route.points);
  renderer.finish();

  if (source === 'camera') {
    hud.draw(camera?.video ?? null, lastHand, calibrated, gestures.snapshot.feature);
    const snap = gestures.snapshot;
    hud.setPill(!snap.handPresent && now - noHandSince > 3000 ? 'NO HAND' : HudOverlay.pillFor(snap));
  } else if (source === 'mouse') {
    hud.setPill('MOUSE');
  }

  hud.report(dt, () => ({
    cameraFps: camera?.cameraFps ?? 0,
    inferenceMs: lastVision?.inferenceMs ?? 0,
    latencyMs: lastVision?.latencyMs ?? 0,
    delegate: source === 'mouse' ? 'mouse' : (camera?.delegate ?? '—'),
  }));
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
