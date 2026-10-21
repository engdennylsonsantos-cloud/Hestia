import { describe, expect, it } from 'vitest';
import { multiArea, type MultiPolygon } from '@hestia/geom';
import { MIN_VISIBLE_AREA, OCCLUSION_RANK, visibleParts, type OcclusionItem } from './sectionOcclusion.ts';

const rect = (t0: number, t1: number, z0: number, z1: number): MultiPolygon => [[[{ x: t0, y: z0 }, { x: t1, y: z0 }, { x: t1, y: z1 }, { x: t0, y: z1 }]]];

describe('remoção de superfícies ocultas (visibleParts)', () => {
  it('o item mais perto esconde o mais longe onde se sobrepõem; o resto do mais longe sobra', () => {
    const items: OcclusionItem[] = [
      { depth: 5, rank: OCCLUSION_RANK.beyond, polygons: rect(0, 4, 0, 1) },
      { depth: 1, rank: OCCLUSION_RANK.beyond, polygons: rect(2, 6, 0, 1) },
    ];
    const [far, near] = visibleParts(items);
    expect(multiArea(near!)).toBeCloseTo(4, 9);
    // o longe perde a faixa t ∈ [2, 4] e fica com t ∈ [0, 2]
    expect(multiArea(far!)).toBeCloseTo(2, 9);
  });

  it('a ordem da lista não muda o resultado: a profundidade manda', () => {
    const a: OcclusionItem = { depth: 1, rank: OCCLUSION_RANK.beyond, polygons: rect(0, 2, 0, 1) };
    const b: OcclusionItem = { depth: 3, rank: OCCLUSION_RANK.beyond, polygons: rect(0, 2, 0, 1) };
    // [a, b]: b (índice 1) é o longe e fica oculto; [b, a]: b é o índice 0 e a é o índice 1
    expect(visibleParts([a, b])[1]).toEqual([]);
    expect(visibleParts([b, a])[0]).toEqual([]);
    expect(multiArea(visibleParts([b, a])[1]!)).toBeCloseTo(2, 9);
  });

  it('mesma profundidade: o corte vem antes do que está além', () => {
    const items: OcclusionItem[] = [
      { depth: 0, rank: OCCLUSION_RANK.beyond, polygons: rect(0, 2, 0, 1) },
      { depth: 0, rank: OCCLUSION_RANK.cut, polygons: rect(0, 2, 0, 1) },
    ];
    const [beyond, cut] = visibleParts(items);
    expect(beyond).toEqual([]);
    expect(multiArea(cut!)).toBeCloseTo(2, 9);
  });

  it('resíduo abaixo de 1e-6 m² é descartado (contato, não superfície)', () => {
    const items: OcclusionItem[] = [
      { depth: 0, rank: OCCLUSION_RANK.cut, polygons: rect(0, 2, 0, 1) },
      { depth: 1, rank: OCCLUSION_RANK.beyond, polygons: rect(0, 2, 0, 1 + MIN_VISIBLE_AREA / 4) },
    ];
    expect(visibleParts(items)[1]).toEqual([]);
  });

  it('a saída fica alinhada aos itens, e item vazio não ocupa lugar no oclusor', () => {
    const items: OcclusionItem[] = [
      { depth: 2, rank: OCCLUSION_RANK.beyond, polygons: [] },
      { depth: 2, rank: OCCLUSION_RANK.beyond, polygons: rect(0, 1, 0, 1) },
      { depth: 4, rank: OCCLUSION_RANK.beyond, polygons: rect(0, 3, 0, 1) },
    ];
    const out = visibleParts(items);
    expect(out).toHaveLength(3);
    expect(out[0]).toEqual([]);
    expect(multiArea(out[1]!)).toBeCloseTo(1, 9);
    expect(multiArea(out[2]!)).toBeCloseTo(2, 9);
  });
});
