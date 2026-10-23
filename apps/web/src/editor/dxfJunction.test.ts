import { describe, expect, it } from 'vitest';
import { multiArea, type MultiPolygon } from '@hestia/geom';
import { resolveFloors, resolveSlabs } from '@hestia/engine';
import { ProjectStore, buildTemplate, makeFloor, makeSlab } from '@hestia/model';
import { dxfGeometryOf } from './dxfExport.ts';
import { ifcGeometryOf } from './ifcExport.ts';

/**
 * F7.1 (0023 §6): o DXF de piso e laje sai com a região resolvida pela junção, como a planta. Na zona comum de um piso que
 * sobe acima da laje do mesmo nível, a laje estrutural vence (regra B, 0023 §1.3): a laje sai inteira e o piso perde a faixa.
 */

const RECT = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 4 }, { x: 0, y: 4 }];

const areaOfExport = (outline: Array<{ x: number; y: number }>, holes: Array<Array<{ x: number; y: number }>>): number =>
  multiArea([[outline, ...holes]] as MultiPolygon);

function project() {
  const s = new ProjectStore(buildTemplate('blank'));
  s.exec({ type: 'addSlab', slab: makeSlab({ id: 'l1', typeId: 'ls_mac12', levelId: 'lv_0', boundary: RECT }) });
  s.exec({ type: 'addFloor', floor: makeFloor({ id: 'f1', typeId: 'ft_ceram', levelId: 'lv_0', boundary: RECT, heightOffset: 0.12 }) });
  return s.project;
}

describe('F7.1 · DXF de piso e laje = região resolvida pela junção', () => {
  it('a laje estrutural vence a zona comum: sai inteira no DXF', () => {
    const p = project();
    const slabBoundary = multiArea(resolveSlabs(p, 'lv_0')[0]!.polygon);
    const exported = dxfGeometryOf(p, 'lv_0').slabs!.reduce((s, x) => s + areaOfExport(x.outline, x.holes), 0);
    expect(exported).toBeCloseTo(slabBoundary, 6);
  });

  it('piso inteiro dentro da laje (todas as camadas na zona comum) não sai no DXF, como na planta', () => {
    // Piso fino (acabamento, 4 cm) abaixo do topo da laje, dentro da faixa dela: a laje vence em todas as camadas.
    const s = new ProjectStore(buildTemplate('blank'));
    s.exec({ type: 'addSlab', slab: makeSlab({ id: 'l1', typeId: 'ls_mac12', levelId: 'lv_0', boundary: RECT }) });
    s.exec({ type: 'addFloor', floor: makeFloor({ id: 'f1', typeId: 'ft_acab', levelId: 'lv_0', boundary: RECT, heightOffset: -0.02 }) });
    const p = s.project;
    const floorBoundary = multiArea(resolveFloors(p, 'lv_0')[0]!.polygon);
    const floors = dxfGeometryOf(p, 'lv_0').floors ?? [];
    expect(floorBoundary).toBeGreaterThan(0);
    expect(floors.reduce((t, x) => t + areaOfExport(x.outline, x.holes), 0)).toBeLessThan(1e-9);
  });
});

describe('F7.1 · IFC de piso e laje = região resolvida pela junção', () => {
  it('piso inteiro dentro da laje não vira elemento IFC; a laje segue inteira', () => {
    const s = new ProjectStore(buildTemplate('blank'));
    s.exec({ type: 'addSlab', slab: makeSlab({ id: 'l1', typeId: 'ls_mac12', levelId: 'lv_0', boundary: RECT }) });
    s.exec({ type: 'addFloor', floor: makeFloor({ id: 'f1', typeId: 'ft_acab', levelId: 'lv_0', boundary: RECT, heightOffset: -0.02 }) });
    const g = ifcGeometryOf(s.project);
    expect(g.floors.find((f) => f.floorId === 'f1')).toBeUndefined();
    expect(g.slabs.find((x) => x.slabId === 'l1')?.prisms.length ?? 0).toBeGreaterThan(0);
  });
});
