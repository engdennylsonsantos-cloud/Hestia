import { describe, expect, it } from 'vitest';
import type { StairRun } from '@hestia/model';
import { distributeRisers, stairRunSteps } from './stairSketch.ts';

/** Lance reto de 18 m x 1,5 m, como o de uma rampa: dois limites e dois espelhos de borda. */
const run: StairRun = {
  id: 'c0',
  kind: 'run',
  boundaryLeft: [{ a: { x: 0, y: 0.75 }, b: { x: 18, y: 0.75 }, sag: 0 }],
  boundaryRight: [{ a: { x: 0, y: -0.75 }, b: { x: 18, y: -0.75 }, sag: 0 }],
  risers: [
    { a: { x: 0, y: 0.75 }, b: { x: 0, y: -0.75 }, sag: 0 },
    { a: { x: 18, y: 0.75 }, b: { x: 18, y: -0.75 }, sag: 0 },
  ],
  path: [],
} as unknown as StairRun;

describe('stairRunSteps — skipPairCheck (fatias de rampa)', () => {
  it('produz o mesmo resultado da versão validada numa rampa de várias fatias', () => {
    const sliced = { ...run, risers: distributeRisers(run, 41) };
    const full = stairRunSteps(sliced, { baseZ: 0.3, riserHeight: 0.0075 });
    const fast = stairRunSteps(sliced, { baseZ: 0.3, riserHeight: 0.0075, skipPairCheck: true });
    expect(full.treads).toHaveLength(40);
    expect(fast).toEqual(full);
  });

  it('a resolução de 184 linhas fica abaixo de um limite folgado', () => {
    const sliced = { ...run, risers: distributeRisers(run, 184) };
    const t0 = performance.now();
    const res = stairRunSteps(sliced, { baseZ: 0, riserHeight: 0.005, skipPairCheck: true });
    const ms = performance.now() - t0;
    expect(res.treads).toHaveLength(183);
    // Antes: ~230 ms (quadrático); agora, poucos ms. O limite é folgado para não oscilar em máquina lenta.
    expect(ms).toBeLessThan(150);
  });
});
