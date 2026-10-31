import './fonts';
import { AudioDirector } from './audio/audioDirector';
import { CANVAS_HEIGHT as H, CANVAS_WIDTH as W, GROUND_HEIGHT, MAX_DT } from './game/constants';
import { GameEngine, type ControlInput } from './game/gameEngine';
import { setArtScale } from './ui/art/paper';
import { CalibrationWizard, clearCalibration, loadCalibration } from './ui/calibrationOverlay';
import { HudOverlay } from './ui/hudOverlay';
import { bindKeys, fitCanvas } from './ui/layout';
import { Menus } from './ui/menus';
import { Renderer } from './ui/renderer';
import { loadSettings, mountSettings, type Settings } from './ui/settingsPanel';
import { drawStateCard } from './ui/stateCards';
import { describeCameraError } from './vision/cameraManager';
import { VisionInput } from './vision/visionInput';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('game');
const ctx = canvas.getContext('2d', { alpha: false })!;

const engine = new GameEngine();
const vision = new VisionInput(H - GROUND_HEIGHT);
const gestures = vision.gestures;
const renderer = new Renderer(ctx);
const hud = new HudOverlay($('pip'), $('pill'), $('stats'));

/** 'none' while on the home screen. */
let source: 'none' | 'camera' | 'mouse' = 'none';
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
  $('pip').hidden = source !== 'camera' || !s.preview;
}
applySettings(settings);

let calibrated = loadCalibration();
gestures.setCalibration(calibrated);

const wizard = new CalibrationWizard((cal) => {
  calibrated = cal;
  gestures.setCalibration(cal);
  engine.setState('READY');
});

const settingsView = mountSettings($('settings-body'), settings, applySettings, {
  recalibrate: () => recalibrate(),
  resetCalibration: () => {
    clearCalibration();
    calibrated = null;
    gestures.setCalibration(null);
    settingsView.setCalibration(false, vision.on);
  },
});

const menus = new Menus(engine, {
  play: (kind) => void play(kind),
  home: () => {
    source = 'none';
    $('hud').hidden = true;
  },
  calibrationShown: () => settingsView.setCalibration(calibrated !== null, vision.on),
  inGame: () => source !== 'none',
});

// ---- Layout: fit 16:9 into the window, back the canvas at devicePixelRatio ----
let scale = 1;
fitCanvas(canvas, W, H, (s) => {
  scale = s;
  setArtScale(s); // halftones and cached art are rendered at true device resolution
});

// ---- Vision, and the camera / mouse / menu flow ----
vision.onSnapshot = (snap, dtSec) => {
  if (menus.open) return;
  if (engine.state === 'CALIBRATING') wizard.onSample(snap, dtSec);
  else if (snap.flapStart) pendingFlap = true;
};

async function ensureCamera(): Promise<boolean> {
  if (vision.on) return true;
  const [btn, err] = [$<HTMLButtonElement>('btn-play'), $('home-error')];
  [btn.disabled, btn.textContent, err.hidden] = [true, 'Starting camera…', true];
  try {
    await vision.ensure();
    return true;
  } catch (e) {
    err.textContent = describeCameraError(e);
    err.hidden = false;
    menus.home();
    return false;
  } finally {
    [btn.disabled, btn.textContent] = [false, 'Play'];
  }
}

async function play(kind: 'camera' | 'mouse', calibrate = false): Promise<void> {
  audio.unlock();
  if (kind === 'camera' && !(await ensureCamera())) return;
  source = kind;
  $('hud').hidden = false;
  applySettings(settings);
  menus.enterGame();
  if (kind === 'camera' && (calibrate || !calibrated)) startCalibration();
  else engine.setState('READY');
}

function startCalibration(): void {
  wizard.reset();
  engine.setState('CALIBRATING');
}

function recalibrate(): void {
  if (source !== 'camera') return void play('camera', true);
  menus.enterGame();
  startCalibration();
}

// ---- Keyboard / mouse ----
function primaryAction(): void {
  if (engine.canRestart) engine.launch();
  else if (engine.state === 'PLAYING' && engine.mode === 'FLAP') pendingFlap = true;
}

function updateSettings(change: Partial<Settings>): void {
  Object.assign(settings, change);
  settingsView.sync(settings);
  applySettings(settings);
}

bindKeys({
  menuOpen: () => menus.open,
  inGame: () => source !== 'none',
  back: () => menus.back(),
  space: () => (engine.state === 'CALIBRATING' ? wizard.captureNow() : primaryAction()),
  // During calibration Esc skips it (keeping the previous / default mapping); otherwise it pauses.
  escape: () => (engine.state === 'CALIBRATING' ? engine.setState('READY') : menus.pause()),
  pause: () => menus.pause(),
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
  if (source !== 'none' && !menus.open) primaryAction();
});

// ---- 120 Hz render loop (physics decoupled from the camera frame rate) ----
let last = performance.now();

function buildInput(): ControlInput {
  const flap = pendingFlap;
  pendingFlap = false;
  if (source === 'mouse') return { targetY: mouseY, steering: false, pause: false, flap, handPresent: true };
  const s = vision.snapshot;
  return { targetY: s.targetY, steering: s.handPresent && s.posture === 'STEER', pause: s.pauseHeld, flap, handPresent: s.handPresent };
}

function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, MAX_DT);
  last = now;
  // Menus freeze the game: nothing launches, restarts or calibrates behind them.
  if (menus.open) pendingFlap = false;
  else engine.update(dt, buildInput());
  menus.recordBest();
  audio.update(engine, wizard.index);

  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  renderer.draw(engine, dt, settings.reticle && source === 'camera' && !menus.open);
  if (engine.state === 'CALIBRATING' && source === 'camera') wizard.draw(ctx, dt);
  if (!menus.open) drawStateCard(ctx, engine, source === 'mouse', renderer.route.points);
  renderer.finish();

  if (source === 'camera') {
    if (settings.preview) hud.draw(vision.camera?.video ?? null, vision.lastHand, calibrated, vision.snapshot.feature);
    hud.setPill(vision.handLost(now) ? 'NO HAND' : HudOverlay.pillFor(vision.snapshot));
  } else if (source === 'mouse') {
    hud.setPill('MOUSE');
  }

  hud.report(dt, () => ({
    cameraFps: vision.camera?.cameraFps ?? 0,
    inferenceMs: vision.lastFrame?.inferenceMs ?? 0,
    latencyMs: vision.lastFrame?.latencyMs ?? 0,
    delegate: source === 'mouse' ? 'mouse' : (vision.camera?.delegate ?? '—'),
  }));
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
