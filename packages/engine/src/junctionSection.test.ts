import { describe, expect, it } from 'vitest';
import { multiArea } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeFloor, makeSlab, type Layer, type Project } from '@hestia/model';
import { computeSection } from './section.ts';

const rect = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

/** Piso 0 a 6 m e laje 3 a 9 m (uma camada estrutural de 0,10 m cada): a linha em y = 2 atravessa os dois. */
function project(): Project {
  const base = createEmptyProject();
  const one: Layer[] = [{ function: 'structure', materialId: 'mat_bloco14', thickness: 0.1 } as Layer];
  base.floorTypes.ft_t = { ...base.floorTypes.ft_ceram!, id: 'ft_t', name: 'Teste piso', code: 'PT', layers: one };
  // Material diferente na laje: o corte junta as regiões por material, e a área do piso não pode incluir a da laje.
  base.slabTypes.ls_t = { ...base.slabTypes.ls_mac12!, id: 'ls_t', name: 'Teste laje', code: 'LT', layers: [{ function: 'structure', materialId: 'mat_concreto', thickness: 0.1 } as Layer] };
  const s = new ProjectStore(base);
  s.exec({ type: 'addFloor', floor: makeFloor({ id: 'f', typeId: 'ft_t', levelId: 'lv_0', boundary: rect(0, 0, 6, 4) }) });
  s.exec({ type: 'addSlab', slab: makeSlab({ id: 's', typeId: 'ls_t', levelId: 'lv_0', boundary: rect(3, 0, 9, 4) }) });
  return s.project;
}

/** Área (m²) do corte visível de um elemento: união das regiões cujas origens incluem o id. */
const cutArea = (cut: Array<{ sources: Array<{ floorId?: string; slabId?: string }>; polygons: Parameters<typeof multiArea>[0] }>, key: 'floorId' | 'slabId', id: string): number =>
  cut.filter((r) => r.sources.some((s) => s[key] === id)).reduce((s, r) => s + multiArea(r.polygons), 0);

describe('corte: piso cortado pela laje usa a parte resolvida (decisão 0023 §3, P7b)', () => {
  it('a linha que atravessa o piso mostra só a parte que sobra dele (3 m × 0,10 m = 0,30 m²)', () => {
    const r = computeSection(project(), { a: { x: -1, y: 2 }, b: { x: 10, y: 2 }, depth: 3 });
    expect(cutArea(r.cut, 'floorId', 'f')).toBeCloseTo(0.3, 6);
    expect(cutArea(r.cut, 'slabId', 's')).toBeCloseTo(0.6, 6);
  });
});
