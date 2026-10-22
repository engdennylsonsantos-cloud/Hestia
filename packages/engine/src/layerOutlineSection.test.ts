import { describe, expect, it } from 'vitest';
import { multiArea } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeFloor, makeWall, type Layer, type Project, type WallType } from '@hestia/model';
import { computeSection } from './section.ts';

/** Decisão 0023 §3 e §2 (P8): no corte, cada camada de piso vinculado corta o seu contorno (estrutura até o núcleo). */

/** Retângulo de 4 × 3 m com paredes de 14 cm (2 cm de acabamento de cada lado), esquadria e piso vinculado. */
function project(): Project {
  const base = createEmptyProject();
  const layer = (fn: Layer['function'], materialId: string, thickness: number): Layer => ({ function: fn, materialId, thickness, wraps: false });
  const wt: WallType = { ...base.wallTypes.wt_alv14!, id: 'wt_t', name: 'Teste', code: 'T', layers: [layer('finish1', 'mat_argamassa', 0.02), layer('structure', 'mat_bloco14', 0.1), layer('finish1', 'mat_argamassa', 0.02)] };
  base.wallTypes.wt_t = wt;
  base.floorTypes.ft_t = { ...base.floorTypes.ft_ceram!, id: 'ft_t', name: 'Teste piso', code: 'PT', layers: [layer('finish1', 'mat_ceramica', 0.01), layer('structure', 'mat_concreto', 0.1)] };
  const s = new ProjectStore(base);
  const M = { kind: 'miter' as const, flip: false };
  const pts = [[0, 0], [4, 0], [4, 3], [0, 3]] as const;
  pts.forEach(([x, y], i) => {
    const [x2, y2] = pts[(i + 1) % 4]!;
    s.exec({ type: 'addWall', wall: makeWall({ id: `w${i}`, typeId: 'wt_t', levelId: 'lv_0', a: { x, y }, b: { x: x2, y: y2 }, height: 2.8, joinStart: M, joinEnd: M }) });
  });
  s.exec({ type: 'addFloor', floor: makeFloor({ id: 'f1', typeId: 'ft_t', levelId: 'lv_0', boundary: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }], outlineSource: { mode: 'walls-finish', seed: { x: 2, y: 1.5 }, linked: true } }) });
  return s.project;
}

describe('corte: camada de piso vinculado usa o contorno da própria camada (decisão 0023 §3, P8)', () => {
  it('a estrutura corta até o núcleo da parede (3,90 m entre os núcleos) e o acabamento só até a face (3,86 m)', () => {
    const r = computeSection(project(), { a: { x: -1, y: 1.5 }, b: { x: 5, y: 1.5 }, depth: 3 });
    const sumBy = (material: string): number =>
      r.cut.filter((c) => c.materialId === material && c.sources.some((s) => s.floorId === 'f1')).reduce((s, c) => s + multiArea(c.polygons), 0);
    expect(sumBy('mat_concreto')).toBeCloseTo((4 - 0.1) * 0.1, 6);
    expect(sumBy('mat_ceramica')).toBeCloseTo((4 - 0.14) * 0.01, 6);
  });
});
