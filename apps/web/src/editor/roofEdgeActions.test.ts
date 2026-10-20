import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeRoof, type Roof } from '@hestia/model';
import { applyRoofPatch, setEdgeOverhang, setEdgeSlope, toggleRoofEdgeDefines } from './roofEdgeActions.ts';
import { useUi } from './state.ts';

const rect = [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 6 }, { x: 0, y: 6 }];

/** Telhado por arestas 8 × 6 com as arestas longas definindo inclinação (duas águas com empenas). */
function storeWithRoof(): { store: ProjectStore; roof: () => Roof } {
  const store = new ProjectStore(createEmptyProject());
  store.exec({
    type: 'addRoof',
    roof: makeRoof({ id: 't1', typeId: 'rt_ceramica', levelId: 'lv_0', boundary: rect, shape: 'edges', slopePercent: 30, dir: { x: 1, y: 0 }, edgeSlopes: [30, null, 30, null], edgeOverhangs: [0, 0, 0, 0] }),
  });
  return { store, roof: () => store.project.elements.t1 as Roof };
}

describe('aresta de telhado pelas Propriedades (A11)', () => {
  it('balanço da aresta move só ela para fora e guarda o valor', () => {
    const { store, roof } = storeWithRoof();
    expect(setEdgeOverhang(store, roof(), 1, 1)).toBe(true);
    const r = roof();
    expect(r.boundary[1]!.x).toBeCloseTo(9, 9);
    expect(r.boundary[2]!.x).toBeCloseTo(9, 9);
    expect(r.boundary[0]!.x).toBeCloseTo(0, 9);
    expect(r.edgeOverhangs[1]).toBe(1);
  });

  it('inclinação inválida na aresta não aplica e avisa', () => {
    const { store, roof } = storeWithRoof();
    expect(setEdgeSlope(store, roof(), 0, 0)).toBe(false);
    expect(useUi.getState().status).toMatch(/maior que zero/);
    expect(roof().edgeSlopes).toEqual([30, null, 30, null]);
  });

  it('desligar a última aresta que define inclinação não aplica (o telhado ficaria sem águas)', () => {
    const { store, roof } = storeWithRoof();
    expect(applyRoofPatch(store, ['t1'], { edgeSlopes: [null, null, null, null] })).toBe(false);
    expect(useUi.getState().status).toMatch(/Alteração não aplicada/);
    expect(roof().edgeSlopes).toEqual([30, null, 30, null]);
  });

  it('o atalho I liga e desliga "define inclinação" da aresta escolhida', () => {
    const { store, roof } = storeWithRoof();
    expect(toggleRoofEdgeDefines(store, { roofId: 't1', index: 1 })).toBe(true);
    expect(roof().edgeSlopes[1]).toBe(30);
    expect(toggleRoofEdgeDefines(store, { roofId: 't1', index: 1 })).toBe(true);
    expect(roof().edgeSlopes[1]).toBeNull();
  });

  it('sem aresta escolhida, o atalho não faz nada', () => {
    const { store, roof } = storeWithRoof();
    expect(toggleRoofEdgeDefines(store, null)).toBe(false);
    expect(roof().edgeSlopes).toEqual([30, null, 30, null]);
  });
});
