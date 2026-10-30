import { describe, expect, it } from 'vitest';
import type { Drawing } from './drawing.ts';
import { LaneStack, solveEm } from './lanes.ts';

describe('LaneStack', () => {
  it('aloca linhas em sequencia', () => {
    const lanes = new LaneStack({ x0: 0, y0: 0, x1: 1, y1: 0.5 }, 0.05);
    expect(lanes.take('left', 8)).toBeCloseTo(-0.08, 10);
    expect(lanes.edge('left')).toBeCloseTo(-0.51, 10);
    expect(lanes.take('left', 8)).toBeCloseTo(-0.59, 10);
    expect(lanes.take('top', 1.15)).toBeCloseTo(0.58, 10);
    expect(lanes.take('right', 0)).toBeCloseTo(1.08, 10);
  });

  it('reserve puxa a borda para fora', () => {
    const lanes = new LaneStack({ x0: 0, y0: 0, x1: 1, y1: 0.5 }, 0.05);
    lanes.reserve('left', -0.4);
    expect(lanes.edge('left')).toBeCloseTo(-0.4, 10);
  });
});

describe('solveEm', () => {
  it('converge para o ponto fixo', () => {
    const build = (em: number): Drawing => ({
      frame: { x0: 0, y0: 0, x1: 2 + 10 * em, y1: 1 },
      em,
      prims: [],
      meta: { kind: 'stair-section' },
    });
    const d = solveEm(build, 0.05);
    expect(Math.abs(0.034 * (d.frame.x1 - d.frame.x0) - d.em) / d.em).toBeLessThan(0.01);
    expect(d.em).toBeCloseTo(0.103, 2);
  });
});
