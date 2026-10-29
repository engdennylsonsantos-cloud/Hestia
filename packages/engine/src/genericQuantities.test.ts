import { describe, expect, it } from 'vitest';
import { createEmptyProject, type Generic, type Project } from '@hestia/model';
import { genericQuantities, genericQuantitiesTotal } from './genericQuantities.ts';

/** Cubo unitário [0, 1]³ com 8 vértices e 12 triângulos, orientados para fora. */
const cube = (): Generic['mesh'] => ({
  positions: [
    0, 0, 0, // 0
    1, 0, 0, // 1
    1, 1, 0, // 2
    0, 1, 0, // 3
    0, 0, 1, // 4
    1, 0, 1, // 5
    1, 1, 1, // 6
    0, 1, 1, // 7
  ],
  indices: [
    0, 2, 1, 0, 3, 2, // base (z = 0)
    4, 5, 6, 4, 6, 7, // topo (z = 1)
    0, 1, 5, 0, 5, 4, // frente (y = 0)
    1, 2, 6, 1, 6, 5, // direita (x = 1)
    2, 3, 7, 2, 7, 6, // fundo (y = 1)
    3, 0, 4, 3, 4, 7, // esquerda (x = 0)
  ],
});

const generic = (id: string, levelId: string, mesh: Generic['mesh'] = cube(), sourceClass = 'IFCBEAM'): Generic => ({
  id,
  kind: 'generic',
  levelId,
  name: id,
  sourceClass,
  mesh,
  order: 1,
});

function build(generics: Generic[]): Project {
  const p = createEmptyProject();
  for (const g of generics) p.elements[g.id] = g;
  return p;
}

describe('quantitativos de objetos genéricos (malha triangular)', () => {
  it('cubo unitário: volume 1, área 6 e 12 triângulos', () => {
    const rows = genericQuantities(build([generic('g1', 'lv_0')]));
    expect(rows).toHaveLength(1);
    const q = rows[0]!;
    expect(q.volume).toBeCloseTo(1, 9);
    expect(q.area).toBeCloseTo(6, 9);
    expect(q.triangles).toBe(12);
    expect(q.sourceClass).toBe('IFCBEAM');
    expect(q.levelId).toBe('lv_0');
  });

  it('filtro por nível devolve só os objetos daquele nível', () => {
    const p = build([generic('g1', 'lv_0'), generic('g2', 'lv_1')]);
    const all = genericQuantities(p);
    expect(all.map((r) => r.id)).toEqual(['g1', 'g2']);
    expect(genericQuantities(p, 'lv_0').map((r) => r.id)).toEqual(['g1']);
    expect(genericQuantities(p, 'lv_1').map((r) => r.id)).toEqual(['g2']);
  });

  it('malha vazia devolve zeros', () => {
    const rows = genericQuantities(build([generic('g1', 'lv_0', { positions: [], indices: [] })]));
    expect(rows[0]).toMatchObject({ volume: 0, area: 0, triangles: 0 });
  });

  it('índices fora do intervalo são ignorados sem lançar', () => {
    const mesh = { positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], indices: [0, 1, 9, 2, -1, 0] };
    const rows = genericQuantities(build([generic('g1', 'lv_0', mesh)]));
    expect(rows[0]).toMatchObject({ volume: 0, area: 0 });
    expect(genericQuantitiesTotal(rows)).toEqual({ volume: 0, area: 0, count: 1 });
  });

  it('ordem determinística por id, independente da ordem de inserção', () => {
    const p = build([generic('g_c', 'lv_0'), generic('g_a', 'lv_0'), generic('g_b', 'lv_1')]);
    expect(genericQuantities(p).map((r) => r.id)).toEqual(['g_a', 'g_b', 'g_c']);
  });

  it('totais somam volume, área e contagem', () => {
    const rows = genericQuantities(build([generic('g1', 'lv_0'), generic('g2', 'lv_1')]));
    const t = genericQuantitiesTotal(rows);
    expect(t.volume).toBeCloseTo(2, 9);
    expect(t.area).toBeCloseTo(12, 9);
    expect(t.count).toBe(2);
    expect(genericQuantitiesTotal([])).toEqual({ volume: 0, area: 0, count: 0 });
  });
});
