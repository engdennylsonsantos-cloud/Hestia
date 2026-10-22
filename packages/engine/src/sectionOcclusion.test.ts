import { describe, expect, it } from 'vitest';
import { multiArea, unionClipper, type MultiPolygon } from '@hestia/geom';
import { MIN_VISIBLE_AREA, OCCLUSION_RANK, cotaKeys, visibleParts, type OcclusionItem } from './sectionOcclusion.ts';

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

/** Região de corte (depth 0) com a cota do elemento: `wall` ou piso/laje (horizontal). */
const cut = (t0: number, t1: number, z0: number, z1: number, wall: boolean, bottom = z0, top = z1): OcclusionItem => ({
  depth: 0,
  rank: OCCLUSION_RANK.cut,
  polygons: rect(t0, t1, z0, z1),
  cota: { bottom, top, wall },
});

describe('corte: a cota decide o que fica por cima (P6)', () => {
  it('piso mais alto sobre laje mais baixa: na faixa comum o piso fica, a laje perde a faixa', () => {
    const slab = cut(0, 6, -0.12, 0, false);
    const floor = cut(0, 6, -0.07, 0.12, false);
    const [s, f] = visibleParts([slab, floor]);
    expect(multiArea(f!)).toBeCloseTo(6 * 0.19, 9);
    expect(multiArea(s!)).toBeCloseTo(6 * 0.05, 9);
  });

  it('a ordem da lista não muda o resultado da cota: o mais alto ganha nos dois sentidos', () => {
    const slab = cut(0, 6, -0.12, 0, false);
    const floor = cut(0, 6, -0.07, 0.12, false);
    expect(visibleParts([floor, slab])[1]).toEqual(visibleParts([slab, floor])[0]);
    expect(multiArea(visibleParts([slab, floor])[0]!)).toBeCloseTo(6 * 0.05, 9);
  });

  it('parede mais alta que o piso que a cruza: a parede fica inteira e o piso perde a faixa comum', () => {
    const floor = cut(0, 6, -0.2, 0.5, false);
    const wall = cut(2, 4, -0.05, 1, true);
    const [f, w] = visibleParts([floor, wall]);
    expect(multiArea(w!)).toBeCloseTo(2 * 1.05, 9);
    expect(multiArea(f!)).toBeCloseTo(6 * 0.7 - 2 * 0.55, 9);
  });

  it('parede contida na faixa do piso (embutida) não desaparece: fica inteira e o piso perde só a parte em comum', () => {
    const floor = cut(0, 6, -0.19, 0, false);
    const wall = cut(2, 4, -0.1, -0.05, true, -0.19, 0);
    const [f, w] = visibleParts([floor, wall]);
    expect(multiArea(w!)).toBeCloseTo(2 * 0.05, 9);
    expect(multiArea(f!)).toBeCloseTo(6 * 0.19 - 2 * 0.05, 9);
  });

  it('empate de topo: a parede fica por cima do piso, qualquer que seja a ordem da lista', () => {
    const floor = cut(0, 4, 0, 1, false);
    const wall = cut(1, 3, 0, 1, true);
    const [f1, w1] = visibleParts([floor, wall]);
    const [w2, f2] = visibleParts([wall, floor]);
    expect(multiArea(w1!)).toBeCloseTo(2, 9);
    expect(multiArea(w2!)).toBeCloseTo(2, 9);
    expect(multiArea(f1!)).toBeCloseTo(2, 9);
    expect(multiArea(f2!)).toBeCloseTo(2, 9);
  });

  it('empate entre dois pisos de mesma cota: a ordem da lista desempata (estável)', () => {
    const a = cut(0, 2, 0, 1, false);
    const b = cut(1, 3, 0, 1, false);
    const [va, vb] = visibleParts([a, b]);
    expect(multiArea(va!)).toBeCloseTo(2, 9);
    expect(multiArea(vb!)).toBeCloseTo(1, 9);
    expect(cotaKeys([a, b])).toEqual([1, 1]);
  });

  it('propriedade: 10 sobreposições aleatórias (sementes fixas): a soma das áreas visíveis é a da união e não é menor que a do elemento mais alto', () => {
    let seed = 20260522;
    const rnd = (): number => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    for (let run = 0; run < 10; run++) {
      const items: OcclusionItem[] = Array.from({ length: 6 }, () => {
        const t0 = Math.round(rnd() * 800) / 100;
        const z0 = Math.round(rnd() * 300) / 100 - 1;
        const wall = rnd() < 0.5;
        return cut(t0, t0 + 0.5 + Math.round(rnd() * 400) / 100, z0, z0 + 0.1 + Math.round(rnd() * 200) / 100, wall);
      });
      const visible = visibleParts(items);
      const sum = visible.reduce((acc, m) => acc + multiArea(m), 0);
      const union = multiArea(unionClipper(...items.map((i) => i.polygons)));
      expect(sum).toBeCloseTo(union, 6);
      const keys = cotaKeys(items) as number[];
      const top = keys.indexOf(Math.max(...keys));
      expect(sum).toBeGreaterThanOrEqual(multiArea(items[top]!.polygons) - 1e-9);
    }
  });
});
