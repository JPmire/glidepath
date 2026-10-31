/// <reference lib="webworker" />
// ES-module worker: all MediaPipe inference runs here, never on the main/render thread.
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import type { Delegate, FromWorker, HandResult, ToWorker } from './types';

declare const self: DedicatedWorkerGlobalScope;

let landmarker: HandLandmarker | null = null;
let lastTimestampMs = -1;

const post = (msg: FromWorker) => self.postMessage(msg);

async function create(wasmBase: string, modelPath: string): Promise<Delegate> {
  // useModule=true loads the ES-module wasm loader (module workers have no importScripts).
  const fileset = await FilesetResolver.forVisionTasks(wasmBase, true);
  for (const delegate of ['GPU', 'CPU'] as const) {
    try {
      landmarker = await HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: modelPath, delegate },
        runningMode: 'VIDEO',
        numHands: 1,
        // Slightly permissive: a foreshortened finger aimed at the lens lowers confidence, and
        // brief dropouts are worse for control than the occasional low-confidence frame.
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      return delegate;
    } catch (err) {
      if (delegate === 'CPU') throw err;
      console.warn('[handTracker] GPU delegate failed, falling back to CPU', err);
    }
  }
  throw new Error('unreachable');
}

/** First GPU inference compiles shaders (~seconds); pay that before gameplay starts. */
function warmUp(): void {
  const canvas = new OffscreenCanvas(256, 144);
  canvas.getContext('2d')?.fillRect(0, 0, 1, 1);
  const bitmap = canvas.transferToImageBitmap();
  try {
    landmarker?.detectForVideo(bitmap, 0);
    lastTimestampMs = 0;
  } finally {
    bitmap.close();
  }
}

function detect(bitmap: ImageBitmap, rawTimestampMs: number): void {
  if (!landmarker) {
    bitmap.close();
    return;
  }
  // VIDEO mode requires strictly increasing integer timestamps.
  const timestampMs = Math.max(Math.floor(rawTimestampMs), lastTimestampMs + 1);
  lastTimestampMs = timestampMs;

  const t0 = performance.now();
  let hand: HandResult | null = null;
  try {
    const r = landmarker.detectForVideo(bitmap, timestampMs);
    if (r.landmarks.length > 0 && r.worldLandmarks.length > 0) {
      const cat = r.handedness[0]?.[0];
      hand = {
        landmarks: r.landmarks[0].map(({ x, y, z }) => ({ x, y, z })),
        worldLandmarks: r.worldLandmarks[0].map(({ x, y, z }) => ({ x, y, z })),
        handedness: cat?.categoryName ?? 'Unknown',
        score: cat?.score ?? 0,
      };
    }
  } finally {
    bitmap.close(); // free the GPU texture immediately
  }
  post({ type: 'RESULT', hand, inferenceMs: performance.now() - t0, timestampMs });
}

self.onmessage = async (e: MessageEvent<ToWorker>) => {
  const msg = e.data;
  try {
    if (msg.type === 'INIT') {
      const delegate = await create(msg.wasmBase, msg.modelPath);
      warmUp();
      post({ type: 'READY', delegate });
    } else if (msg.type === 'DETECT') {
      detect(msg.bitmap, msg.timestampMs);
    }
  } catch (err) {
    if (msg.type === 'DETECT') post({ type: 'RESULT', hand: null, inferenceMs: 0, timestampMs: msg.timestampMs });
    post({ type: 'ERROR', message: err instanceof Error ? err.message : String(err) });
  }
};
