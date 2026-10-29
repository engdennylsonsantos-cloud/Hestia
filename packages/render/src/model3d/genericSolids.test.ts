import { describe, expect, it } from 'vitest';
import { createEmptyProject, type Generic } from '@hestia/model';
import { buildGenericSolids } from './genericSolids.ts';

const generic = (id: string, levelId = 'lv_0'): Generic => ({
  id,
  kind: 'generic',
  levelId,
  name: 'Viga',
  sourceClass: 'IFCBEAM',
  mesh: {
    positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
    indices: [0, 1, 2],
  },
  outline: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }],
  order: 1,
});

describe('malha do objeto importado no 3D', () => {
  it('gera um triângulo com normal e a faixa do elemento', () => {
    const p = createEmptyProject();
    p.elements = { g_a: generic('g_a') };
    const [batch] = buildGenericSolids(p, 'lv_0');
    expect(batch).toBeDefined();
    expect(batch!.category).toBe('generic');
    expect(batch!.positions).toHaveLength(9);
    expect(batch!.normals).toHaveLength(9);
    expect(batch!.indices).toEqual([0, 1, 2]);
    expect(batch!.ids).toEqual([{ id: 'g_a', start: 0, count: 3 }]);
    expect(Math.hypot(...(batch!.normals.slice(0, 3) as [number, number, number]))).toBeCloseTo(1, 6);
  });

  it('ignora objeto de outro nível e projeto sem genérico', () => {
    const p = createEmptyProject();
    p.elements = { g_a: generic('g_a', 'lv_1') };
    expect(buildGenericSolids(p, 'lv_0')).toEqual([]);
  });

  it('usa um lote por cor do IFC (material im_<hex>)', () => {
    const p = createEmptyProject();
    p.elements = { g_a: { ...generic('g_a'), color: '#f6c073' }, g_b: { ...generic('g_b'), color: '#f6c073' }, g_c: generic('g_c') };
    const batches = buildGenericSolids(p, 'lv_0');
    expect(batches.map((b) => b.materialId).sort()).toEqual(['im_f6c073', 'mat_concreto']);
    const colorido = batches.find((b) => b.materialId === 'im_f6c073')!;
    expect(colorido.ids.map((r) => r.id).sort()).toEqual(['g_a', 'g_b']);
    expect(colorido.indices).toHaveLength(6);
  });
});
