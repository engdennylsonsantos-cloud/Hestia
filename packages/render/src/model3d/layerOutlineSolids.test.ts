import { describe, expect, it } from 'vitest';
import { junctionLevel, resolveFloors } from '@hestia/engine';
import { ProjectStore, createEmptyProject, makeFloor, makeWall, type Layer, type Project, type WallType } from '@hestia/model';
import { buildFloorSolids, type SolidBatch } from './solids.ts';

/** Decisão 0023 §3 e §2 (P8): o sólido de cada camada de piso vinculado usa o contorno da própria camada. */

/** Volume (m³) de uma malha fechada: soma dos tetraedros com a origem. */
function volume(b: Pick<SolidBatch, 'positions' | 'indices'>): number {
  let v = 0;
  const P = (k: number) => [b.positions[k * 3]!, b.positions[k * 3 + 1]!, b.positions[k * 3 + 2]!] as const;
  for (let i = 0; i < b.indices.length; i += 3) {
    const [a, c, d] = [P(b.indices[i]!), P(b.indices[i + 1]!), P(b.indices[i + 2]!)];
    v += (a[0] * (c[1] * d[2] - c[2] * d[1]) - a[1] * (c[0] * d[2] - c[2] * d[0]) + a[2] * (c[0] * d[1] - c[1] * d[0])) / 6;
  }
  return Math.abs(v);
}

/** Retângulo de 4 × 3 m (linha de centro) com paredes de 14 cm (2 cm de acabamento de cada lado) e esquadria. */
function project(): Project {
  const base = createEmptyProject();
  const layer = (fn: Layer['function'], materialId: string, thickness: number): Layer => ({ function: fn, materialId, thickness, wraps: false });
  const wt: WallType = { ...base.wallTypes.wt_alv14!, id: 'wt_t', name: 'Teste', code: 'T', layers: [layer('finish1', 'mat_argamassa', 0.02), layer('structure', 'mat_bloco14', 0.1), layer('finish1', 'mat_argamassa', 0.02)] };
  base.wallTypes.wt_t = wt;
  base.floorTypes.ft_t = {
    ...base.floorTypes.ft_ceram!,
    id: 'ft_t',
    name: 'Teste piso',
    code: 'PT',
    layers: [layer('finish1', 'mat_ceramica', 0.01), layer('substrate', 'mat_argamassa', 0.02), layer('structure', 'mat_concreto', 0.1)],
  };
  const s = new ProjectStore(base);
  const M = { kind: 'miter' as const, flip: false };
  const pts = [[0, 0], [4, 0], [4, 3], [0, 3]] as const;
  pts.forEach(([x, y], i) => {
    const [x2, y2] = pts[(i + 1) % 4]!;
    s.exec({ type: 'addWall', wall: makeWall({ id: `w${i}`, typeId: 'wt_t', levelId: 'lv_0', a: { x, y }, b: { x: x2, y: y2 }, height: 2.8, joinStart: M, joinEnd: M }) });
  });
  s.exec({
    type: 'addFloor',
    floor: makeFloor({
      id: 'f1',
      typeId: 'ft_t',
      levelId: 'lv_0',
      boundary: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }],
      outlineSource: { mode: 'walls-finish', seed: { x: 2, y: 1.5 }, linked: true },
    }),
  });
  return s.project;
}

describe('3D: sólido por camada com o contorno da camada (decisão 0023 §2, P8)', () => {
  it('a estrutura (dentro do núcleo) vai até o núcleo da parede; acabamento e substrato param na face', () => {
    const p = project();
    const batches = buildFloorSolids(resolveFloors(p, 'lv_0'), junctionLevel(p, 'lv_0'));
    const core = (4 - 0.1) * (3 - 0.1);
    const face = (4 - 0.14) * (3 - 0.14);
    expect(batches.reduce((s, b) => s + volume(b), 0)).toBeCloseTo(core * 0.1 + face * 0.03, 6);
  });
});
