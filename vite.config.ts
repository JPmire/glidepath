import { defineConfig } from 'vitest/config';

export default defineConfig({
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['@mediapipe/tasks-vision'] },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
