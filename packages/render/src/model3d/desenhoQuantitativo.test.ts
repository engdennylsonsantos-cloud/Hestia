import { describe, expect, it } from 'vitest';
import { junctionLevel, quantifyLevel, resolveLevel } from '@hestia/engine';
import { ProjectStore, createEmptyProject, makeFloor, makeSlab, makeWall, type Project } from '@hestia/model';
import { buildLevelSolids, type SolidBatch } from './solids.ts';

/**
 * F5 · desenho = quantitativo (decisão 0023 §2, critério 1). O volume da parede no 3D (sólido extrudado com a junção) tem
 * que bater com o quantitativo da mesma parede no mesmo nível, incluindo o caso de laje do pavimento de cima (F1b).
 */

const rect = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

/** Volume assinado de um lote: soma dos tetraedros (origem, a, b, c) de cada triângulo. */
function volumeOf(b: SolidBatch): number {
  const at = (k: number): [number, number, number] => [b.positions[3 * k]!, b.positions[3 * k + 1]!, b.positions[3 * k + 2]!];
  let v = 0;
  for (let i = 0; i < b.indices.length; i += 3) {
    const [ax, ay, az] = at(b.indices[i]!);
    const [bx, by, bz] = at(b.indices[i + 1]!);
    const [cx, cy, cz] = at(b.indices[i + 2]!);
    v += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
  }
  return Math.abs(v);
}

const solidWallVolume = (p: Project, levelId: string): number =>
  buildLevelSolids(resolveLevel(p, levelId), junctionLevel(p, levelId)).batches.filter((b) => b.category === 'wall').reduce((s, b) => s + volumeOf(b), 0);

const quantWallVolume = (p: Project, levelId: string): number =>
  quantifyLevel(p, resolveLevel(p, levelId)).layers.reduce((s, l) => s + l.volume, 0);

/** Casos: parede do térreo com piso de sala, com e sem laje do pavimento de cima (cota 3,00 m) cobrindo a parede. */
function project(opts: { baseOffset: number; height: number; slab: boolean }): Project {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w1', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, height: opts.height, baseOffset: opts.baseOffset }) });
  s.exec({ type: 'addFloor', floor: makeFloor({ id: 'f1', typeId: 'ft_ceram', levelId: 'lv_0', boundary: rect(0, 0, 4, 3) }) });
  if (opts.slab) s.exec({ type: 'addSlab', slab: makeSlab({ id: 's1', typeId: 'ls_mac12', levelId: 'lv_1', boundary: rect(-1, -1, 5, 1) }) });
  return s.project;
}

describe('F5 · desenho = quantitativo (parede no 3D bate com o quantitativo)', () => {
  it.each([
    ['sem junção (parede acima do piso)', { baseOffset: 0, height: 3, slab: false }],
    ['parede desce até o piso (piso sobre a base)', { baseOffset: -0.2, height: 3, slab: false }],
    ['parede de 6 m atravessa a laje do pavimento de cima (F1b)', { baseOffset: 0, height: 6, slab: true }],
  ] as const)('%s', (_, opts) => {
    const p = project({ ...opts });
    const solid = solidWallVolume(p, 'lv_0');
    const quant = quantWallVolume(p, 'lv_0');
    expect(solid).toBeGreaterThan(0);
    expect(solid).toBeCloseTo(quant, 6);
  });
});
