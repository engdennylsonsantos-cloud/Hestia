import { describe, it, expect } from 'vitest';
import type { Vec2 } from '@hestia/geom';
import { ringOps } from './ringOps.ts';

const rect = (): Vec2[] => [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 4, y: 3 },
  { x: 0, y: 3 },
];

const near = (a: Vec2, b: Vec2) => {
  expect(a.x).toBeCloseTo(b.x, 9);
  expect(a.y).toBeCloseTo(b.y, 9);
};

describe('ringOps.moveEdge', () => {
  it('desloca só os dois vértices da aresta do topo', () => {
    const r = rect();
    const out = ringOps.moveEdge(r, 2, { x: 1, y: 1 });
    expect(out[0]).toEqual({ x: 0, y: 0 });
    expect(out[1]).toEqual({ x: 4, y: 0 });
    expect(out[2]).toEqual({ x: 5, y: 4 });
    expect(out[3]).toEqual({ x: 1, y: 4 });
    expect(out).toHaveLength(4);
  });

  it('aresta que cruza o fim do anel move ring[n-1] e ring[0]', () => {
    const out = ringOps.moveEdge(rect(), 3, { x: -1, y: 0 });
    expect(out[3]).toEqual({ x: -1, y: 3 });
    expect(out[0]).toEqual({ x: -1, y: 0 });
    expect(out[1]).toEqual({ x: 4, y: 0 });
  });
});

describe('ringOps.insertVertex', () => {
  it('aumenta o anel em 1 e insere o vértice no novo índice i+1', () => {
    const out = ringOps.insertVertex(rect(), 0, { x: 2, y: 0 });
    expect(out).toHaveLength(5);
    expect(out[1]).toEqual({ x: 2, y: 0 });
    expect(out[2]).toEqual({ x: 4, y: 0 });
  });

  it('inserir na última aresta põe o vértice entre ring[n-1] e ring[0]', () => {
    const out = ringOps.insertVertex(rect(), 3, { x: 0, y: 1.5 });
    expect(out).toHaveLength(5);
    expect(out[4]).toEqual({ x: 0, y: 1.5 });
    expect(out[0]).toEqual({ x: 0, y: 0 });
  });
});

describe('ringOps.moveEdgeEnd', () => {
  it("'a' move ring[i]", () => {
    const out = ringOps.moveEdgeEnd(rect(), 1, 'a', { x: 3, y: 0 });
    expect(out[1]).toEqual({ x: 3, y: 0 });
    expect(out[2]).toEqual({ x: 4, y: 3 });
  });

  it("'b' move ring[(i+1)%n]", () => {
    const out = ringOps.moveEdgeEnd(rect(), 3, 'b', { x: 0, y: 5 });
    expect(out[0]).toEqual({ x: 0, y: 5 });
    expect(out[3]).toEqual({ x: 0, y: 3 });
  });
});

describe('ringOps.intersectEdgeLine', () => {
  it('retorna o ponto da interseção com a reta (mesmo fora do segmento)', () => {
    // aresta 0: (0,0)→(4,0); reta vertical x = 10 cruza y = 0 em (10, 0), fora do segmento
    const p = ringOps.intersectEdgeLine(rect(), 0, { x: 10, y: -5 }, { x: 10, y: 5 });
    expect(p).not.toBeNull();
    near(p!, { x: 10, y: 0 });
  });

  it('retorna o ponto certo para uma reta inclinada', () => {
    // aresta 1: (4,0)→(4,3) (x = 4); reta y = x + 1 cruza em (4, 5)
    const p = ringOps.intersectEdgeLine(rect(), 1, { x: 0, y: 1 }, { x: 1, y: 2 });
    expect(p).not.toBeNull();
    near(p!, { x: 4, y: 5 });
  });

  it('retorna null para reta paralela', () => {
    const p = ringOps.intersectEdgeLine(rect(), 0, { x: 0, y: 1 }, { x: 4, y: 1 });
    expect(p).toBeNull();
  });
});

describe('ringOps.offsetEdge', () => {
  it('lado de baixo deslocado em -1 m vai para y = -1 e mantém 4 vértices fechados', () => {
    const out = ringOps.offsetEdge(rect(), 0, -1);
    expect(out).toHaveLength(4);
    expect(out[0]!.y).toBeCloseTo(-1, 9);
    expect(out[1]!.y).toBeCloseTo(-1, 9);
    expect(out[0]!.x).toBeCloseTo(0, 9);
    expect(out[1]!.x).toBeCloseTo(4, 9);
    // vértices de topo intactos
    expect(out[2]).toEqual({ x: 4, y: 3 });
    expect(out[3]).toEqual({ x: 0, y: 3 });
  });

  it('+1 m na aresta de baixo (normal = perp, +90°) vai para y = +1', () => {
    const out = ringOps.offsetEdge(rect(), 0, 1);
    expect(out[0]!.y).toBeCloseTo(1, 9);
    expect(out[1]!.y).toBeCloseTo(1, 9);
  });

  it('dist = 0 deixa o anel igual', () => {
    expect(ringOps.offsetEdge(rect(), 2, 0)).toEqual(rect());
  });
});

describe('ringOps.alignEdgeToLine', () => {
  it('projeta os dois vértices ortogonalmente sobre uma reta inclinada', () => {
    // reta y = x, passando por (0,0)→(4,4)
    const out = ringOps.alignEdgeToLine(rect(), 0, { x: 0, y: 0 }, { x: 4, y: 4 });
    near(out[0]!, { x: 0, y: 0 });
    near(out[1]!, { x: 2, y: 2 });
    expect(out[2]).toEqual({ x: 4, y: 3 });
    expect(out[3]).toEqual({ x: 0, y: 3 });
  });
});

describe('ringOps: entrada não mutada', () => {
  const frozenRing = (): Vec2[] => {
    const r = rect().map((v) => Object.freeze({ ...v }));
    return Object.freeze(r) as unknown as Vec2[];
  };

  it('nenhuma operação altera o array nem os vértices de entrada', () => {
    const ops: Array<(r: Vec2[]) => unknown> = [
      (r) => ringOps.moveEdge(r, 2, { x: 1, y: 1 }),
      (r) => ringOps.insertVertex(r, 0, { x: 2, y: 0 }),
      (r) => ringOps.moveEdgeEnd(r, 1, 'a', { x: 3, y: 0 }),
      (r) => ringOps.intersectEdgeLine(r, 0, { x: 10, y: -5 }, { x: 10, y: 5 }),
      (r) => ringOps.offsetEdge(r, 0, -1),
      (r) => ringOps.alignEdgeToLine(r, 0, { x: 0, y: 0 }, { x: 4, y: 4 }),
    ];
    for (const op of ops) {
      const r = frozenRing();
      const snapshot = JSON.stringify(r);
      expect(() => op(r)).not.toThrow();
      expect(JSON.stringify(r)).toBe(snapshot);
      expect(r).toHaveLength(4);
    }
  });
});
