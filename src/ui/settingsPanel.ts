import type { ControlMode } from '../game/gameEngine';

export interface Settings {
  omegaN: number;
  minCutoff: number;
  beta: number;
  rayGain: number;
  mode: ControlMode;
  reticle: boolean;
  sound: boolean;
  music: boolean;
  volume: number;
}

const STORAGE_KEY = 'glidepath.settings.v2';
export const DEFAULT_SETTINGS: Settings = {
  omegaN: 20, minCutoff: 1.0, beta: 0.015, rayGain: 0.5, mode: 'FOLLOW', reticle: true, sound: true, music: true, volume: 0.7,
};

type SliderKey = 'omegaN' | 'minCutoff' | 'beta' | 'rayGain' | 'volume';
type CheckKey = 'reticle' | 'sound' | 'music';

const SLIDERS: ReadonlyArray<{ key: SliderKey; label: string; min: number; max: number; step: number }> = [
  { key: 'volume', label: 'Volume', min: 0, max: 1, step: 0.05 },
  { key: 'omegaN', label: 'Responsiveness (ωn rad/s)', min: 14, max: 30, step: 0.5 },
  { key: 'minCutoff', label: 'Steadiness (min cutoff Hz)', min: 0.3, max: 3, step: 0.1 },
  { key: 'beta', label: 'Speed boost (β s/px)', min: 0, max: 0.05, step: 0.001 },
  { key: 'rayGain', label: 'Finger-tilt gain (γ)', min: 0, max: 1.5, step: 0.05 },
];

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

/** Builds the tuning drawer and reports every change. */
export function mountSettings(
  root: HTMLElement,
  settings: Settings,
  onChange: (s: Settings) => void,
  actions: { recalibrate: () => void; resetCalibration: () => void },
): (s: Settings) => void {
  root.innerHTML = '';
  const inputs = new Map<string, HTMLInputElement>();

  for (const def of SLIDERS) {
    const row = document.createElement('label');
    row.className = 'row';
    const name = document.createElement('span');
    name.textContent = def.label;
    const out = document.createElement('output');
    const input = Object.assign(document.createElement('input'), {
      type: 'range', min: String(def.min), max: String(def.max), step: String(def.step),
    });
    input.value = String(settings[def.key]);
    out.textContent = input.value;
    input.addEventListener('input', () => {
      settings[def.key] = Number(input.value);
      out.textContent = input.value;
      save(settings);
      onChange(settings);
    });
    inputs.set(def.key, input);
    row.append(name, out, input);
    root.append(row);
  }

  const modes = document.createElement('div');
  modes.className = 'segmented';
  modes.setAttribute('role', 'radiogroup');
  modes.setAttribute('aria-label', 'Control mode');
  const modeButtons = (['FOLLOW', 'FLAP'] as const).map((m) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = m === 'FOLLOW' ? 'Point & follow' : 'Thumb tap to flap';
    b.setAttribute('role', 'radio');
    b.addEventListener('click', () => {
      settings.mode = m;
      sync();
      save(settings);
      onChange(settings);
    });
    modes.append(b);
    return [m, b] as const;
  });
  root.append(modes);

  const checks = new Map<CheckKey, HTMLInputElement>();
  for (const [key, label] of [['sound', 'Sound effects (S mutes all)'], ['music', 'Music'], ['reticle', 'Show aim reticle']] as const) {
    const row = document.createElement('label');
    row.className = 'check';
    const box = Object.assign(document.createElement('input'), { type: 'checkbox' });
    box.addEventListener('change', () => {
      settings[key] = box.checked;
      save(settings);
      onChange(settings);
    });
    checks.set(key, box);
    row.append(box, ` ${label}`);
    root.append(row);
  }

  const buttons = document.createElement('div');
  buttons.className = 'actions';
  for (const [label, fn] of [['Recalibrate (C)', actions.recalibrate], ['Clear calibration', actions.resetCalibration]] as const) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', fn);
    buttons.append(b);
  }
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.textContent = 'Reset tuning';
  reset.addEventListener('click', () => {
    Object.assign(settings, DEFAULT_SETTINGS);
    sync();
    save(settings);
    onChange(settings);
  });
  buttons.append(reset);
  root.append(buttons);

  function sync(): void {
    for (const def of SLIDERS) {
      const input = inputs.get(def.key)!;
      input.value = String(settings[def.key]);
      (input.previousElementSibling as HTMLOutputElement).textContent = input.value;
    }
    for (const [m, b] of modeButtons) b.setAttribute('aria-checked', String(settings.mode === m));
    for (const [key, box] of checks) box.checked = settings[key];
  }
  sync();
  return (s: Settings) => {
    Object.assign(settings, s);
    sync();
  };
}
