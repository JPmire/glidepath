import { describe, expect, it } from 'vitest';
import { pointerFeature, SpikeGate } from './pointing';

const lm = (pts: Record<number, [number, number]>) =>
  Array.from({ length: 21 }, (_, i) => ({ x: pts[i]?.[0] ?? 0, y: pts[i]?.[1] ?? 0 }));

describe('pointerFeature', () => {
  const marks = lm({ 5: [0.6, 0.6], 6: [0.6, 0.5], 7: [0.6, 0.45], 8: [0.6, 0.4] });

  it('mirrors x and anchors on the mean of PIP/DIP/TIP', () => {
    const p = pointerFeature(marks, 0);
    expect(p.x).toBeCloseTo(0.4, 10);
    expect(p.y).toBeCloseTo(0.45, 10);
  });

  it('adds γ times the MCP→TIP ray', () => {
    const p = pointerFeature(marks, 0.5);
    expect(p.y).toBeCloseTo(0.45 + 0.5 * -0.2, 10);
  });

  it('is less sensitive to tip noise than the raw tip', () => {
    const noisy = lm({ 5: [0.6, 0.6], 6: [0.6, 0.5], 7: [0.6, 0.45], 8: [0.6, 0.43] });
    const shift = pointerFeature(noisy, 0).y - pointerFeature(marks, 0).y;
    expect(shift).toBeCloseTo(0.01, 10); // tip moved 0.03, feature moves 0.01
  });
});

describe('SpikeGate', () => {
  it('passes smooth motion through', () => {
    const g = new SpikeGate(0.1);
    g.filter({ x: 0, y: 0 });
    expect(g.filter({ x: 0.05, y: 0 })).toEqual({ x: 0.05, y: 0 });
  });

  it('drops a one-frame glitch', () => {
    const g = new SpikeGate(0.1);
    g.filter({ x: 0, y: 0.5 });
    expect(g.filter({ x: 0, y: 0.9 })).toEqual({ x: 0, y: 0.5 });
    expect(g.filter({ x: 0, y: 0.52 })).toEqual({ x: 0, y: 0.52 });
  });

  it('accepts a real jump once confirmed by the next frame', () => {
    const g = new SpikeGate(0.1);
    g.filter({ x: 0, y: 0.2 });
    expect(g.filter({ x: 0, y: 0.6 }).y).toBe(0.2);
    expect(g.filter({ x: 0, y: 0.62 }).y).toBe(0.62);
  });
});
