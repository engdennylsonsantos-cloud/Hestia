import { describe, expect, it, vi } from 'vitest';

// polygon-clipping lança em entradas quase degeneradas; aqui ele sempre lança, para exercitar o plano B (Clipper).
vi.mock('polygon-clipping', () => {
  const boom = (): never => {
    throw new Error('Unable to complete output ring');
  };
  return { default: { union: boom, difference: boom, intersection: boom } };
});

const { difference, intersection, multiArea, orientedRect, union } = await import('./index.ts');

const sq = (cx: number, cy: number, h: number) => [[orientedRect(cx, cy, 1, 0, h, h)]];

describe('operações booleanas sem polygon-clipping', () => {
  it('união de quadrados sobrepostos', () => {
    expect(multiArea(union(sq(0, 0, 1), sq(1, 0, 1)))).toBeCloseTo(6, 6);
  });
  it('diferença com furo', () => {
    const r = difference(sq(0, 0, 2), sq(0, 0, 1));
    expect(r).toHaveLength(1);
    expect(r[0]).toHaveLength(2);
    expect(multiArea(r)).toBeCloseTo(12, 6);
  });
  it('interseção', () => {
    expect(multiArea(intersection(sq(0, 0, 1), sq(1, 0, 1)))).toBeCloseTo(2, 6);
  });
  it('união de três operandos e vazio', () => {
    expect(multiArea(union(sq(0, 0, 1), sq(3, 0, 1), sq(6, 0, 1)))).toBeCloseTo(12, 6);
    expect(intersection(sq(0, 0, 1), sq(5, 0, 1))).toEqual([]);
  });
});
