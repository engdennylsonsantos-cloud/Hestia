import { describe, expect, it } from 'vitest';
import type { Drawing } from './drawing.ts';
import { LaneStack, solveEm } from './lanes.ts';

describe('LaneStack', () => {
  it('aloca linhas em sequencia', () => {
    const lanes = new LaneStack({ x0: 0, y0: 0, x1: 1, y1: 0.5 }, 0.05);
    expect(lanes.take('left', 8)).toBeCloseTo(-0.06, 10);
    expect(lanes.edge('left')).toBeCloseTo(-0.4825, 10);
    expect(lanes.take('left', 8)).toBeCloseTo(-0.5425, 10);
    expect(lanes.take('top', 1.15)).toBeCloseTo(0.56, 10);
    expect(lanes.take('right', 0)).toBeCloseTo(1.06, 10);
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
    const w = d.frame.x1 - d.frame.x0;
    expect(d.em / w).toBeGreaterThanOrEqual(0.026);
    expect(d.em).toBeCloseTo(0.0705, 2);
  });

  it('limita o em pela menor dimensao do quadro', () => {
    // Faixa estreita: 1 m fixo + 20 em de largura, mas só 0,3 m + 2 em de altura. Sem o limite, o em ficaria em 0,10
    // (texto = 1/6,7 do menor lado); com o limite o texto cai para 1/6 e a geometria (1 m) ocupa mais largura.
    const build = (em: number): Drawing => ({
      frame: { x0: 0, y0: 0, x1: 1 + 20 * em, y1: 0.3 + 2 * em },
      em,
      prims: [],
      meta: { kind: 'stair-section' },
    });
    const semLimite = build(0.1);
    expect(semLimite.em / (semLimite.frame.y1 - semLimite.frame.y0)).toBeGreaterThanOrEqual(1 / 6 - 1e-9);
    const d = solveEm(build, 0.1);
    expect(d.em).toBeCloseTo((0.3 + 2 * 0.1) / 6, 10);
    expect(d.em).toBeLessThan(0.1);
    const w = d.frame.x1 - d.frame.x0;
    expect(d.em / w).toBeGreaterThanOrEqual(0.026);
    expect(w).toBeLessThan(1 + 20 * 0.1);
  });

  it('não mexe no em quando o limite deixaria a fonte ilegível', () => {
    // Quadro muito mais estreito que alto e com largura quase toda fixa: limitar pela altura quebraria a legibilidade,
    // então vence a regra da fonte mínima.
    const build = (em: number): Drawing => ({
      frame: { x0: 0, y0: 0, x1: 3 + 2 * em, y1: 0.2 + 0.2 * em },
      em,
      prims: [],
      meta: { kind: 'stair-section' },
    });
    const d = solveEm(build, 0.05);
    expect(d.em / (d.frame.x1 - d.frame.x0)).toBeGreaterThanOrEqual(0.026);
  });
});
