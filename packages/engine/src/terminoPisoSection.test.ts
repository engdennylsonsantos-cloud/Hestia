import { describe, expect, it } from 'vitest';
import { multiArea } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeFloor, makeWall, type Project } from '@hestia/model';
import { computeSection } from './section.ts';

/**
 * Corte de um piso único com término por camada (decisão 0025): piso 10 × 8 m com uma parede interna de 0,184 m (x = 5)
 * que atravessa o contorno. Corte horizontal em y = 4: o acabamento para na face da parede (duas partes), a estrutura
 * passa por baixo dela (inteira).
 */
function pisoUnico(): Project {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addFloor', floor: makeFloor({ id: 'pu', typeId: 'ft_unico', levelId: 'lv_0', boundary: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 8 }, { x: 0, y: 8 }] }) });
  s.exec({
    type: 'addWall',
    wall: makeWall({ id: 'w1', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 5, y: -1 }, b: { x: 5, y: 9 }, height: 2.8, joinStart: { kind: 'butt', flip: false }, joinEnd: { kind: 'butt', flip: false } }),
  });
  return s.project;
}

describe('corte do piso único: bandas por camada com o término (decisão 0025)', () => {
  it('o acabamento é cortado pela parede (10 − 0,184 m); a estrutura que passa sai inteira (10 m)', () => {
    const r = computeSection(pisoUnico(), { a: { x: -1, y: 4 }, b: { x: 11, y: 4 }, depth: 3 });
    const soma = (material: string): number =>
      r.cut.filter((c) => c.materialId === material && c.sources.some((s) => s.floorId === 'pu')).reduce((t, c) => t + multiArea(c.polygons), 0);
    expect(soma('mat_ceramica')).toBeCloseTo((10 - 0.184) * 0.01, 6);
    expect(soma('mat_concreto')).toBeCloseTo(10 * 0.12, 6);
  });
});
