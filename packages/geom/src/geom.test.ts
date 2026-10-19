import { describe, expect, it } from 'vitest';
import { asMulti, difference, intersection, multiArea, orientedRect, union, v2, intersectLines, triangulate, applyTransform, pointInMulti } from './index.ts';

const rect = (x0: number, y0: number, x1: number, y1: number) =>
  asMulti([v2(x0, y0), v2(x1, y0), v2(x1, y1), v2(x0, y1)]);

describe('boolean', () => {
  it('une retângulos que se tocam sem deixar costura', () => {
    const u = union(rect(0, 0, 1, 1), rect(1, 0, 2, 1));
    expect(u).toHaveLength(1);
    expect(multiArea(u)).toBeCloseTo(2, 9);
  });
  it('subtrai e faz furo', () => {
    const d = difference(rect(0, 0, 4, 4), rect(1, 1, 3, 3));
    expect(multiArea(d)).toBeCloseTo(12, 9);
    expect(d[0]).toHaveLength(2);
  });
  it('interseção', () => {
    expect(multiArea(intersection(rect(0, 0, 2, 2), rect(1, 1, 3, 3)))).toBeCloseTo(1, 9);
  });
});

describe('geometria', () => {
  it('retas se cruzam', () => {
    const r = intersectLines(v2(0, 0), v2(1, 0), v2(2, -1), v2(0, 1));
    expect(r?.point.x).toBeCloseTo(2);
    expect(r?.point.y).toBeCloseTo(0);
  });
  it('retângulo orientado tem a área esperada', () => {
    expect(multiArea(asMulti(orientedRect(0, 0, 0.6, 0.8, 2, 0.5)))).toBeCloseTo(4, 9);
  });
  it('triangula com furo', () => {
    const m = difference(rect(0, 0, 4, 4), rect(1, 1, 3, 3));
    const t = triangulate(m[0]!);
    expect(t.indices.length % 3).toBe(0);
    expect(t.indices.length).toBeGreaterThan(0);
  });
  it('espelha em torno de um eixo', () => {
    const p = applyTransform({ kind: 'mirror', a: v2(0, 0), b: v2(0, 1) }, v2(2, 3));
    expect(p.x).toBeCloseTo(-2);
    expect(p.y).toBeCloseTo(3);
  });
  it('ponto dentro de multipolígono', () => {
    expect(pointInMulti(v2(2, 2), rect(0, 0, 4, 4))).toBe(true);
    expect(pointInMulti(v2(5, 2), rect(0, 0, 4, 4))).toBe(false);
  });
});
