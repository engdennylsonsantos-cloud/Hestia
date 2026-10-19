import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeWall, type Wall } from '@hestia/model';
import { resolveLevel } from '@hestia/engine';
import { buildLevelSolids } from './solids.ts';

const wall = (id: string, ax: number, ay: number, bx: number, by: number): Omit<Wall, 'order'> =>
  makeWall({ id, typeId: 'wt_alv14', levelId: 'lv_0', a: { x: ax, y: ay }, b: { x: bx, y: by } });

/** Volume por teorema da divergência sobre a malha: valida que a extrusão é fechada e bem orientada. */
function volume(b: { positions: number[]; indices: number[] }): number {
  let v = 0;
  for (let i = 0; i < b.indices.length; i += 3) {
    const [a, c, d] = [b.indices[i]!, b.indices[i + 1]!, b.indices[i + 2]!];
    const p = (k: number) => [b.positions[k * 3]!, b.positions[k * 3 + 1]!, b.positions[k * 3 + 2]!] as const;
    const [p0, p1, p2] = [p(a), p(c), p(d)];
    v += (p0[0] * (p1[1] * p2[2] - p1[2] * p2[1]) - p0[1] * (p1[0] * p2[2] - p1[2] * p2[0]) + p0[2] * (p1[0] * p2[1] - p1[1] * p2[0])) / 6;
  }
  return v;
}

describe('sólidos 3D', () => {
  it('volume do bloco bate com a área em planta × altura', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addWall', wall: wall('a', 0, 0, 4, 0) });
    s.exec({ type: 'addWall', wall: wall('b', 0, 0, 0, 3) });
    const r = resolveLevel(s.project, 'lv_0');
    const solids = buildLevelSolids(r);
    const bloco = solids.batches.find((b) => b.materialId === 'mat_bloco14')!;
    // Encosto (padrão): a primeira parede atravessa até a face externa; a segunda para na linha de centro dela.
    const core = 0.14 * (4 + 0.092) + 0.14 * (3 - 0.07);
    expect(Math.abs(volume(bloco))).toBeCloseTo(core * 2.8, 5);
  });
  it('porta deixa uma verga acima do vão', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addWall', wall: wall('a', 0, 0, 4, 0) });
    s.exec({ type: 'addOpening', opening: { id: 'd', kind: 'door', typeId: 'ot_p80', hostId: 'a', offset: 2, flipHand: false, flipFacing: false, sillOverride: null, mark: '' } });
    const solids = buildLevelSolids(resolveLevel(s.project, 'lv_0'));
    const bloco = solids.batches.find((b) => b.materialId === 'mat_bloco14')!;
    const full = 0.14 * 4 * 2.8;
    const hole = 0.14 * 0.8 * 2.1;
    expect(Math.abs(volume(bloco))).toBeCloseTo(full - hole, 5);
  });
});
