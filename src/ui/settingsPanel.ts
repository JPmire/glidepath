import type { ControlMode } from '../game/gameEngine';

export interface Settings {
  omegaN: number;
  minCutoff: number;
  beta: number;
  rayGain: number;
  mode: ControlMode;
  reticle: boolean;
  preview: boolean;
  sound: boolean;
  music: boolean;
  volume: number;
}

const STORAGE_KEY = 'glidepath.settings.v2';
export const DEFAULT_SETTINGS: Settings = {
  omegaN: 20, minCutoff: 1.0, beta: 0.015, rayGain: 0.5, mode: 'FOLLOW', reticle: true, preview: true, sound: true, music: true, volume: 0.7,
};

type SliderKey = 'omegaN' | 'minCutoff' | 'beta' | 'rayGain' | 'volume';
type CheckKey = 'reticle' | 'preview' | 'sound' | 'music';
interface SliderDef { key: SliderKey; label: string; min: number; max: number; step: number }

const CONTROL_SLIDERS: readonly SliderDef[] = [
  { key: 'omegaN', label: 'Responsiveness (ωn rad/s)', min: 14, max: 30, step: 0.5 },
  { key: 'minCutoff', label: 'Steadiness (min cutoff Hz)', min: 0.3, max: 3, step: 0.1 },
  { key: 'beta', label: 'Speed boost (β s/px)', min: 0, max: 0.05, step: 0.001 },
  { key: 'rayGain', label: 'Finger-tilt gain (γ)', min: 0, max: 1.5, step: 0.05 },
];
const VOLUME: SliderDef = { key: 'volume', label: 'Volume', min: 0, max: 1, step: 0.05 };

export const MODE_LABEL: Record<ControlMode, string> = { FOLLOW: 'Point & follow', FLAP: 'Pinch to flap' };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function save(s: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable */
  }
}

export interface SettingsView {
  /** Re-read every control from `s` (after a keyboard shortcut changed it). */
  sync(s: Settings): void;
  /** Update the calibration status line. */
  setCalibration(calibrated: boolean, cameraOn: boolean): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}): HTMLElementTagNameMap[K] {
  const node: HTMLElementTagNameMap[K] = document.createElement(tag);
  Object.assign(node, props);
  return node;
}

function button(label: string, className: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', { type: 'button', textContent: label, className });
  b.addEventListener('click', onClick);
  return b;
}

function section(root: HTMLElement, title: string): HTMLFieldSetElement {
  const f = el('fieldset', { className: 'section' });
  f.append(el('legend', { textContent: title }));
  root.append(f);
  return f;
}

/** Builds the settings sheet (controls, calibration, sound, display) and reports every change. */
export function mountSettings(
  root: HTMLElement,
  settings: Settings,
  onChange: (s: Settings) => void,
  actions: { recalibrate: () => void; resetCalibration: () => void },
): SettingsView {
  root.innerHTML = '';
  const commit = () => {
    save(settings);
    onChange(settings);
  };
  const inputs = new Map<SliderKey, HTMLInputElement>();
  const slider = (parent: HTMLElement, def: SliderDef) => {
    const row = el('label', { className: 'row' });
    const out = el('output');
    const input = el('input', { type: 'range', min: String(def.min), max: String(def.max), step: String(def.step) });
    input.addEventListener('input', () => {
      settings[def.key] = Number(input.value);
      out.textContent = input.value;
      commit();
    });
    inputs.set(def.key, input);
    row.append(el('span', { textContent: def.label }), out, input);
    parent.append(row);
  };
  const checks = new Map<CheckKey, HTMLInputElement>();
  const check = (parent: HTMLElement, key: CheckKey, label: string) => {
    const row = el('label', { className: 'check' });
    const box = el('input', { type: 'checkbox' });
    box.addEventListener('change', () => {
      settings[key] = box.checked;
      commit();
    });
    checks.set(key, box);
    row.append(box, ` ${label}`);
    parent.append(row);
  };

  const controls = section(root, 'Controls');
  const modes = el('div', { className: 'segmented' });
  modes.setAttribute('role', 'radiogroup');
  modes.setAttribute('aria-label', 'Control mode');
  const modeButtons = (['FOLLOW', 'FLAP'] as const).map((m) => {
    const b = button(MODE_LABEL[m], '', () => {
      settings.mode = m;
      sync();
      commit();
    });
    b.setAttribute('role', 'radio');
    modes.append(b);
    return [m, b] as const;
  });
  controls.append(modes);
  for (const def of CONTROL_SLIDERS) slider(controls, def);

  const calibration = section(root, 'Calibration');
  const status = el('p', { className: 'note' });
  const calActions = el('div', { className: 'actions' });
  calActions.append(button('Recalibrate (C)', '', actions.recalibrate), button('Clear calibration', '', actions.resetCalibration));
  calibration.append(status, calActions);

  const sound = section(root, 'Sound');
  slider(sound, VOLUME);
  check(sound, 'sound', 'Sound effects (S mutes all)');
  check(sound, 'music', 'Music');

  const display = section(root, 'Display');
  check(display, 'reticle', 'Show aim reticle');
  check(display, 'preview', 'Show camera preview');
  const reset = el('div', { className: 'actions' });
  reset.append(button('Reset all settings', '', () => {
    Object.assign(settings, DEFAULT_SETTINGS);
    sync();
    commit();
  }));
  display.append(reset);

  function sync(): void {
    for (const [key, input] of inputs) {
      input.value = String(settings[key]);
      (input.previousElementSibling as HTMLOutputElement).textContent = input.value;
    }
    for (const [m, b] of modeButtons) b.setAttribute('aria-checked', String(settings.mode === m));
    for (const [key, box] of checks) box.checked = settings[key];
  }
  sync();
  return {
    sync(s) {
      Object.assign(settings, s);
      sync();
    },
    setCalibration(calibrated, cameraOn) {
      status.innerHTML = calibrated
        ? '<strong>Addressed.</strong> Your three aim marks are saved on this computer.'
        : '<strong>Not addressed.</strong> Steering uses a default mapping until you calibrate.';
      if (!cameraOn) status.innerHTML += ' Recalibrating switches the camera on.';
    },
  };
}
