// Copies MediaPipe WASM runtime into public/ and downloads the hand landmarker model.
// Runs on postinstall so the app is fully self-hosted (no CDN at runtime).
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const wasmSrc = join(root, 'node_modules/@mediapipe/tasks-vision/wasm');
const wasmDst = join(root, 'public/mediapipe/wasm');
const modelDst = join(root, 'public/mediapipe/hand_landmarker.task');
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task';

if (existsSync(wasmSrc)) {
  mkdirSync(wasmDst, { recursive: true });
  cpSync(wasmSrc, wasmDst, { recursive: true });
  console.log('[setup] copied MediaPipe wasm -> public/mediapipe/wasm');
} else {
  console.warn('[setup] @mediapipe/tasks-vision not installed yet; skipping wasm copy');
}

if (!existsSync(modelDst)) {
  try {
    const res = await fetch(MODEL_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    writeFileSync(modelDst, Buffer.from(await res.arrayBuffer()));
    console.log('[setup] downloaded hand_landmarker.task (float16)');
  } catch (err) {
    console.warn(`[setup] model download failed (${err.message}); run "npm run setup:assets" later`);
  }
}
