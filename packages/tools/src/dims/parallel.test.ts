import { describe, expect, it } from 'vitest';
import { areParallel, gapTranslation, nearestParallelGaps, segFrame, segmentGaps, segLocal, segPoint, type LocalPlane } from './parallel.ts';

const same = (_side: 1 | -1): number => 0;

describe('quadro do segmento', () => {
  it('converte ida e volta e rejeita segmento degenerado', () => {
    const f = segFrame({ x: 1, y: 1 }, { x: 1, y: 5 })!;
    expect(f.length).toBeCloseTo(4, 9);
    const l = segLocal(f, segPoint(f, 2, 0.5));
    expect(l.t).toBeCloseTo(2, 9);
    expect(l.s).toBeCloseTo(0.5, 9);
    expect(segFrame({ x: 0, y: 0 }, { x: 0, y: 0 })).toBeNull();
  });

  it('areParallel aceita sentido oposto e qualquer ângulo, recusa transversal', () => {
    expect(areParallel({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 5, y: 0 }, { x: 3, y: -2 })).toBe(true);
    expect(areParallel({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 })).toBe(false);
    expect(areParallel({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBe(false);
  });
});

describe('vizinho paralelo mais próximo', () => {
  const planes: LocalPlane[] = [
    { id: 'near', s: 1.64, t0: 0, t1: 4 },
    { id: 'far', s: 5, t0: 0, t1: 4 },
    { id: 'back', s: -2, t0: 1, t1: 3 },
    { id: 'aside', s: 0.5, t0: 10, t1: 12 },
    { id: 'touch', s: 0, t0: 0, t1: 4 },
  ];

  it('escolhe o mais próximo de cada lado, só com sobreposição, e marca o meio da sobreposição', () => {
    const g = nearestParallelGaps(same, 0, 4, planes);
    expect(g.map((x) => [x.id, x.side, x.distance])).toEqual([['back', -1, 2], ['near', 1, 1.64]]);
    expect(g[0]!.t).toBeCloseTo(2, 9);
  });

  it('usa o plano do elemento voltado para o vizinho', () => {
    const g = nearestParallelGaps((side) => side * 0.1, 0, 4, [{ id: 'n', s: 1, t0: 0, t1: 4 }]);
    expect(g[0]!.distance).toBeCloseTo(0.9, 9);
  });

  it('reta ilimitada vale e lista vazia devolve vazio', () => {
    expect(nearestParallelGaps(same, 0, 4, [{ id: 'g', s: 3, t0: -Infinity, t1: Infinity }])).toHaveLength(1);
    expect(nearestParallelGaps(same, 0, 4, [])).toEqual([]);
  });
});

describe('invariante de ida e volta da translação', () => {
  it.each([1, -1] as const)('digitar v resulta em medida v (lado %i)', (side) => {
    const f = segFrame({ x: 0, y: 0 }, { x: 4, y: 0 })!;
    const s = 1.64 * side;
    const [gap] = nearestParallelGaps(same, 0, 4, [{ id: 'o', s, t0: 0, t1: 4 }]);
    for (const v of [0.28, 3, 1.64, 10]) {
      const d = gapTranslation(f.n, gap!, v);
      expect(Math.abs(s - segLocal(f, d).s - 0)).toBeCloseTo(v, 9);
    }
  });
});

describe('vizinhos paralelos entre segmentos', () => {
  it('ignora transversais e a si mesmo, mede de cada lado', () => {
    const f = segFrame({ x: 0, y: 0 }, { x: 4, y: 0 })!;
    const g = segmentGaps(f, [
      { id: 'a', a: { x: 0, y: 1.5 }, b: { x: 4, y: 1.5 } },
      { id: 'b', a: { x: 4, y: -2 }, b: { x: 1, y: -2 } },
      { id: 'cruz', a: { x: 2, y: -3 }, b: { x: 2, y: 3 } },
    ]);
    expect(g.map((x) => [x.id, x.side, x.distance])).toEqual([['b', -1, 2], ['a', 1, 1.5]]);
  });
});
